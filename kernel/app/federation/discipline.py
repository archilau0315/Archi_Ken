"""专业分类（Discipline）自动映射。

对齐 Solibri「按文件 / 创建软件 / 命名自动映射专业分类」的行为：
对每个构件按 「构件命名 → IFC 类型 → 所属模型」 的优先级推断专业；
对每个模型按 「文件名 / 导出软件」 关键词推断默认专业，作为兜底。

规则表集中在此处，便于后续扩展或由界面覆盖。
"""

from __future__ import annotations

from typing import Any, Callable

# 专业定义：key 为内部标识，name 为界面显示名，color 为 3D 视图着色。
# 色值按「色相明显互异」原则配置：暖通=绿、给排水=蓝、电气=琥珀黄，避免相邻色混淆。
DISCIPLINES: list[dict[str, str]] = [
    {"key": "architecture", "name": "建筑", "name_en": "Architecture", "color": "#4f7cff"},
    {"key": "structural", "name": "结构", "name_en": "Structural", "color": "#f2a154"},
    {"key": "hvac", "name": "暖通", "name_en": "HVAC", "color": "#2fb377"},
    {"key": "plumbing", "name": "给排水", "name_en": "Plumbing", "color": "#2f9fd8"},
    {"key": "electrical", "name": "电气", "name_en": "Electrical", "color": "#e0a92e"},
    {"key": "site", "name": "场地", "name_en": "Site", "color": "#7d8fa6"},
    {"key": "other", "name": "其他", "name_en": "Other", "color": "#9b7ff2"},
]

_BY_KEY = {item["key"]: item for item in DISCIPLINES}

# 构件名称关键词（中英），顺序敏感：先匹配者生效。
# 注意避免子串误伤：不用 "water"（会误中 Waterproof）、不用 "light"（会误中 Lightweight）。
NAME_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("hvac", ("风管", "风阀", "风口", "空调", "duct", "hvac", "air terminal", "supply air", "exhaust air")),
    ("plumbing", ("给水", "排水", "污水", "雨水", "管道", "管", "pipe", "plumb", "sanitary", "sprinkler")),
    ("electrical", ("电缆", "桥架", "灯具", "插座", "配电", "cable", "lighting", "lamp", "elec", "switch")),
    ("structural", ("梁", "柱", "基础", "桁架", "beam", "column", "footing", "truss", "steel", "concrete", "reinforced", "structural")),
    ("architecture", ("墙", "楼板", "门", "窗", "屋面", "建筑", "幕墙", "竖梃", "横梃",
                     "wall", "slab", "door", "window", "mullion", "transom", "curtain wall",
                     "plaster", "gypsum", "brick", "stone", "insulation", "membrane", "finish", "air space", "waterproof")),
    ("site", ("场地", "总图", "景观", "site", "landscape")),
]

# IFC 类型前缀，顺序敏感。
TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "hvac",
        ("IfcDuct", "IfcAirTerminal", "IfcChiller", "IfcBoiler", "IfcDamper", "IfcFan", "IfcCoil"),
    ),
    ("plumbing", ("IfcPipe", "IfcSanitary", "IfcValve", "IfcPump", "IfcTank", "IfcWaste", "IfcStack", "IfcFireSuppression")),
    (
        "electrical",
        ("IfcCable", "IfcLight", "IfcElectric", "IfcOutlet", "IfcLamp", "IfcJunction", "IfcSwitchingDevice"),
    ),
    ("structural", ("IfcBeam", "IfcColumn", "IfcMember", "IfcFooting", "IfcPile", "IfcPlate", "IfcTruss", "IfcRailing")),
    (
        "architecture",
        (
            "IfcWall", "IfcSlab", "IfcRoof", "IfcWindow", "IfcDoor", "IfcStair", "IfcCovering",
            "IfcCurtainWall", "IfcRamp", "IfcFurnishing", "IfcBuildingElementProxy", "IfcSpace",
            "IfcBuildingElementPart", "IfcOpeningElement",
        ),
    ),
    ("site", ("IfcSite", "IfcCivil", "IfcGeographic")),
]

