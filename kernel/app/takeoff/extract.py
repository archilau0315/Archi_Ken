"""信息提取主流程：逐构件求值自定义列，产出 ITO 行数据与合计。

支持按 ifc_types 过滤（Solibri Definition 模式）、按 container / ifc_type / layer_role / layer_material 分组小计。
"""

from __future__ import annotations

import ifcopenshell
from ifcopenshell.util.element import get_container, get_decomposition

from app.geometry.extract import load_or_extract
from app.takeoff.columns import normalize_columns
from app.takeoff.expr import ExprError, evaluate
from app.takeoff.layers import ROLE_QUANTITIES, classify_layer, role_name
from app.takeoff.quantities import from_bbox, from_geometry

# 默认跳过的非物理构件：空间结构 + 洞口虚体，均不进入提取表。
# 若调用方显式把对应类型放进 ifc_types，则按豁免处理（如「空间面积」模板用 IfcSpace）。
_SKIPPED_TYPES = {
    "IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace",
    "IfcOpeningElement",
}

# 分组字段白名单：仅允许容器（楼层）、IFC 类型、构造层角色或材质名，避免任意表达式注入
_GROUP_KEYS = {"container", "ifc_type", "layer_role", "layer_material"}

# 幕墙类构件（幕墙本体 + 其面板 / 龙骨子构件）按「洞口 / 框外围面积」计量：
# 只保留面积与轮廓尺寸，不计体积 / 表面积，也不按材质拆层（区别于实体墙的分层口径）。
_CURTAIN_TYPES = {"IfcCurtainWall"}
_CURTAIN_KEEP = {"area", "length", "width", "height"}

# 门 / 窗：宽度 / 高度优先读 IFC 实体属性（几何包围盒的最小维是墙厚方向，不是宽度）。
_OPENING_TYPES = {"IfcDoor", "IfcWindow"}

# IFC2x3 没有 IFC4 的机电细分类型（IfcDuctSegment 等），风管 / 水管 / 桥架统一建模为
# IfcFlowSegment / IfcFlowFitting，靠 ObjectType 文本区分（如 "Duct Segment"、"Pipe Segment"）。
# 类型过滤命中 IFC4 细分类型时，回退匹配对应 IFC2x3 泛型 + ObjectType 关键词。
_FLOW_TYPE_ALIASES = {
    "IfcDuctSegment": ("IfcFlowSegment", "duct"),
    "IfcDuctFitting": ("IfcFlowFitting", "duct"),
    "IfcPipeSegment": ("IfcFlowSegment", "pipe"),
    "IfcPipeFitting": ("IfcFlowFitting", "pipe"),
    "IfcCableCarrierSegment": ("IfcFlowSegment", "cable"),
    "IfcCableCarrierFitting": ("IfcFlowFitting", "cable"),
}


def _matches_type_filter(element, type_filter: set[str]) -> bool:
    """IFC 类型精确匹配，附带 IFC2x3 泛型流构件（IfcFlowSegment/Fitting）的关键词回退。"""
    if not type_filter:
        return True
    isa = element.is_a()
    if isa in type_filter:
        return True
    # IFC4 模型里风管是 IfcDuctSegment（叶子类型），精确匹配已命中；
    # 走到这里说明叶子类型不在过滤集，仅当它是 IFC2x3 泛型流构件时按 ObjectType 判定。
    if isa not in ("IfcFlowSegment", "IfcFlowFitting"):
        return False
    object_type = (getattr(element, "ObjectType", None) or "").lower()
    if not object_type:
        return False
    return any(
        alias[0] == isa and alias[1] in object_type
        for wanted in type_filter
        if (alias := _FLOW_TYPE_ALIASES.get(wanted)) is not None
    )

# 净面积缓存的「未计算」哨兵（None 表示已计算且无洞口，与未计算区分开）。
_UNCACHED = object()


def _opening_sizes(model, element, entry: dict, quantities: dict, unit_scale: float | None) -> dict:
    """修正门 / 窗的宽度与高度：属性优先，几何推导兜底。

    包围盒三维是「宽 × 厚 × 高」，几何推导的 width（最小维）拿到的是墙厚方向尺寸；
    IFC4 的 IfcDoor / IfcWindow（及 IFC2x3 的 IfcWindow）自带 OverallWidth / OverallHeight
    属性（文件单位，需换算为米），最可靠。无属性时兜底：宽 = 水平面内较大边，高 = 竖向尺寸。
    """
    if unit_scale is None:
        try:
            from ifcopenshell.util.unit import calculate_unit_scale

            unit_scale = calculate_unit_scale(model) or 1.0
        except Exception:
            unit_scale = 1.0
    bbox = entry.get("bbox") or [0.0] * 6
    dx, dy, dz = bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]
    width = getattr(element, "OverallWidth", None)
    height = getattr(element, "OverallHeight", None)
    quantities["width"] = round(width * unit_scale, 6) if width else round(max(dx, dy), 6)
    quantities["height"] = round(height * unit_scale, 6) if height else round(dz, 6)
    return quantities


