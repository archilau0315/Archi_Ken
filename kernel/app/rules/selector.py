"""构件选择器：按 IFC 类型与属性条件筛选规则的目标构件。

target 结构：
    {"ifc_type": ["IfcDoor"] 或 "*", "where": [条件,...]}
条件结构（两种取值来源）：
    {"pset": "Pset_DoorCommon", "prop": "IsExternal", "op": "==", "value": true}
    {"attr": "Name", "op": "contains", "value": "门"}
OR 条件组（组内任一满足即算该条件满足，多条件之间仍是 AND）：
    {"any_of": [{"attr": "Name", "op": "contains", "value": "卫生间"},
                {"attr": "Name", "op": "contains", "value": "浴室"}]}
"""

from __future__ import annotations

from typing import Any

import ifcopenshell
import ifcopenshell.util.element

from app.ifc.type_match import alias_for
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


def _match_single(element: Any, cond: dict[str, Any]) -> bool:
    """单个条件判定；any_of 组内任一满足即算满足（支持嵌套普通条件）。"""
    sub = cond.get("any_of")
    if isinstance(sub, list) and sub:
        return any(_match_single(element, item) for item in sub if isinstance(item, dict))
    value = property_value(element, cond)
    return operators.compare(cond.get("op", "=="), value, cond.get("value"))


def match_conditions(element: Any, where: list[dict[str, Any]]) -> bool:
    """全部条件均满足才命中（条件之间为 AND，any_of 组内为 OR）。"""
    return all(_match_single(element, cond) for cond in where)


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
                try:
                    candidates_iter = model.by_type(ifc_type)
                except RuntimeError:
                    candidates_iter = None
                if candidates_iter is not None:
                    for element in candidates_iter:
                        push(element)
                    continue
                # 类型在当前 IFC 版本不存在（如 IFC2x3 无 IfcDuctSegment）：
                # 机电细分类型回退到 IFC2x3 泛型流构件 + ObjectType 关键词判定；
                # 无别名（普通建筑类型）视为无匹配。
                alias = alias_for(ifc_type)
                if alias is None:
                    continue
                generic, keyword = alias
                try:
                    generic_iter = model.by_type(generic)
                except RuntimeError:
                    continue
                for element in generic_iter:
                    object_type = (getattr(element, "ObjectType", None) or "").lower()
                    if object_type and keyword in object_type:
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
