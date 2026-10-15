"""信息提取主流程：逐构件求值自定义列，产出 ITO 行数据与合计。"""

from __future__ import annotations

import ifcopenshell
from ifcopenshell.util.element import get_container

from app.geometry.extract import load_or_extract
from app.takeoff.columns import normalize_columns
from app.takeoff.expr import ExprError, evaluate
from app.takeoff.quantities import from_bbox

# 跳过的空间结构类型（非物理构件，不进入提取表）。
_SPATIAL_TYPES = {"IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"}

def run_takeoff(
    model: ifcopenshell.file,
    path: str,
    columns: list[dict] | None,
    limit: int = 500,
) -> dict:
    """对模型执行信息提取：固定字段 + 自定义列求值，返回行、合计与统计。"""
    normalized = normalize_columns(columns)
    geometry, cache_hit = load_or_extract(model, path)
    rows: list[dict] = []
    totals: dict[str, float] = {}
    errors = 0
    numeric_keys = _numeric_columns(normalized)
    for element in model.by_type("IfcProduct"):
        if element.is_a() in _SPATIAL_TYPES:
            continue
        entry = geometry.get(element.GlobalId)
        quantities = from_bbox(entry["bbox"]) if entry else {}
        row, values, failed = _build_row(element, quantities, normalized)
        errors += failed
        rows.append(row)
        for key in numeric_keys:
            value = values.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                totals[key] = totals.get(key, 0.0) + value
        if len(rows) >= limit:
            break
    return {
        "path": path,
        "total": len(rows),
        "truncated": len(rows) >= limit,
        "cache_hit": cache_hit,
        "expression_errors": errors,
        "columns": normalized,
        "totals": {key: round(value, 6) for key, value in totals.items()},
        "rows": rows,
    }

def _numeric_columns(columns: list[dict[str, str]]) -> list[str]:
    """数值列参与合计；布尔 / 文本列只展示不累加。"""
    return [column["key"] for column in columns]

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
