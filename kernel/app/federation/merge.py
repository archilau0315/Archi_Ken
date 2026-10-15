"""多 IFC 文件融合为统一视图。

把多个模型打开后的构件合并成一张统一表：
- 坐标归一：几何输出已由 IfcOpenShell 统一为米；含地理参考时叠加投影偏移；
- GUID 冲突：同一 GUID 出现在多个模型时保留全部，用 `模型序号:guid` 组成 uid 区分；
- 专业分类：按命名 / IFC 类型 / 模型默认 自动映射（见 discipline.py）。
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

import ifcopenshell

from app import i18n
from app.federation import discipline
from app.geometry import extract
from app.ifc import summary


def georef_offset(model: ifcopenshell.file) -> tuple[list[float], bool]:
    """取地理参考的平移偏移（投影东/北/高，单位米）。无地理参考时为零并返回 False。

    IfcMapConversion 为 IFC4 实体，IFC2X3 下 by_type 抛 RuntimeError，捕获后按无地理参考处理。
    """
    try:
        conversions = model.by_type("IfcMapConversion")
    except RuntimeError:
        return [0.0, 0.0, 0.0], False
    if not conversions:
        return [0.0, 0.0, 0.0], False
    conversion = conversions[0]
    offset = [
        float(getattr(conversion, "Eastings", 0) or 0),
        float(getattr(conversion, "Northings", 0) or 0),
        float(getattr(conversion, "OrthogonalHeight", 0) or 0),
    ]
    return offset, True


def _apply(bbox: list[float], offset: list[float]) -> list[float]:
    """叠加地理参考平移偏移（米）。"""
    return [
        bbox[0] + offset[0],
        bbox[1] + offset[1],
        bbox[2] + offset[2],
        bbox[3] + offset[0],
        bbox[4] + offset[1],
        bbox[5] + offset[2],
    ]


def _center(bbox: list[float]) -> list[float]:
    return [round((bbox[i] + bbox[i + 3]) / 2, 6) for i in range(3)]


def _size(bbox: list[float]) -> list[float]:
    return [round(bbox[i + 3] - bbox[i], 6) for i in range(3)]


def _model_entry(index: int, path: str, model: ifcopenshell.file, normalize: bool, lang: str = "zh") -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """处理单个模型：返回其摘要条目与其几何构件列表。"""
    info = summary.summarize(model, path, lang)
    name = Path(path).name
    hint = discipline.classify_model(name, info["exporter"])
    # IfcOpenShell 的 create_shape 输出坐标已统一换算为米（内部应用了单位系数），
    # 这里不再按 unit_to_meter 二次换算，否则毫米声明模型会被缩小 1000 倍。
    offset, georef_applied = georef_offset(model) if normalize else ([0.0, 0.0, 0.0], False)

    geo, cache_hit = extract.load_or_extract(model, path)

    discipline_counts: dict[str, int] = {}
    geo_discipline_counts: dict[str, int] = {}
    items: list[dict[str, Any]] = []

    for product in model.by_type("IfcProduct"):
        key = discipline.classify_element(product, hint["key"])["key"]
        discipline_counts[key] = discipline_counts.get(key, 0) + 1

    for guid, entry in geo.items():
        element = model.by_guid(entry.get("parent_guid") or guid)
        key = discipline.classify_element(element, hint["key"])["key"]
        geo_discipline_counts[key] = geo_discipline_counts.get(key, 0) + 1
        bbox = _apply(entry["bbox"], offset)
        items.append(
            {
                "uid": f"{index}:{guid}",
                "guid": guid,
                "name": getattr(element, "Name", None),
                "ifc_type": entry["ifc_type"],
                "model": index,
                "model_name": name,
                "discipline": key,
                "discipline_name": i18n.pick_text(discipline.definition(key), "name", lang),
                "color": discipline.definition(key)["color"],
                "bbox": [round(value, 6) for value in bbox],
                "center": _center(bbox),
                "size": _size(bbox),
                "triangle_count": len(entry["faces"]) // 3,
                "material": entry.get("material"),
                "parent_guid": entry.get("parent_guid"),
            }
        )

    model_entry = {
        "index": index,
        "path": info["path"],
        "name": name,
        "schema": info["schema"],
        "exporter": info["exporter"],
        "project": info["project"],
        "unit_to_meter": info["unit_to_meter"],
        "georef_applied": georef_applied,
        "georeference": info["georeference"],
        "discipline_hint": hint,
        "products": info["products_total"],
        "geo_elements": len(geo),
        "disciplines": dict(sorted(discipline_counts.items(), key=lambda item: (-item[1], item[0]))),
        "geo_disciplines": dict(sorted(geo_discipline_counts.items(), key=lambda item: (-item[1], item[0]))),
        "geometry_cache_hit": cache_hit,
    }
    return model_entry, items


def _new_bucket(key: str, lang: str = "zh") -> dict[str, Any]:
    """新建一个专业聚合桶。"""
    info = discipline.definition(key)
    return {
        "key": key,
        "name": i18n.pick_text(info, "name", lang),
        "color": info["color"],
        "element_count": 0,
        "geo_count": 0,
        "models": [],
        "element_types": Counter(),
    }


def build(
    entries: list[tuple[int, str, ifcopenshell.file]],
    normalize: bool = True,
    limit: int = 2000,
    lang: str = "zh",
) -> dict[str, Any]:
    """融合多个模型为统一视图（构件表 + 专业聚合 + 冲突清单）。"""
    models: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    guid_models: dict[str, list[int]] = {}
    aggregate: dict[str, dict[str, Any]] = {}

    for index, path, model in entries:
        model_entry, model_items = _model_entry(index, path, model, normalize, lang)
        models.append(model_entry)

        # 先按模型全部构件口径建立专业桶
        for key, count in model_entry["disciplines"].items():
            bucket = aggregate.setdefault(key, _new_bucket(key, lang))
            bucket["element_count"] += count
            if index not in bucket["models"]:
                bucket["models"].append(index)

        items.extend(model_items)
        for item in model_items:
            guid_models.setdefault(item["guid"], []).append(index)
            bucket = aggregate.setdefault(item["discipline"], _new_bucket(item["discipline"], lang))
            bucket["geo_count"] += 1
            bucket["element_types"][item["ifc_type"]] += 1

    conflicts = [{"guid": guid, "models": sorted(indices)} for guid, indices in guid_models.items() if len(indices) > 1]

    discipline_list = []
    for bucket in aggregate.values():
        bucket["element_types"] = dict(sorted(bucket["element_types"].items(), key=lambda item: (-item[1], item[0])))
        discipline_list.append(bucket)
    discipline_list.sort(key=lambda item: (-item["element_count"], item["key"]))

    return {
        "models": models,
        "disciplines": discipline_list,
        "totals": {
            "models": len(models),
            "products": sum(model["products"] for model in models),
            "geo_elements": len(items),
            "disciplines": len(discipline_list),
            "guid_conflicts": len(conflicts),
        },
        "guid_conflicts": conflicts[:50],
        "elements": {"total": len(items), "limit": limit, "items": items[:limit]},
    }
