"""内置规则模板聚合：通用模板（common）+ 合规专用模板（compliance）。

builtin_rules() 返回全部规范化副本；select_rules 按 id 取子集；
select_by_category 按分类取子集（供合规预设按域取规则）。
"""

from __future__ import annotations

import copy
from typing import Any

from app.rules import dsl
from app.rules.templates import common, compliance


def _raw() -> list[dict[str, Any]]:
    return common.COMMON_TEMPLATES + compliance.COMPLIANCE_TEMPLATES


def builtin_rules() -> list[dict[str, Any]]:
    """返回全部内置模板的规范化副本。"""
    return dsl.parse_rules(copy.deepcopy(_raw()))


def select_rules(rule_ids: list[str] | None) -> list[dict[str, Any]]:
    """按 id 取内置模板子集；rule_ids 为空则返回全部。未知 id 报错。"""
    rules = builtin_rules()
    if not rule_ids:
        return rules
    index = {rule["id"]: rule for rule in rules}
    unknown = [rid for rid in rule_ids if rid not in index]
    if unknown:
        raise dsl.RuleError(f"未知的模板 id：{unknown}（可选 {sorted(index)}）")
    return [index[rid] for rid in rule_ids]


def select_by_category(categories: list[str]) -> list[dict[str, Any]]:
    """按分类取内置模板子集（保持内置顺序）。"""
    wanted = set(categories)
    return [rule for rule in builtin_rules() if rule.get("category") in wanted]