def run_takeoff(
    model: ifcopenshell.file,
    path: str,
    columns: list[dict] | None,
    limit: int = 500,
    ifc_types: list[str] | None = None,
    group_by: str | None = None,
    lang: str = "zh",
) -> dict:
    """对模型执行信息提取：固定字段 + 自定义列求值，可选按类型过滤与分组小计。"""
    normalized = normalize_columns(columns)
    # column:<key> = 按自定义列的值分组（对齐 Solibri 按任意属性分组，属性经自定义列 prop() 求值）
    if group_by is not None and group_by not in _GROUP_KEYS and not group_by.startswith("column:"):
        group_by = None
    geometry, cache_hit = load_or_extract(model, path)
    # 门窗宽度 / 高度优先取 IFC 实体属性（OverallWidth / OverallHeight，文件单位换算为米），按需惰性计算换算系数
    unit_scale: float | None = None
    # 多材质构件的几何拆分索引：<父 guid> → 各材质组条目，供分层明细行使用（一次遍历，避免逐构件扫描）。
    split_parts: dict[str, list[dict]] = {}
    for key, entry in geometry.items():
        if "#m" in key:
            split_parts.setdefault(key.split("#", 1)[0], []).append(entry)
    type_filter = {t.strip() for t in (ifc_types or []) if t and t.strip()}
    skipped = _SKIPPED_TYPES - type_filter  # 显式请求的类型（如 IfcSpace）不再跳过

    rows: list[dict] = []
    totals: dict[str, float] = {}
    errors = 0
    numeric_keys = _numeric_columns(normalized)
    truncated = False
    candidates = [
        element
        for element in model.by_type("IfcProduct")
        if element.is_a() not in skipped
        and _matches_type_filter(element, type_filter)
    ]
    guids = {element.GlobalId for element in candidates}
    # 幕墙本体 guid：其面板 / 龙骨子构件随之走幕墙口径（只作明细、不计体积 / 表面积、不拆层）
    curtain_guids = {element.GlobalId for element in candidates if element.is_a() in _CURTAIN_TYPES}
    # 净面积缓存：<guid> → 净投影面积（毛面积 − 洞口投影面积）；None 表示无洞口不干预
    net_face_cache: dict[str, float | None] = {}
    for element in candidates:
        entry = _resolve_geometry(geometry, element)
        quantities = from_geometry(entry) if entry else {}
        if element.is_a() in _OPENING_TYPES and entry:
            quantities = _opening_sizes(model, element, entry, quantities, unit_scale)
        parent_guid = _parent_guid_in(element, guids)
        # 幕墙类（幕墙本体 + 其面板 / 龙骨子构件）按「洞口 / 框外围面积」计量：
        # 只保留面积（与轮廓尺寸），不计体积 / 表面积，也不按材质分层（区别于实体墙的分层口径）。
        is_curtain = element.is_a() in _CURTAIN_TYPES or parent_guid in curtain_guids
        if is_curtain:
            quantities = {k: v for k, v in quantities.items() if k in _CURTAIN_KEEP}
            if entry and entry.get("bbox"):
                # 幕墙按框外围 / 洞口展开面积计量：取外包包围盒最大投影面，
                # 不用网格净面积（玻璃分片、龙骨拼不满框，网格投影会略小于框外围，如 9.86 ≠ 10）。
                quantities["area"] = from_bbox(entry["bbox"])["area"]
        # 有门窗洞口的构件：面积口径封顶为净面积（毛面积 − 洞口投影面积）。
        # 网格被洞口剪断的层本就 ≤ 净面积不受影响；包裹洞口反边的抹灰 / 找平层被压回净墙面面积。
        net_face = net_face_cache.get(element.GlobalId, _UNCACHED)
        if net_face is _UNCACHED:
            net_face = None if is_curtain else _net_face_area(element, geometry)
            net_face_cache[element.GlobalId] = net_face
        if net_face is not None and quantities.get("area") is not None:
            quantities["area"] = min(quantities["area"], net_face)
        # 子构件（构造层）的面积另按所属父墙的净面积封顶：父墙的门窗洞口同样要从层面积里减掉。
        if parent_guid and not is_curtain:
            parent_net = net_face_cache.get(parent_guid, _UNCACHED)
            if parent_net is _UNCACHED:
                parent_element = _element_parent(element, guids)
                parent_net = _net_face_area(parent_element, geometry) if parent_element is not None else None
                net_face_cache[parent_guid] = parent_net
            if parent_net is not None and quantities.get("area") is not None:
                quantities["area"] = min(quantities["area"], parent_net)
        row, values, failed = _build_row(element, quantities, normalized)
        errors += failed
        if not is_curtain:
            # 材质名：供 group_by=layer_material 时按材质分组（多材质父构件无单一材质，留空避免与明细重复）
            material = _material_of(entry)
            if material:
                row["layer_material"] = material
        if parent_guid:
            # 子构件（幕墙面板 / 龙骨 / 复合墙构造层）只作展开明细，不计入合计，避免父子重复
            row["parent_guid"] = parent_guid
            if not is_curtain:
                # 构造层角色：供 group_by=layer_role 时按角色分组、各组只汇总自洽的口径
                row["layer_role"] = classify_layer(getattr(element, "Name", None))
        else:
            _accumulate(totals, values, numeric_keys)
        rows.append(row)
        # 多材质构件（复合墙）：按材质拆开的几何组另出子行明细；幕墙不拆层，整幕墙按洞口面积计。
        if not is_curtain:
            layer_rows, layer_errors = _material_rows(element, split_parts.get(element.GlobalId) or [], normalized, net_face)
            errors += layer_errors
            for layer_row in layer_rows:
                layer_row["parent_guid"] = element.GlobalId
                rows.append(layer_row)
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
        result["groups"] = _group_rows(rows, group_by, numeric_keys, lang)
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
    parts = [p for p in parts if p.get("bbox")]
    merged = _merge_bbox([p["bbox"] for p in parts])
    if not merged:
        return None
    # 父构件自身没有网格（几何挂在各子条目下）：体积 / 表面积按子条目的真实几何累加，
    # 避免用外包包围盒算"毛体积"（多块拼合的包围盒会虚高数倍，与实际工程量对不上）；
    # 面积取子条目净面积叠合取大 / 拼接取和，同样不用外包包围盒（毛面积不扣洞口）。
    quantities = [from_geometry(p) for p in parts]
    result: dict = {"bbox": merged, "volume": sum(q.get("volume") or 0.0 for q in quantities)}
    if quantities and all("surface_area" in q for q in quantities):
        result["surface_area"] = sum(q["surface_area"] for q in quantities)
    # 面积不能取外包包围盒（毛面积，不扣洞口）：
    # 叠合构造层（同一墙面）→ 毛面积 − 洞口投影面积（窗套等饰面层会包裹洞口反边，不能用子面积取大）；
    # 互不重叠（拼接段）→ 各段子面积之和（子网格已扣洞口，直接相加）。
    areas = [q["area"] for q in quantities if q.get("area") is not None]
    if areas:
        if _layers_overlap(merged, parts):
            axis_a, axis_b = _main_face_axes(merged)
            gross = _face_area_on(merged, axis_a, axis_b)
            holes = sum(_face_area_on(b, axis_a, axis_b) for b in _openings_boxes(element, geometry))
            # 叠合层无论有无洞口都按外轮廓毛面积 − 洞口：无洞口时 gross 即整面面积
            # （门窗类构件外框即洞口尺寸，子面积取大会只留玻璃净面积，如窗面积 0.62 ≠ 1.0）；
            # 仅当 gross − holes ≤ 0（异常重叠）才退化子面积取大兜底。
            result["area"] = _round6(gross - holes) if gross - holes > 0 else max(areas)
        else:
            result["area"] = sum(areas)
    return result


