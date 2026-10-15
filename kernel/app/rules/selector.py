"""构件选择器：按 IFC 类型与属性条件筛选规则的目标构件。

target 结构：
    {"ifc_type": ["IfcDoor"] 或 "*", "where": [条件,...]}
条件结构（两种取值来源）：
    {"pset": "Pset_DoorCommon", "prop": "IsExternal", "op": "==", "value": true}
    {"attr": "Name", "op": "contains", "value": "门"}
"""

from __future__ import annotations

from typing import Any

import ifcopenshell
import ifcopenshell.util.element

from app.rules import operators


def property_value(element: Any, spec: dict[str, Any]) -> Any:
    """按 spec 从构件取属性值；取不到返回 operators.MISSING。"""
    if "attr" in spec:
        value = getattr(element, spec["attr"], operators.MISSING)
        return value if value is not None else operators.MISSING

    psets = ifcopenshell.util.element.get_psets(element)
    pset = psets.get(spec.get("pset"))
    if not isinstance(pset, dict):
        return operators.MISSING
    prop = spec.get("prop")
    if prop in pset and pset[prop] is not None:
        return pset[prop]
    return operators.MISSING


def match_conditions(element: Any, where: list[dict[str, Any]]) -> bool:
    """全部条件均满足才命中。"""
    for cond in where:
        value = property_value(element, cond)
        if not operators.compare(cond.get("op", "=="), value, cond.get("value")):
            return False
    return True


def select(model: ifcopenshell.file, target: dict[str, Any]) -> list[dict[str, Any]]:
    """返回命中的构件列表（含 element 对象，供属性检查直接使用）。"""
    types = target.get("ifc_type") or ["*"]
    if isinstance(types, str):
        types = [types]
    where = target.get("where") or []

    candidates: list[Any] = []
    seen: set[str] = set()

    def push(element: Any) -> None:
        if element.is_a("IfcProduct") and element.GlobalId not in seen:
            seen.add(element.GlobalId)
            candidates.append(element)

    try:
        if "*" in types:
            for element in model.by_type("IfcProduct"):
                push(element)
        else:
            for ifc_type in types:
                for element in model.by_type(ifc_type):
                    push(element)
    except RuntimeError as exc:
        raise ValueError(f"未知的 IFC 类型：{types}") from exc

    return [
        {
            "guid": element.GlobalId,
            "name": getattr(element, "Name", None),
            "ifc_type": element.is_a(),
            "element": element,
        }
        for element in candidates
        if match_conditions(element, where)
    ]
