"""构件列表查询与属性提取。"""

from __future__ import annotations

from typing import Any

import ifcopenshell
import ifcopenshell.util.element


def list_elements(
    model: ifcopenshell.file,
    ifc_type: str | None = None,
    offset: int = 0,
    limit: int = 100,
) -> dict[str, Any]:
    """按 IFC 类型分页列出构件（默认以 IfcProduct 为口径）。"""
    elements = model.by_type(ifc_type) if ifc_type else model.by_type("IfcProduct")
    return {
        "total": len(elements),
        "offset": offset,
        "limit": limit,
        "items": [
            {"guid": element.GlobalId, "name": getattr(element, "Name", None), "ifc_type": element.is_a()}
            for element in elements[offset : offset + limit]
        ],
    }


def _brief(element: Any | None) -> dict[str, Any] | None:
    if element is None:
        return None
    return {
        "guid": getattr(element, "GlobalId", None),
        "name": getattr(element, "Name", None),
        "ifc_type": element.is_a(),
    }


def element_detail(model: ifcopenshell.file, guid: str) -> dict[str, Any]:
    """提取单个构件的标识、类型对象、所在空间与属性集。

    对多材质拆分的子构件（guid 含 #mN 后缀），去掉后缀查父构件。
    """
    real_guid = guid.split("#", 1)[0]
    element = model.by_guid(real_guid)
    if element is None:
        raise KeyError(f"未找到构件：{guid}")

    return {
        "guid": element.GlobalId,
        "name": getattr(element, "Name", None),
        "ifc_type": element.is_a(),
        "description": getattr(element, "Description", None),
        "object_type": getattr(element, "ObjectType", None),
        "tag": getattr(element, "Tag", None),
        "type_object": _brief(ifcopenshell.util.element.get_type(element)),
        "container": _brief(ifcopenshell.util.element.get_container(element)),
        "psets": ifcopenshell.util.element.get_psets(element),
    }