def _openings_boxes(element, geometry: dict) -> list[list[float]]:
    """构件全部洞口的包围盒（IfcRelVoidsElement；IFC4 与 IFC2x3 字段名都兼容）。"""
    boxes: list[list[float]] = []
    for rel in getattr(element, "HasOpenings", []) or []:
        opening = getattr(rel, "RelatedOpeningElement", None) or getattr(rel, "RelatingOpeningElement", None)
        if opening is None:
            continue
        entry = geometry.get(opening.GlobalId)
        if entry and entry.get("bbox"):
            boxes.append(entry["bbox"])
    return boxes


def _face_area_on(bbox: list[float], axis_a: int, axis_b: int) -> float:
    """包围盒在指定两轴（0=x,1=y,2=z）张成平面上的投影面积。"""
    return max(bbox[axis_a + 3] - bbox[axis_a], 0.0) * max(bbox[axis_b + 3] - bbox[axis_b], 0.0)


def _main_face_axes(bbox: list[float]) -> tuple[int, int]:
    """包围盒主投影面的两轴索引（与 from_bbox 取最大投影面的口径一致）。"""
    dx = bbox[3] - bbox[0]
    dy = bbox[4] - bbox[1]
    dz = bbox[5] - bbox[2]
    return max(((0, 1, dx * dy), (1, 2, dy * dz), (0, 2, dx * dz)), key=lambda item: item[2])[:2]


