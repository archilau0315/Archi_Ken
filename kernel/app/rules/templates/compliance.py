"""合规性检查规则模板（M5）：无障碍 / 净高 / 消防 三个专用规则集。

分类字段（category）与 presets.py 的合规预设一一对应：
    - 无障碍：门净宽、无障碍标识、通道净宽、门洞净高
    - 净高：房间 / 走道 / 梁下净高
    - 消防：防火等级、自闭器、疏散宽度、喷淋净距
"""

from __future__ import annotations

from typing import Any

# —— 无障碍 ——
_ACCESSIBILITY: list[dict[str, Any]] = [
    {
        "id": "access-door-clear-width",
        "name": "无障碍门净宽",
        "name_en": "Accessible Door Clear Width",
        "category": "无障碍",
        "category_en": "Accessibility",
        "severity": "error",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {
            "type": "property",
            "pset": "Pset_DoorCommon",
            "prop": "OverallWidth",
            "op": ">=",
            "value": 900,
            "unit": "mm",
            "missing": "violation",
        },
        "message": "门 {name} 净宽 {actual} 小于无障碍要求 {expected}",
        "message_en": "Door {name} clear width {actual} below accessibility requirement {expected}",
    },
    {
        "id": "access-door-handicap-flag",
        "name": "无障碍门标识",
        "name_en": "Accessible Door Flag",
        "category": "无障碍",
        "category_en": "Accessibility",
        "severity": "warning",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {
            "type": "property",
            "pset": "Pset_DoorCommon",
            "prop": "HandicapAccessible",
            "op": "==",
            "value": True,
        },
        "message": "门 {name} 未标记为无障碍门（HandicapAccessible）",
        "message_en": "Door {name} not marked as accessible (HandicapAccessible)",
    },
    {
        "id": "access-corridor-width",
        "name": "无障碍通道净宽",
        "name_en": "Accessible Corridor Width",
        "category": "无障碍",
        "category_en": "Accessibility",
        "severity": "warning",
        "target": {
            "ifc_type": ["IfcSpace"],
            "where": [{"attr": "Name", "op": "contains", "value": "走道"}],
        },
        "check": {"type": "dimension", "axis": "min", "value": 1200, "unit": "mm"},
        "message": "通道 {name} 净宽 {actual} 小于无障碍要求 {expected}",
        "message_en": "Corridor {name} clear width {actual} below accessibility requirement {expected}",
    },
    {
        "id": "access-opening-height",
        "name": "门洞净高",
        "name_en": "Door Opening Height",
        "category": "无障碍",
        "category_en": "Accessibility",
        "severity": "warning",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {"type": "dimension", "axis": "z", "value": 2000, "unit": "mm"},
        "message": "门 {name} 洞口净高 {actual} 小于要求 {expected}",
        "message_en": "Door {name} opening height {actual} below requirement {expected}",
    },
]

# —— 净高 ——
_HEADROOM: list[dict[str, Any]] = [
    {
        "id": "headroom-room",
        "name": "房间净高",
        "name_en": "Room Headroom",
        "category": "净高",
        "category_en": "Headroom",
        "severity": "error",
        "target": {
            "ifc_type": ["IfcSpace"],
            "where": [{"attr": "Name", "op": "contains", "value": "房间"}],
        },
        "check": {
            "type": "headroom",
            "other": {"ifc_type": ["IfcSlab", "IfcBeam", "IfcDuctSegment", "IfcCovering"]},
            "value": 2400,
            "unit": "mm",
        },
        "message": "房间 {name} 净高 {actual} 低于要求 {expected}",
        "message_en": "Room {name} headroom {actual} below requirement {expected}",
    },
    {
        "id": "headroom-corridor",
        "name": "走道净高",
        "name_en": "Corridor Headroom",
        "category": "净高",
        "category_en": "Headroom",
        "severity": "warning",
        "target": {
            "ifc_type": ["IfcSpace"],
            "where": [{"attr": "Name", "op": "contains", "value": "走道"}],
        },
        "check": {
            "type": "headroom",
            "other": {"ifc_type": ["IfcSlab", "IfcBeam", "IfcDuctSegment", "IfcCovering"]},
            "value": 2200,
            "unit": "mm",
        },
        "message": "走道 {name} 净高 {actual} 低于要求 {expected}",
        "message_en": "Corridor {name} headroom {actual} below requirement {expected}",
    },
    {
        "id": "headroom-beam-clearance",
        "name": "梁下净高",
        "name_en": "Beam Clearance",
        "category": "净高",
        "category_en": "Headroom",
        "severity": "info",
        "target": {"ifc_type": ["IfcSpace"]},
        "check": {"type": "headroom", "other": {"ifc_type": ["IfcBeam"]}, "value": 2000, "unit": "mm"},
        "message": "空间 {name} 梁下净高 {actual} 低于要求 {expected}",
        "message_en": "Space {name} beam clearance {actual} below requirement {expected}",
    },
]

# —— 消防 ——
_FIRE: list[dict[str, Any]] = [
    {
        "id": "fire-wall-rating",
        "name": "墙体防火等级必填",
        "name_en": "Wall Fire Rating Required",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "error",
        "target": {"ifc_type": ["IfcWall"]},
        "check": {"type": "property", "pset": "Pset_WallCommon", "prop": "FireRating", "op": "exists"},
        "message": "墙体 {name} 缺少防火等级（FireRating）",
        "message_en": "Wall {name} missing fire rating (FireRating)",
    },
    {
        "id": "fire-door-rating",
        "name": "防火门等级必填",
        "name_en": "Fire Door Rating Required",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "error",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {"type": "property", "pset": "Pset_DoorCommon", "prop": "FireRating", "op": "exists"},
        "message": "门 {name} 缺少防火等级（FireRating）",
        "message_en": "Door {name} missing fire rating (FireRating)",
    },
    {
        "id": "fire-door-self-closing",
        "name": "防火门自闭器",
        "name_en": "Fire Door Self-Closing",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "warning",
        "target": {"ifc_type": ["IfcDoor"]},
        "check": {
            "type": "property",
            "pset": "Pset_DoorCommon",
            "prop": "SelfClosing",
            "op": "==",
            "value": True,
        },
        "message": "门 {name} 未标记自闭器（SelfClosing）",
        "message_en": "Door {name} not marked self-closing (SelfClosing)",
    },
    {
        "id": "fire-sprinkler-clearance",
        "name": "喷淋头与梁净距",
        "name_en": "Sprinkler-Beam Clearance",
        "category": "消防",
        "category_en": "Fire Safety",
        "severity": "warning",
        "target": {"ifc_type": ["IfcFireSuppressionTerminal"]},
        "check": {"type": "clearance", "other": {"ifc_type": ["IfcBeam"]}, "axis": "all", "value": 300, "unit": "mm"},
        "message": "喷淋头 {name} 与梁 {related_name} 净距 {actual} 小于 {expected}",
        "message_en": "Sprinkler {name} to beam {related_name} clearance {actual} below {expected}",
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
    },
]

COMPLIANCE_TEMPLATES: list[dict[str, Any]] = _ACCESSIBILITY + _HEADROOM + _FIRE
