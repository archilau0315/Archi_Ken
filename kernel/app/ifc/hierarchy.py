"""IFC 空间层级树构建（Project → Site → Building → Storey → Space 等）。"""

from __future__ import annotations

from typing import Any, Callable, Iterator

import ifcopenshell

SPATIAL_TYPES = {
    "IfcProject",
    "IfcSite",
    "IfcBuilding",
    "IfcBuildingStorey",
    "IfcSpace",
    "IfcSpatialZone",
}


def _decomposed_children(element: Any) -> Iterator[Any]:
    """向下分解出的子节点（IfcRelAggregates）。"""
    for relation in getattr(element, "IsDecomposedBy", None) or []:
        for child in relation.RelatedObjects or []:
            yield child


def _contained_elements(element: Any) -> Iterator[Any]:
    """直接包含在空间节点内的构件（IfcRelContainedInSpatialStructure）。"""
    for relation in getattr(element, "ContainsElements", None) or []:
        for child in relation.RelatedElements or []:
            yield child


def _is_spatial(element: Any) -> bool:
    return element.is_a() in SPATIAL_TYPES or element.is_a("IfcSpatialElement")


def _element_breakdown(element: Any, classify: Callable[[Any], str] | None) -> tuple[int, dict[str, int], dict[str, int] | None]:
    counts: dict[str, int] = {}
    by_discipline: dict[str, int] | None = {} if classify else None
    for child in _contained_elements(element):
        key = child.is_a()
        counts[key] = counts.get(key, 0) + 1
        if by_discipline is not None:
            discipline_key = classify(child)
            by_discipline[discipline_key] = by_discipline.get(discipline_key, 0) + 1
    sorted_counts = dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))
    if by_discipline is not None:
        by_discipline = dict(sorted(by_discipline.items(), key=lambda item: (-item[1], item[0])))
    return sum(counts.values()), sorted_counts, by_discipline


def _build_node(element: Any, depth: int, max_depth: int, classify: Callable[[Any], str] | None) -> dict[str, Any]:
    children: list[dict[str, Any]] = []
    if depth < max_depth:
        for child in _decomposed_children(element):
            if _is_spatial(child):
                children.append(_build_node(child, depth + 1, max_depth, classify))

    element_total, elements_by_type, elements_by_discipline = _element_breakdown(element, classify)
    node = {
        "guid": element.GlobalId,
        "name": getattr(element, "Name", None),
        "ifc_type": element.is_a(),
        "depth": depth,
        "element_total": element_total,
        "elements_by_type": elements_by_type,
        "children": children,
    }
    if elements_by_discipline is not None:
        node["elements_by_discipline"] = elements_by_discipline
    return node


def build_hierarchy(
    model: ifcopenshell.file,
    max_depth: int = 8,
    classify: Callable[[Any], str] | None = None,
) -> dict[str, Any]:
    """构建空间层级树。传入 classify 时，节点附带 elements_by_discipline 专业分布。"""
    nodes = [_build_node(project, 0, max_depth, classify) for project in model.by_type("IfcProject")]
    return {"max_depth": max_depth, "roots": nodes}
