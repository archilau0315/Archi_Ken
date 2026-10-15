"""合规性检查预设规则集（M5）：把内置合规模板按域打包，供「一键套用」。

预设只声明分类（categories），规则由 templates.select_by_category 展开；
返回的 rules 已规范化，L4 可直接追加到规则集草稿。
"""

from __future__ import annotations

from typing import Any

from app import i18n
from app.rules import templates

_PRESETS: list[dict[str, Any]] = [
    {
        "id": "compliance-accessibility",
        "name": "无障碍检查",
        "name_en": "Accessibility Check",
        "description": "门净宽、坡道、无障碍卫生间、电梯、平台（GB 55019-2021）",
        "description_en": "Door/ramp/toilet/elevator/platform checks (GB 55019-2021)",
        "categories": ["无障碍"],
    },
    {
        "id": "compliance-headroom",
        "name": "净高检查",
        "name_en": "Headroom Check",
        "description": "房间 / 走道 / 楼梯 / 车库 / 卧室起居 / 地下室净高（GB 55031 / GB 55038 / JGJ 100）",
        "description_en": "Room/corridor/stair/garage/bedroom/basement headroom (GB 55031, GB 55038, JGJ 100)",
        "categories": ["净高"],
    },
    {
        "id": "compliance-fire",
        "name": "消防检查",
        "name_en": "Fire Safety Check",
        "description": "防火等级、自闭器、疏散宽度、喷淋净距（GB 55037 / GB 55036）",
        "description_en": "Fire rating, self-closing, escape width, sprinkler clearance (GB 55037, GB 55036)",
        "categories": ["消防"],
    },
    {
        "id": "compliance-evacuation",
        "name": "疏散检查",
        "name_en": "Evacuation Check",
        "description": "疏散门/楼梯/平台净宽、避难间、疏散走道管线（GB 55037 / GB 55031）",
        "description_en": "Egress door/stair/platform width, refuge room, corridor pipes (GB 55037, GB 55031)",
        "categories": ["疏散"],
    },
    {
        "id": "compliance-mep",
        "name": "机电检查",
        "name_en": "MEP Check",
        "description": "管线穿梁、水管桥架相交、喷头净距、井道尺寸（GB 55020 / GB 55024 / GB 55036 / GB 50243）",
        "description_en": "Pipe/duct through beams, pipe vs tray, sprinkler clearance, shaft sizes",
        "categories": ["机电"],
    },
    {
        "id": "compliance-structure",
        "name": "结构检查",
        "name_en": "Structure Check",
        "description": "柱/梁/剪力墙/楼板截面尺寸、构件编号（GB 55001 / GB 55002）",
        "description_en": "Column/beam/shear wall/slab sections, element tags (GB 55001, GB 55002)",
        "categories": ["结构"],
    },
    {
        "id": "compliance-openings",
        "name": "门窗检查",
        "name_en": "Doors & Windows Check",
        "description": "户门/卧室/厨房/卫生间门净宽、防火窗等级、门窗编号（GB 55038）",
        "description_en": "Room door widths, fire window rating, door/window tags (GB 55038)",
        "categories": ["门窗"],
    },
    {
        "id": "compliance-full",
        "name": "合规检查全套",
        "name_en": "Full Compliance Check",
        "description": "无障碍 + 净高 + 消防 + 疏散 + 机电 + 结构 + 门窗",
        "description_en": "Accessibility + Headroom + Fire + Evacuation + MEP + Structure + Openings",
        "categories": ["无障碍", "净高", "消防", "疏散", "机电", "结构", "门窗"],
    },
]


def list_presets(lang: i18n.Lang = "zh") -> list[dict[str, Any]]:
    """返回全部预设（含展开后的规则），按语言本地化。"""
    items: list[dict[str, Any]] = []
    for preset in _PRESETS:
        rules = templates.select_by_category(preset["categories"])
        items.append(
            {
                "id": preset["id"],
                "name": i18n.pick_text(preset, "name", lang),
                "description": i18n.pick_text(preset, "description", lang),
                "categories": [i18n.pick_text({"c": c}, "c", lang) for c in preset["categories"]],
                "rule_ids": [rule["id"] for rule in rules],
                "rules": i18n.localize_rules(rules, lang),
            }
        )
    return items
