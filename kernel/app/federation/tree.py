"""融合后的模型树（M1）。

结构：融合根 → 每个模型源一个节点 → 该模型的空间层级（Project → Site → Building → Storey → Space），
各空间节点附带 elements_by_discipline 专业分布，便于同时查看「模型 / 专业 / 空间」三层信息。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ifcopenshell

from app.federation import discipline
from app.ifc import hierarchy, summary


def build(entries: list[tuple[int, str, ifcopenshell.file]], max_depth: int = 8) -> dict[str, Any]:
    """构建融合模型树。"""
    roots: list[dict[str, Any]] = []
    for index, path, model in entries:
        name = Path(path).name
        hint = discipline.classify_model(name, summary.exporter(model))
        classifier = discipline.make_classifier(hint["key"])
        sub_tree = hierarchy.build_hierarchy(model, max_depth, classify=classifier)
        roots.append(
            {
                "kind": "model",
                "key": f"model:{index}",
                "name": name,
                "path": path,
                "ifc_type": None,
                "element_total": len(model.by_type("IfcProduct")),
                "discipline_hint": hint,
                "children": sub_tree["roots"],
            }
        )
    return {"max_depth": max_depth, "roots": roots}
