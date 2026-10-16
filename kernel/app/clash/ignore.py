"""碰撞忽略规则：决定一对构件是否跳过检测。

对齐 Solibri 的忽略规则（ignore rules）口径，支持：
- 同构件自身（同一 GUID）恒忽略；
- ignore_same_discipline：同专业对默认忽略（冲突矩阵常用默认值）；
- 显式规则条目：按类型对 / 按专业对 / 按构件 GUID 忽略（两侧可互换）。
  GUID 规则两种形态：单个 GUID = 白名单（该构件参与的所有碰撞不再报）；
  两个 GUID = 仅忽略这一对。多材质拆分条目（<guid>#mN）按其父 GUID 归一匹配。
纯函数、无外部依赖。
"""

from __future__ import annotations

from typing import Any


def _type_eq(actual: str, expected: str) -> bool:
    """IFC 类型匹配支持前缀（如 IfcDuct 命中 IfcDuctSegment）。"""
    return actual == expected or actual.startswith(expected)


def _guids_of(meta: dict) -> set:
    """构件参与 GUID 匹配的集合：条目键 + 父 GUID（拆分构造层归一到父构件）。"""
    result = {meta["guid"]}
    parent = meta.get("parent_guid")
    if parent:
        result.add(parent)
    return result


def _match(rule: dict[str, Any], a: dict, b: dict) -> bool:
    """单条忽略规则是否命中构件对（a、b 可互换）。"""
    guids = rule.get("guids")
    if guids:
        want = {item for item in guids if item}
        ga, gb = _guids_of(a), _guids_of(b)
        if len(want) == 1 and (want & ga or want & gb):
            return True
        if len(want) >= 2:
            first, second = list(want)[:2]
            if (first in ga and second in gb) or (second in ga and first in gb):
                return True

    type_a, type_b = rule.get("type_a"), rule.get("type_b")
    if type_a and type_b:
        forward = _type_eq(a["ifc_type"], type_a) and _type_eq(b["ifc_type"], type_b)
        backward = _type_eq(a["ifc_type"], type_b) and _type_eq(b["ifc_type"], type_a)
        if forward or backward:
            return True

    disc_a, disc_b = rule.get("discipline_a"), rule.get("discipline_b")
    if disc_a and disc_b:
        forward = a["discipline"] == disc_a and b["discipline"] == disc_b
        backward = a["discipline"] == disc_b and b["discipline"] == disc_a
        if forward or backward:
            return True
    return False


def should_ignore(a: dict, b: dict, rules: list[dict[str, Any]] | None, ignore_same_discipline: bool) -> bool:
    """构件对是否应被忽略。a、b 为 {guid, ifc_type, discipline} 元信息。"""
    if a["guid"] == b["guid"]:
        return True
    if ignore_same_discipline and a["discipline"] == b["discipline"]:
        return True
    for rule in rules or []:
        if _match(rule, a, b):
            return True
    return False
