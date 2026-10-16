"""内置信息提取模板（Definition）：开箱即用的 ITO 预设，对齐 Solibri。

每个 Definition 绑定一组 IFC 类型 + 一组计算列 + 默认分组字段，
用户打开面板即可选用，无需从零写表达式。用户自定义模板由 L3 持久化。
"""

from __future__ import annotations

# group_by 取值：container（按楼层）/ ifc_type（按类型）/ layer_role（按构造层角色）/ layer_material（按材质名）；空串 = 不分组
DEFINITIONS: list[dict] = [
    # ---------- 建筑 ----------
    {
        "id": "walls",
        "category": "arch",
        "name": "墙体工程量",
        "name_en": "Walls",
        "description": "按楼层统计墙体的长度、面积、体积",
        "description_en": "Wall length, area and volume grouped by storey",
        "ifc_types": ["IfcWall", "IfcWallStandardCase"],
        "group_by": "container",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
            {"key": "surface_area", "name": "表面积", "name_en": "Surface area", "unit": "m²", "expr": "qty('surface_area')"},
        ],
    },
    {
        "id": "wall-layers",
        "category": "arch",
        "name": "墙体构造层",
        "name_en": "Wall Layers",
        "description": "按构造层统计复合墙各层（砖 / 保温 / 砂浆等）的长度、面积、体积",
        "description_en": "Composite wall layers (masonry / insulation / mortar) length, area and volume",
        "ifc_types": ["IfcWall", "IfcWallStandardCase", "IfcBuildingElementPart"],
        "group_by": "layer_role",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
            {"key": "surface_area", "name": "表面积", "name_en": "Surface area", "unit": "m²", "expr": "qty('surface_area')"},
        ],
    },
    {
        "id": "curtain-walls",
        "category": "arch",
        "name": "幕墙",
        "name_en": "Curtain Walls",
        "description": "按楼层统计幕墙的面积、体积与长度（含玻璃面板与龙骨）",
        "description_en": "Curtain wall area, volume and length grouped by storey (glass panels and mullions included)",
        "ifc_types": ["IfcCurtainWall", "IfcPlate", "IfcMember"],
        "group_by": "container",
        "columns": [
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
        ],
    },
    {
        "id": "doors",
        "category": "arch",
        "name": "门统计",
        "name_en": "Doors",
        "description": "按楼层统计门的宽度、高度、面积",
        "description_en": "Door width, height and area grouped by storey",
        "ifc_types": ["IfcDoor"],
        "group_by": "container",
        "columns": [
            {"key": "width", "name": "宽度", "name_en": "Width", "unit": "m", "expr": "qty('width')"},
            {"key": "height", "name": "高度", "name_en": "Height", "unit": "m", "expr": "qty('height')"},
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
        ],
    },
    {
        "id": "windows",
        "category": "arch",
        "name": "窗统计",
        "name_en": "Windows",
        "description": "按楼层统计窗的宽度、高度、面积",
        "description_en": "Window width, height and area grouped by storey",
        "ifc_types": ["IfcWindow"],
        "group_by": "container",
        "columns": [
            {"key": "width", "name": "宽度", "name_en": "Width", "unit": "m", "expr": "qty('width')"},
            {"key": "height", "name": "高度", "name_en": "Height", "unit": "m", "expr": "qty('height')"},
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
        ],
    },
    {
        "id": "spaces",
        "category": "arch",
        "name": "空间面积",
        "name_en": "Spaces",
        "description": "按楼层统计空间的面积与体积",
        "description_en": "Space area and volume grouped by storey",
        "ifc_types": ["IfcSpace"],
        "group_by": "container",
        "columns": [
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
        ],
    },
    {
        "id": "railings",
        "category": "arch",
        "name": "栏杆长度",
        "name_en": "Railings",
        "description": "按楼层统计栏杆总长度",
        "description_en": "Railing length grouped by storey",
        "ifc_types": ["IfcRailing"],
        "group_by": "container",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
        ],
    },
    {
        "id": "stairs",
        "category": "arch",
        "name": "楼梯",
        "name_en": "Stairs",
        "description": "按楼层统计楼梯体积",
        "description_en": "Stair volume grouped by storey",
        "ifc_types": ["IfcStair", "IfcStairFlight"],
        "group_by": "container",
        "columns": [
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
        ],
    },
    # ---------- 结构 ----------
    {
        "id": "columns",
        "category": "struct",
        "name": "柱",
        "name_en": "Columns",
        "description": "按楼层统计柱的高度与体积",
        "description_en": "Column height and volume grouped by storey",
        "ifc_types": ["IfcColumn"],
        "group_by": "container",
        "columns": [
            {"key": "height", "name": "高度", "name_en": "Height", "unit": "m", "expr": "qty('height')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
        ],
    },
    {
        "id": "beams",
        "category": "struct",
        "name": "梁",
        "name_en": "Beams",
        "description": "按楼层统计梁的长度与体积",
        "description_en": "Beam length and volume grouped by storey",
        "ifc_types": ["IfcBeam"],
        "group_by": "container",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
        ],
    },
    {
        "id": "slabs",
        "category": "struct",
        "name": "板",
        "name_en": "Slabs",
        "description": "按楼层统计板的面积与体积",
        "description_en": "Slab area and volume grouped by storey",
        "ifc_types": ["IfcSlab"],
        "group_by": "container",
        "columns": [
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
        ],
    },
    # ---------- 机电 ----------
    {
        "id": "ducts",
        "category": "mep",
        "name": "风管",
        "name_en": "Ducts",
        "description": "按楼层统计风管总长度",
        "description_en": "Duct length grouped by storey",
        "ifc_types": ["IfcDuctSegment", "IfcDuctFitting"],
        "group_by": "container",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
        ],
    },
    {
        "id": "pipes",
        "category": "mep",
        "name": "水管",
        "name_en": "Pipes",
        "description": "按楼层统计水管总长度",
        "description_en": "Pipe length grouped by storey",
        "ifc_types": ["IfcPipeSegment", "IfcPipeFitting"],
        "group_by": "container",
        "columns": [
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
        ],
    },
    # ---------- 通用 ----------
    {
        "id": "all",
        "category": "general",
        "name": "全部构件",
        "name_en": "All Elements",
        "description": "按类型统计全部构件的体积、面积、长度",
        "description_en": "All elements by IFC type: volume, area, length",
        "ifc_types": [],
        "group_by": "ifc_type",
        "columns": [
            {"key": "volume", "name": "体积", "name_en": "Volume", "unit": "m³", "expr": "qty('volume')"},
            {"key": "area", "name": "面积", "name_en": "Area", "unit": "m²", "expr": "qty('area')"},
            {"key": "length", "name": "长度", "name_en": "Length", "unit": "m", "expr": "qty('length')"},
        ],
    },
]

