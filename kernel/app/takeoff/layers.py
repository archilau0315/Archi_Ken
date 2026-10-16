"""构造层角色（Layer Role）推断。

复合墙 / 幕墙的各构造层工程口径不同：结构层按体积，保温层按面积 + 体积，
抹灰 / 防水 / 饰面层按面积。按层名 / 材质名关键词推断角色，供信息提取按角色分组，
各组只汇总自洽的量，避免把体积与面积混加（对齐 Solibri ITO 的分组思路）。

规则表集中在 # 处，纯配置，便于后续扩展或由界面覆盖。
"""

from __future__ import annotations

# 角色定义：key 为内部标识，name / name_en 为界面显示名（按此顺序展示）。
LAYER_ROLES: list[dict[str, str]] = [
    {"key": "structural", "name": "结构层", "name_en": "Structural layer"},
    {"key": "insulation", "name": "保温层", "name_en": "Insulation layer"},
    {"key": "waterproof", "name": "防水层", "name_en": "Waterproof layer"},
    {"key": "plaster", "name": "抹灰找平层", "name_en": "Plaster / screed layer"},
    {"key": "finish", "name": "饰面 / 面板层", "name_en": "Finish / panel layer"},
    {"key": "air", "name": "空气层", "name_en": "Air layer"},
    {"key": "other", "name": "其他层", "name_en": "Other layer"},
]

_BY_KEY = {item["key"]: item for item in LAYER_ROLES}

# 层名 / 材质名关键词（中英），顺序敏感：先匹配者生效。
# 保温 / 防水排在抹灰之前 —— 「保温砂浆」归保温、「防水砂浆」归防水，不能误归抹灰。
ROLE_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "insulation",
        ("保温", "隔热", "挤塑", "聚苯", "岩棉", "玻璃棉", "矿棉", "发泡", "聚氨酯", "泡沫",
         "insulation", "rockwool", "mineral wool", "xps", "eps", "foam", "aerogel"),
    ),
    ("waterproof", ("防水", "卷材", "涂膜", "沥青", "止水", "waterproof", "membrane", "bitumen", "sbs")),
    ("plaster", ("抹灰", "砂浆", "找平", "石膏", "腻子", "粉刷", "plaster", "mortar", "screed", "gypsum", "render")),
    (
        "finish",
        ("涂料", "面砖", "瓷砖", "石材", "饰面", "油漆", "壁纸", "墙纸", "铝板", "玻璃", "面板",
         "tile", "paint", "wallpaper", "cladding", "panel", "glass"),
    ),
    (
        "structural",
        ("混凝土", "砼", "砖", "砌块", "砌体", "钢筋", "钢", "木结构", "素土", "夯实",
         "concrete", "brick", "masonry", "blockwork", "steel", "timber", "structural"),
    ),
    ("air", ("空气层", "空腔", "空隙", "air space", "air gap", "cavity", "void")),
]

# 各角色的汇总口径：小计只累加该角色真正需要的量，避免体积与面积混加。
ROLE_QUANTITIES: dict[str, tuple[str, ...]] = {
    "structural": ("volume",),
    "insulation": ("area", "volume"),
    "waterproof": ("area",),
    "plaster": ("area",),
    "finish": ("area",),
    "air": (),
    "other": ("area", "volume"),
}


def role_name(key: str, lang: str = "zh") -> str:
    """返回角色显示名（未知 key 归「其他层」）。"""
    item = _BY_KEY.get(key, _BY_KEY["other"])
    return item["name_en"] if (lang or "").lower().startswith("en") else item["name"]


def classify_layer(name: str | None) -> str:
    """按层名 / 材质名推断构造层角色（未匹配归 other）。"""
    text = (name or "").strip()
    if not text:
        return "other"
    lower = text.lower()
    for key, keywords in ROLE_RULES:
        for word in keywords:
            if word in text or word in lower:
                return key
    return "other"


def rule_table(lang: str = "zh") -> list[dict[str, object]]:
    """导出角色表（含各角色汇总口径），供界面展示与后续可配置化。"""
    return [
        {"key": item["key"], "name": role_name(item["key"], lang), "quantities": list(ROLE_QUANTITIES.get(item["key"], ()))}
        for item in LAYER_ROLES
    ]
