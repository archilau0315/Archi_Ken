"""规范符合性模板聚合：无障碍 + 净高 + 消防 + 疏散。

按域拆分至子模块（accessibility / headroom / fire / evacuation），
本模块仅汇总，保持对外接口 COMPLIANCE_TEMPLATES 不变。
"""

from __future__ import annotations

from typing import Any

from app.rules.templates.compliance.accessibility import ACCESSIBILITY_TEMPLATES
from app.rules.templates.compliance.evacuation import EVACUATION_TEMPLATES
from app.rules.templates.compliance.fire import FIRE_TEMPLATES
from app.rules.templates.compliance.headroom import HEADROOM_TEMPLATES

COMPLIANCE_TEMPLATES: list[dict[str, Any]] = (
    ACCESSIBILITY_TEMPLATES + HEADROOM_TEMPLATES + FIRE_TEMPLATES + EVACUATION_TEMPLATES
)
