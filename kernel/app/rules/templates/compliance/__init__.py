"""规范符合性模板聚合：无障碍 + 净高 + 消防 + 疏散 + 机电 + 结构 + 门窗 + 空间 + 防护。

按域拆分至子模块，本模块仅汇总，保持对外接口 COMPLIANCE_TEMPLATES 不变。
"""

from __future__ import annotations

from typing import Any

from app.rules.templates.compliance.accessibility import ACCESSIBILITY_TEMPLATES
from app.rules.templates.compliance.evacuation import EVACUATION_TEMPLATES
from app.rules.templates.compliance.fire import FIRE_TEMPLATES
from app.rules.templates.compliance.guard import GUARD_TEMPLATES
from app.rules.templates.compliance.headroom import HEADROOM_TEMPLATES
from app.rules.templates.compliance.mep import MEP_TEMPLATES
from app.rules.templates.compliance.openings import OPENINGS_TEMPLATES
from app.rules.templates.compliance.space import SPACE_TEMPLATES
from app.rules.templates.compliance.structure import STRUCTURE_TEMPLATES

COMPLIANCE_TEMPLATES: list[dict[str, Any]] = (
    ACCESSIBILITY_TEMPLATES
    + HEADROOM_TEMPLATES
    + FIRE_TEMPLATES
    + EVACUATION_TEMPLATES
    + MEP_TEMPLATES
    + STRUCTURE_TEMPLATES
    + OPENINGS_TEMPLATES
    + SPACE_TEMPLATES
    + GUARD_TEMPLATES
)