def _net_face_area(element, geometry: dict) -> float | None:
    """带门窗洞口构件的净投影面积（毛面积 − Σ洞口投影面积）；无洞口返回 None（不干预）。

    毛面积取构件外包包围盒的最大投影面（与 from_bbox 同口径）；
    洞口投影面积必须在与墙主投影面同一平面上取（洞口在墙面上挖的洞，扣的是该面内的二维尺寸），
    不能取洞口自身包围盒的最大投影面——否则厚度方向比洞口宽/高大的洞口会被过度扣减
    （例：1.0宽×1.0高×1.35厚 的窗洞，错取 dy·dz=1.35 而非 dx·dz=1.0，净面积被多扣 0.35）。
    负值（异常重叠）钳为 0。构件自身无几何条目时按材质拆分 / 分解子条目合并包围盒兜底。
    """
    boxes = _openings_boxes(element, geometry)
    if not boxes:
        return None
    own = geometry.get(element.GlobalId)
    bbox = own.get("bbox") if own else None
    if not bbox:
        parts = [v for k, v in geometry.items() if k.startswith(f"{element.GlobalId}#")]
        if not parts:
            parts = _decomposition_entries(geometry, element)
        parts = [p for p in parts if p.get("bbox")]
        bbox = _merge_bbox([p["bbox"] for p in parts])
    if not bbox:
        return None
    axis_a, axis_b = _main_face_axes(bbox)
    gross = _face_area_on(bbox, axis_a, axis_b)
    holes = sum(_face_area_on(b, axis_a, axis_b) for b in boxes)
    return max(gross - holes, 0.0)


def _round6(value: float) -> float:
    return round(value, 6)


def _layers_overlap(merged: list[float], parts: list[dict]) -> bool:
    """判断子条目在主投影面上是否互相叠合（构造层叠合 → True；拼接段分离 → False）。"""
    dx = merged[3] - merged[0]
    dy = merged[4] - merged[1]
    dz = merged[5] - merged[2]
    # 主投影面与 from_bbox 的面积口径一致：dx*dy（XY）/ dy*dz（YZ）/ dx*dz（XZ）取大者
    axis_a, axis_b = max(((0, 1, dx * dy), (1, 2, dy * dz), (0, 2, dx * dz)), key=lambda item: item[2])[:2]
    rects = []
    for part in parts:
        bbox = part.get("bbox")
        if not bbox:
            continue
        rects.append((bbox[axis_a], bbox[axis_b], bbox[axis_a + 3], bbox[axis_b + 3]))
    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
            a, b = rects[i], rects[j]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                return True
    return False


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


def _material_of(entry: dict | None) -> str | None:
    """取几何条目的真实材质名；空名或 IFC 样式名（如窗的 IfcSurfaceStyleRendering）不算材质。"""
    if not entry:
        return None
    name = (entry.get("material") or "").strip()
    if not name or name.startswith("Ifc"):
        return None
    return name


def _material_rows(
    element, parts: list[dict], columns: list[dict[str, str]], net_face: float | None = None
) -> tuple[list[dict], int]:
    """把「按材质拆开的几何组」展开为子行明细。

    部分导出件把同一构件（复合墙 / 幕墙）按材质拆成 `<guid>#m0..#mN` 多个几何组，
    每组带真实材质名（如「粘土砖」「普通玻璃」）。这些组此前被合并成一个外包包围盒，
    无法分层统计；此处按组各出一行，挂在父构件下（父行仍代表整体并计入合计）。

    net_face 为所属墙的净投影面积（毛面积 − 洞口投影面积）：包裹洞口反边的抹灰 / 找平层
    面积被压回净墙面面积，等效「按面积记取的构造层减洞口面积」；被洞口剪断的层本就
    ≤ 净面积，封顶不改变其值。

    材质名缺失、或是 IFC 样式名（如窗的 IfcSurfaceStyleRendering）时不算真实构造层，跳过。
    """
    rows: list[dict] = []
    errors = 0
    name = getattr(element, "Name", None)
    for entry in parts:
        material = (entry.get("material") or "").strip()
        bbox = entry.get("bbox")
        if not material or material.startswith("Ifc") or not bbox:
            continue
        quantities = from_geometry(entry)
        # 带洞口墙的构造层明细行：面积同步封顶为墙面净面积（毛面积 − 洞口投影面积）
        if net_face is not None and quantities.get("area") is not None:
            quantities["area"] = min(quantities["area"], net_face)
        row, _, failed = _build_row(element, quantities, columns)
        errors += failed
        row["name"] = f"{name} - {material}" if name else material
        row["layer_role"] = classify_layer(material)
        row["layer_material"] = material
        rows.append(row)
    return rows, errors


