"""防护规则模板（GB 55031-2022《民用建筑通用规范》/ GB 55038-2025《住宅项目规范》）。

栏杆/扶手高度按包围盒 Z 向尺寸判定；名称关键词定位（any_of 组内 OR，组间 AND）。
高度阈值一律 warning 级并标注「阈值待按现行规范原文复核」。
"""

from __future__ import annotations

from typing import Any

GUARD_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "guard-balcony-railing-height",
        "name": "阳台临空栏杆净高",
        "name_en": "Balcony Railing Min Height",
        "category": "防护",
        "category_en": "Guarding",
        "severity": "warning",
        "target": {
            "ifc_type": ["IfcRailing"],
            "where": [
                {
                    "any_of": [
                        {"attr": "Name", "op": "contains", "value": "阳台"},
                        {"attr": "Name", "op": "contains", "value": "露台"},
                        {"attr": "Name", "op": "contains", "value": "天台"},
                        {"attr": "Name", "op": "contains", "value": "屋面"},
                    ]
                }
            ],
        },
        "check": {"type": "dimension", "axis": "z", "value": 1050, "unit": "mm"},
        "message": "阳台栏杆 {name} 净高 {actual} 小于最小要求 {expected}（高层建筑应 1.10m，阈值待按现行规范原文复核）",
        "message_en": "Balcony railing {name} height {actual} below minimum {expected} (1.10m for high-rise, pending review)",
        "reference": "GB 55031-2022《民用建筑通用规范》（原 GB 50352-2019 第 6.7.3 条：临空栏杆净高不应小于 1.05m，高层 1.10m）",
        "reference_en": "GB 55031-2022 (formerly GB 50352-2019 Clause 6.7.3: guardrail ≥ 1.05m, 1.10m for high-rise)",
    },
    {
        "id": "guard-stair-handrail-height",
        "name": "楼梯扶手高度",
        "name_en": "Stair Handrail Height",
        "category": "防护",
        "category_en": "Guarding",
        "severity": "warning",
        "target": {
            "ifc_type": ["IfcRailing"],
            "where": [{"attr": "Name", "op": "contains", "value": "楼梯"}],
        },
        "check": {"type": "dimension", "axis": "z", "value": 900, "unit": "mm"},
        "message": "楼梯扶手 {name} 高度 {actual} 小于最小要求 {expected}（阈值待按现行规范原文复核）",
        "message_en": "Stair handrail {name} height {actual} below minimum {expected} (threshold pending code review)",
        "reference": "GB 55031-2022《民用建筑通用规范》（原 GB 50352-2019 第 6.7.7 条：室内楼梯扶手高度自踏步前缘线量起不宜小于 0.90m）",
        "reference_en": "GB 55031-2022 (formerly GB 50352-2019 Clause 6.7.7: indoor stair handrail ≥ 0.90m)",
    },
    {
        "id": "guard-railing-tag",
        "name": "栏杆编号完整性",
        "name_en": "Railing Tag",
        "category": "防护",
        "category_en": "Guarding",
        "severity": "info",
        "target": {"ifc_type": ["IfcRailing"]},
        "check": {"type": "property", "attr": "Tag", "op": "exists"},
        "message": "栏杆 {name} 未填写 Tag 编号",
        "message_en": "Railing {name} missing Tag",
        "reference": "BIM 交付数据完整性要求",
        "reference_en": "BIM deliverable data completeness",
    },
]
