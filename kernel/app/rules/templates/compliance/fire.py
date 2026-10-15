"""消防规则模板（GB 55037-2022《建筑防火通用规范》/ GB 55036-2022《消防设施通用规范》）。

每条规则挂 reference 字段注明规范出处。
"""

from __future__ import annotations

from typing import Any

FIRE_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "fire-wall-rating",
        "name": "墙体防火等级",
        "name_en": "Wall Fire Rating",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "error",
        "target": {
            "ifc_type": ["IfcWall"],
            "where": [
                {"pset": "Pset_WallCommon", "prop": "IsExternal", "op": "==", "value": False}
            ],
        },
        "check": {"type": "property", "pset": "Pset_WallCommon", "prop": "FireRating", "op": "exists"},
        "message": "内墙 {name} 未定义防火等级",
        "message_en": "Interior wall {name} missing fire rating",
        "reference": "GB 55037-2022《建筑防火通用规范》（原 GB 50016-2014(2018年版)《建筑设计防火规范》）",
        "reference_en": "GB 55037-2022 General Fire Protection Code (formerly GB 50016-2014)",
    },
    {
        "id": "fire-door-rating",
        "name": "防火门等级",
        "name_en": "Fire Door Rating",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "warning",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {"type": "property", "pset": "Pset_DoorCommon", "prop": "FireRating", "op": "exists"},
        "message": "门 {name} 未定义防火等级",
        "message_en": "Door {name} missing fire rating",
        "reference": "GB 55037-2022《建筑防火通用规范》（原 GB 50016-2014(2018年版)：防火门设置要求）",
        "reference_en": "GB 55037-2022 (formerly GB 50016-2014: fire door requirements)",
    },
    {
        "id": "fire-escape-width",
        "name": "疏散通道宽度",
        "name_en": "Escape Route Width",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "error",
        "target": {
            "ifc_type": ["IfcSpace"],
            "where": [{"attr": "Name", "op": "contains", "value": "疏散"}],
        },
        "check": {"type": "dimension", "axis": "min", "value": 1400, "unit": "mm"},
        "message": "疏散通道 {name} 宽度 {actual} 小于要求 {expected}",
        "message_en": "Escape route {name} width {actual} below requirement {expected}",
        "reference": "GB 55037-2022《建筑防火通用规范》（原 GB 50016-2014(2018年版) 第 5.5.18 条）",
        "reference_en": "GB 55037-2022 (formerly GB 50016-2014 Clause 5.5.18)",
    },
    {
        "id": "fire-sprinkler-clearance",
        "name": "喷淋头间距",
        "name_en": "Sprinkler Spacing",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "warning",
        "target": {"ifc_type": ["IfcFireSuppressionTerminal"]},
        "check": {
            "type": "clearance",
            "other": {"ifc_type": ["IfcFireSuppressionTerminal"]},
            "axis": "all",
            "value": 2400,
            "unit": "mm",
        },
        "message": "喷淋头 {name} 与相邻喷淋头净距 {actual} 小于要求 {expected}",
        "message_en": "Sprinkler {name} clearance {actual} to neighbor below required {expected}",
        "reference": "GB 55036-2022《消防设施通用规范》（原 GB 50084-2017《自动喷水灭火系统设计规范》）",
        "reference_en": "GB 55036-2022 General Code for Fire Protection Facilities (formerly GB 50084-2017)",
    },
    {
        "id": "fire-door-self-closing",
        "name": "防火门自闭装置",
        "name_en": "Fire Door Self Closing",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "error",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {
            "type": "property",
            "pset": "Pset_DoorCommon",
            "prop": "SelfClosing",
            "op": "==",
            "value": True,
        },
        "message": "防火门 {name} 未配置自闭装置",
        "message_en": "Fire door {name} missing self-closing device",
        "reference": "GB 55037-2022《建筑防火通用规范》（原 GB 50016-2014(2018年版)：防火门应能自行关闭）",
        "reference_en": "GB 55037-2022 (formerly GB 50016-2014: fire doors shall be self-closing)",
    },
]