def _element_parent(element, guids: set[str]):
    """返回该构件的构件级父实体；父必须为 IfcElement 且也在本次结果集中，否则 None。

    只认 IfcElement 级父（幕墙 → 面板 / 龙骨、复合墙 → 构造层），
    空间结构（楼层 / 空间）不算父，避免普通构件被误判为子构件。
    """
    for rel in getattr(element, "Decomposes", None) or []:
        parent = getattr(rel, "RelatingObject", None)
        if parent is None:
            continue
        if parent.is_a("IfcElement") and parent.GlobalId in guids:
            return parent
    return None


def _parent_guid_in(element, guids: set[str]) -> str | None:
    """返回该构件的构件级父 guid（见 _element_parent）。"""
    parent = _element_parent(element, guids)
    return parent.GlobalId if parent is not None else None


def _numeric_columns(columns: list[dict[str, str]]) -> list[str]:
    """数值列参与合计；布尔 / 文本列只展示不累加。"""
    return [column["key"] for column in columns]

def _accumulate(totals: dict[str, float], values: dict, keys: list[str]) -> None:
    """把一行 values 中可累加的数值列加进 totals。"""
    for key in keys:
        value = values.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            totals[key] = totals.get(key, 0.0) + value

def _group_rows(rows: list[dict], group_by: str, numeric_keys: list[str], lang: str = "zh") -> list[dict]:
    """按固定字段分组：保持行原顺序，组内累加小计。空值归到「(未分组)」。

    按 layer_role / layer_material 分组时只收纳带该字段的明细行（多材质父构件没有单一材质 / 层角色，
    整构件口径由总计行体现）：layer_role 每个角色只累加它自洽的口径（结构层算体积、保温层算面积 + 体积、
    抹灰 / 防水 / 饰面算面积），layer_material 则各列分别汇总同名材质；其余分组沿用「子构件只作明细、不计小计」。
    """
    groups: dict[str, dict] = {}
    order: list[str] = []
    column_key = group_by[len("column:"):] if group_by.startswith("column:") else None
    for row in rows:
        allowed: tuple[str, ...] | None = None
        if column_key is not None:
            # 按自定义列的值分组：数值 / 布尔转文本，空值归「(未分组)」
            key = _group_value_text((row.get("values") or {}).get(column_key), lang)
        elif group_by in ("layer_role", "layer_material"):
            value = row.get(group_by) or ""
            if not value:
                continue
            key = value
            allowed = ROLE_QUANTITIES.get(value) if group_by == "layer_role" else None
        else:
            key = row.get(group_by) or ""
        if key not in groups:
            groups[key] = {
                "key": role_name(key, lang) if group_by == "layer_role" else key,
                "rows": [],
                "subtotals": {},
            }
            order.append(key)
        groups[key]["rows"].append(row)
        # 非层 / 材质分组时子构件只作明细、不计入小计，避免父子重复计量；
        # 层 / 材质分组下多材质明细行（带 parent_guid）本身就是要汇总的对象，故不跳过
        if group_by not in ("layer_role", "layer_material") and row.get("parent_guid"):
            continue
        values = row.get("values") or {}
        if allowed is not None:
            values = {k: v for k, v in values.items() if k in allowed}
        _accumulate(groups[key]["subtotals"], values, numeric_keys)
    return [
        {
            "key": groups[key]["key"],
            "rows": groups[key]["rows"],
            "subtotals": {k: round(v, 6) for k, v in groups[key]["subtotals"].items()},
        }
        for key in order
    ]

def _group_value_text(value: object, lang: str) -> str:
    """把自定义列的值转成稳定的分组键文本：空值归空串（未分组），数值保留 6 位精度。"""
    if value is None:
        return ""
    if isinstance(value, bool):
        if lang == "zh":
            return "是" if value else "否"
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return str(round(float(value), 6))
    return str(value).strip()


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