# 分类元数据：顺序即树上展示顺序
CATEGORIES: list[dict] = [
    {"id": "arch", "name": "建筑", "name_en": "Architecture"},
    {"id": "struct", "name": "结构", "name_en": "Structure"},
    {"id": "mep", "name": "机电", "name_en": "MEP"},
    {"id": "general", "name": "通用", "name_en": "General"},
]

_DEF_BY_ID = {item["id"]: item for item in DEFINITIONS}


def get_definition(definition_id: str) -> dict | None:
    """按 id 取内置模板；不存在返回 None。"""
    return _DEF_BY_ID.get(definition_id)


def localize_definition(definition: dict, lang: str) -> dict:
    """按语言本地化模板：name/description/columns[].name 走 *_en 字段。"""
    use_en = lang == "en"
    out = dict(definition)
    if use_en:
        out["name"] = definition.get("name_en") or definition["name"]
        out["description"] = definition.get("description_en") or definition.get("description", "")
    else:
        out.pop("name_en", None)
        out.pop("description_en", None)
    columns = []
    for col in definition.get("columns", []):
        item = dict(col)
        if use_en:
            item["name"] = col.get("name_en") or col["name"]
        item.pop("name_en", None)
        columns.append(item)
    out["columns"] = columns
    return out


def localize_definitions(definitions: list[dict], lang: str) -> list[dict]:
    return [localize_definition(d, lang) for d in definitions]