# 模型级：文件名 / 导出软件关键词 → 默认专业（作为构件级推断的兜底）。
MODEL_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("structural", ("struct", "结构")),
    ("hvac", ("hvac", "暖通", "通风", "mep")),
    ("plumbing", ("plumb", "给排水", "给水", "排水", "water")),
    ("electrical", ("elec", "电气", "强电", "弱电", "power")),
    ("site", ("site", "场地", "总图", "景观", "landscape")),
    ("architecture", ("arch", "建筑", "建", "arc")),
]


def definition(key: str) -> dict[str, str]:
    """返回专业定义（未知 key 归入「其他」）。"""
    return _BY_KEY.get(key, _BY_KEY["other"])


def rule_table(lang: str = "zh") -> dict[str, Any]:
    """导出规则表（供界面展示与后续可配置化），按语言本地化专业名。"""
    from app import i18n
    return {
        "disciplines": [i18n.localize_discipline(d, lang) for d in DISCIPLINES],
        "name_rules": [{"key": key, "keywords": list(words)} for key, words in NAME_RULES],
        "type_rules": [{"key": key, "prefixes": list(words)} for key, words in TYPE_RULES],
        "model_rules": [{"key": key, "keywords": list(words)} for key, words in MODEL_RULES],
    }


def classify_model(filename: str, exporter: str = "") -> dict[str, str]:
    """按文件名 / 导出软件关键词推断模型默认专业。"""
    haystack = f"{filename} {exporter}".lower()
    for key, keywords in MODEL_RULES:
        for word in keywords:
            if word.lower() in haystack:
                return {"key": key, "reason": f"文件名或导出软件含「{word}」"}
    return {"key": "other", "reason": "文件名与导出软件未匹配规则"}


def _in_curtain_wall(element: Any) -> bool:
    """构件是否被 IfcCurtainWall 聚合（幕墙框料 / 竖梃 / 横梃等）。

    幕墙框料在 IFC 中常以 IfcMember 表达，若只按类型会被误分为结构；
    这里通过 IfcRelAggregates 反向关系（Decomposes）判断其归属幕墙。
    """
    for rel in getattr(element, "Decomposes", []) or []:
        if rel.is_a("IfcRelAggregates"):
            parent = getattr(rel, "RelatingObject", None)
            if parent is not None and parent.is_a("IfcCurtainWall"):
                return True
    return False


def classify_element(element: Any, model_hint: str = "other") -> dict[str, str]:
    """按 命名 → IFC 类型 → 模型默认 推断单个构件专业。"""
    name = getattr(element, "Name", None) or ""
    ifc_type = element.is_a()

    # 洞口是依附主体的开洞虚体，名称常继承被穿透构件（如 DUCT 洞），
    # 直接归入建筑，避免随洞口名被误分到机电专业。
    if ifc_type == "IfcOpeningElement":
        return {"key": "architecture", "reason": "开洞虚体归建筑"}

    # 幕墙框料 / 竖梃等常以 IfcMember 表达，按类型会被误分为结构；
    # 只要归属 IfcCurtainWall 就归建筑，对齐幕墙属建筑专业的工程口径。
    if _in_curtain_wall(element):
        return {"key": "architecture", "reason": "归属幕墙构件归建筑"}

    for key, keywords in NAME_RULES:
        for word in keywords:
            if word in name or word.lower() in name.lower():
                return {"key": key, "reason": f"命名含「{word}」"}

    for key, prefixes in TYPE_RULES:
        for prefix in prefixes:
            if ifc_type.startswith(prefix):
                return {"key": key, "reason": f"IFC 类型 {ifc_type}"}

    if model_hint and model_hint != "other":
        return {"key": model_hint, "reason": f"按模型专业（{definition(model_hint)['name']}）兜底"}
    return {"key": "other", "reason": "未匹配任何规则"}


def make_classifier(model_hint: str) -> Callable[[Any], str]:
    """生成传给层级构建的分类回调（构件 → 专业 key）。"""
    return lambda element: classify_element(element, model_hint)["key"]
