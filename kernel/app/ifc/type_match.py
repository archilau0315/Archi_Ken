"""IFC 类型跨版本匹配：IFC2x3 泛型流构件回退。

IFC2x3 没有 IFC4 的机电细分类型（IfcDuctSegment / IfcPipeSegment 等），
风管 / 水管 / 桥架统一建模为 IfcFlowSegment / IfcFlowFitting，靠 ObjectType
文本区分（如 "Duct Segment"、"Pipe Segment"）。本模块提供统一别名表与
匹配函数，供信息提取 / 碰撞矩阵 / 忽略规则 / 合规规则选择器共用，
避免各处各自实现导致口径漂移。
"""

from __future__ import annotations

from typing import Any

# IFC4 细分类型 → (IFC2x3 泛型, ObjectType 小写关键词)
FLOW_TYPE_ALIASES: dict[str, tuple[str, str]] = {
    "IfcDuctSegment": ("IfcFlowSegment", "duct"),
    "IfcDuctFitting": ("IfcFlowFitting", "duct"),
    "IfcPipeSegment": ("IfcFlowSegment", "pipe"),
    "IfcPipeFitting": ("IfcFlowFitting", "pipe"),
    "IfcCableCarrierSegment": ("IfcFlowSegment", "cable"),
    "IfcCableCarrierFitting": ("IfcFlowFitting", "cable"),
}


def alias_for(wanted: str) -> tuple[str, str] | None:
    """wanted 为 IFC4 机电细分类型时返回 (泛型, 关键词)；否则 None。"""
    return FLOW_TYPE_ALIASES.get(wanted)


def matches_string(actual: str, wanted: str, object_type: str = "", prefix: bool = False) -> bool:
    """字符串级类型匹配（无元素对象时使用）。

    精确命中（可选前缀）优先；未命中且 actual 是 IFC2x3 泛型流构件时，
    按 wanted 的别名关键词在 object_type 中判定。object_type 为空串时不回退
    （无法区分风管 / 水管，宁缺毋滥，避免跨类别误报）。
    """
    if actual == wanted or (prefix and actual.startswith(wanted)):
        return True
    alias = FLOW_TYPE_ALIASES.get(wanted)
    if alias is None and prefix:
        # 前缀简写（如 IfcDuct）未直接命中时，沿用其覆盖的别名键做泛型回退；
        # 仅在精确 / 前缀都失败后才会走到这里，不会误放大普通类型。
        alias = next((v for k, v in FLOW_TYPE_ALIASES.items() if k.startswith(wanted)), None)
    if alias is None or actual != alias[0]:
        return False
    text = object_type.lower()
    return bool(text) and alias[1] in text


def matches_element(element: Any, wanted: str, prefix: bool = False) -> bool:
    """元素级类型匹配：先取叶子类型精确 / 前缀，再走 IFC2x3 泛型回退。"""
    return matches_string(
        element.is_a(),
        wanted,
        getattr(element, "ObjectType", None) or "",
        prefix,
    )
