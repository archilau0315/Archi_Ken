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
        "description": "门净宽、无障碍标识、通道净宽、门洞净高",
        "description_en": "Door clear width, accessibility flag, corridor width, door opening height",
        "categories": ["无障碍"],
    },
    {
        "id": "compliance-headroom",
        "name": "净高检查",
        "name_en": "Headroom Check",
        "description": "房间 / 走道 / 梁下净高",
        "description_en": "Room / corridor / beam clearance headroom",
        "categories": ["净高"],
    },
    {
        "id": "compliance-fire",
        "name": "消防检查",
        "name_en": "Fire Safety Check",
        "description": "防火等级、自闭器、疏散宽度、喷淋净距",
        "description_en": "Fire rating, self-closing, escape width, sprinkler clearance",
        "categories": ["消防"],
    },
    {
        "id": "compliance-full",
        "name": "合规检查全套",
        "name_en": "Full Compliance Check",
        "description": "无障碍 + 净高 + 消防",
        "description_en": "Accessibility + Headroom + Fire Safety",
        "categories": ["无障碍", "净高", "消防"],
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
