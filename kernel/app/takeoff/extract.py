"""信息提取主流程：逐构件求值自定义列，产出 ITO 行数据与合计。

支持按 ifc_types 过滤（Solibri Definition 模式）、按 container/ifc_type 分组小计。
"""

from __future__ import annotations

import ifcopenshell
from ifcopenshell.util.element import get_container, get_decomposition

from app.geometry.extract import load_or_extract
from app.takeoff.columns import normalize_columns
from app.takeoff.expr import ExprError, evaluate
from app.takeoff.quantities import from_bbox

# 跳过的空间结构类型（非物理构件，默认不进入提取表）。
# 若调用方显式把 IfcSpace 放进 ifc_types，则按豁免处理（用于「空间面积」模板）。
_SPATIAL_TYPES = {"IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"}

# 分组字段白名单：仅允许容器（楼层）或 IFC 类型，避免任意表达式注入
_GROUP_KEYS = {"container", "ifc_type"}

def run_takeoff(
    model: ifcopenshell.file,
    path: str,
    columns: list[dict] | None,
    limit: int = 500,
    ifc_types: list[str] | None = None,
    group_by: str | None = None,
) -> dict:
    """对模型执行信息提取：固定字段 + 自定义列求值，可选按类型过滤与分组小计。"""
    normalized = normalize_columns(columns)
    if group_by is not None and group_by not in _GROUP_KEYS:
        group_by = None
    geometry, cache_hit = load_or_extract(model, path)
    type_filter = {t.strip() for t in (ifc_types or []) if t and t.strip()}
    skipped = _SPATIAL_TYPES - type_filter  # 显式请求的类型（如 IfcSpace）不再跳过

    rows: list[dict] = []
    totals: dict[str, float] = {}
    errors = 0
    numeric_keys = _numeric_columns(normalized)
    truncated = False
    candidates = [
        element
        for element in model.by_type("IfcProduct")
        if element.is_a() not in skipped
        and (not type_filter or element.is_a() in type_filter)
    ]
    guids = {element.GlobalId for element in candidates}
    for element in candidates:
        entry = _resolve_geometry(geometry, element)
        quantities = from_bbox(entry["bbox"]) if entry else {}
        row, values, failed = _build_row(element, quantities, normalized)
        errors += failed
        parent_guid = _parent_guid_in(element, guids)
        if parent_guid:
            # 子构件（幕墙面板 / 龙骨 / 复合墙构造层）只作展开明细，不计入合计，避免父子重复
            row["parent_guid"] = parent_guid
        else:
            _accumulate(totals, values, numeric_keys)
        rows.append(row)
        if len(rows) >= limit:
            truncated = True
            break

    result = {
        "path": path,
        "total": len(rows),
        "truncated": truncated,
        "cache_hit": cache_hit,
        "expression_errors": errors,
        "columns": normalized,
        "totals": {key: round(value, 6) for key, value in totals.items()},
        "rows": rows,
    }
    if group_by:
        result["group_by"] = group_by
        result["groups"] = _group_rows(rows, group_by, numeric_keys)
    return result

def _resolve_geometry(geometry: dict, element) -> dict | None:
    """取构件几何；自身无实体时按包围盒回退合并，避免算量整列为空。

    真实模型里「父构件无几何」有两种常见情况：
    ① 多材质构件（如窗）被几何提取拆成 `<guid>#m0/#m1`，父 guid 键消失；
    ② 复合墙只有 2D 轴线，实体几何挂在 IfcBuildingElementPart 构造层下。
    """
    guid = element.GlobalId
    if guid in geometry:
        return geometry[guid]
    parts = [value for key, value in geometry.items() if key.startswith(f"{guid}#")]
    if not parts:
        parts = _decomposition_entries(geometry, element)
    merged = _merge_bbox([p["bbox"] for p in parts if p.get("bbox")])
    return {"bbox": merged} if merged else None


