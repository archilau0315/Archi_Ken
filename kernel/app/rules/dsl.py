"""规则 DSL v1：规则的结构化定义、解析与校验。

一条规则的最小结构：
    {
      "id": "door-min-width",
      "name": "门最小宽度",
      "severity": "error",                       # error / warning / info
      "target": {"ifc_type": ["IfcDoor"], "where": [...]},
      "check": {"type": "property", ...},         # property / intersection / clearance / duplicate / headroom / dimension / count / containment
      "message": "门宽 {actual} 小于最小要求 {expected}"   # 可选，支持占位符
    }
"""

from __future__ import annotations

from typing import Any

CHECK_TYPES = {"property", "intersection", "clearance", "duplicate", "headroom", "dimension", "count", "containment"}
SEVERITIES = {"error", "warning", "info"}


class RuleError(ValueError):
    """规则定义不合法。"""


def _require(raw: dict[str, Any], key: str) -> Any:
    if key not in raw or raw[key] in (None, "", [], {}):
        raise RuleError(f"规则缺少必填字段：{key}")
    return raw[key]


def parse_rule(raw: dict[str, Any]) -> dict[str, Any]:
    """校验并补全单条规则，返回规范化后的副本。"""
    if not isinstance(raw, dict):
        raise RuleError("规则必须是对象")

    _require(raw, "id")
    _require(raw, "target")
    check = _require(raw, "check")
    if not isinstance(check, dict):
        raise RuleError("check 必须是对象")
    if check.get("type") not in CHECK_TYPES:
        raise RuleError(f"不支持的检查类型：{check.get('type')}（可选 {sorted(CHECK_TYPES)}）")
    if not isinstance(raw["target"], dict):
        raise RuleError("target 必须是对象")

    severity = raw.get("severity", "error")
    if severity not in SEVERITIES:
        raise RuleError(f"severity 不合法：{severity}（可选 {sorted(SEVERITIES)}）")

    rule = dict(raw)
    rule["name"] = raw.get("name") or raw["id"]
    rule["category"] = raw.get("category") or "通用规则"
    rule["severity"] = severity
    return rule


def parse_rules(raw_list: Any) -> list[dict[str, Any]]:
    """校验并返回一组规则；id 不允许重复。"""
    if not isinstance(raw_list, list) or not raw_list:
        raise RuleError("rules 必须是非空数组")
    rules = [parse_rule(item) for item in raw_list]
    ids = [rule["id"] for rule in rules]
    if len(ids) != len(set(ids)):
        raise RuleError("规则 id 不能重复")
    return rules