def _decomposition_entries(geometry: dict, element) -> list[dict]:
    """递归收集分解子构件的几何条目（含子构件自身的多材质拆分）。"""
    out: list[dict] = []
    for child in get_decomposition(element) or []:
        child_guid = child.GlobalId
        if child_guid in geometry:
            out.append(geometry[child_guid])
            continue
        subs = [value for key, value in geometry.items() if key.startswith(f"{child_guid}#")]
        out.extend(subs if subs else _decomposition_entries(geometry, child))
    return out


def _merge_bbox(bboxes: list[list[float]]) -> list[float] | None:
    """合并多个包围盒为一个外包包围盒。"""
    if not bboxes:
        return None
    return [
        min(b[0] for b in bboxes),
        min(b[1] for b in bboxes),
        min(b[2] for b in bboxes),
        max(b[3] for b in bboxes),
        max(b[4] for b in bboxes),
        max(b[5] for b in bboxes),
    ]


def _parent_guid_in(element, guids: set[str]) -> str | None:
    """返回该构件的构件级父 guid；父必须也在本次结果集中才算。

    只认 IfcElement 级父（幕墙 → 面板 / 龙骨、复合墙 → 构造层），
    空间结构（楼层 / 空间）不算父，避免普通构件被误判为子构件。
    """
    for rel in getattr(element, "Decomposes", None) or []:
        parent = getattr(rel, "RelatingObject", None)
        if parent is None:
            continue
        if parent.is_a("IfcElement") and parent.GlobalId in guids:
            return parent.GlobalId
    return None


def _numeric_columns(columns: list[dict[str, str]]) -> list[str]:
    """数值列参与合计；布尔 / 文本列只展示不累加。"""
    return [column["key"] for column in columns]

def _accumulate(totals: dict[str, float], values: dict, keys: list[str]) -> None:
    """把一行 values 中可累加的数值列加进 totals。"""
    for key in keys:
        value = values.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            totals[key] = totals.get(key, 0.0) + value

def _group_rows(rows: list[dict], group_by: str, numeric_keys: list[str]) -> list[dict]:
    """按固定字段分组：保持行原顺序，组内累加小计。空值归到「(未分组)」。"""
    groups: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        key = row.get(group_by) or ""
        if key not in groups:
            groups[key] = {"key": key, "rows": [], "subtotals": {}}
            order.append(key)
        groups[key]["rows"].append(row)
        if not row.get("parent_guid"):
            _accumulate(groups[key]["subtotals"], row.get("values") or {}, numeric_keys)
    return [
        {
            "key": key,
            "rows": groups[key]["rows"],
            "subtotals": {k: round(v, 6) for k, v in groups[key]["subtotals"].items()},
        }
        for key in order
    ]

def _build_row(
    element,
    quantities: dict[str, float],
    columns: list[dict[str, str]],
) -> tuple[dict, dict[str, object], int]:
    """构建单行：固定字段 + 按列序求值（values 支持引用前列）。"""
    container = get_container(element)
    values: dict[str, object] = {}
    errors = 0
    env = {
        "element": element,
        "quantities": quantities,
        "values": values,
        "get_psets": lambda: _psets(element),
    }
    cells: dict[str, object] = {}
    for column in columns:
        try:
            value = evaluate(column["expr"], env)
        except ExprError:
            value = None
            errors += 1
        values[column["key"]] = value
        cells[column["key"]] = value
    row = {
        "guid": element.GlobalId,
        "name": getattr(element, "Name", None),
        "ifc_type": element.is_a(),
        "container": getattr(container, "Name", None) if container is not None else None,
        "values": cells,
    }
    return row, values, errors

def _psets(element) -> dict:
    """惰性读取属性集，仅在使用 prop() 时付出解析成本。"""
    try:
        from ifcopenshell.util.element import get_psets

        return get_psets(element)
    except Exception:
        return {}
