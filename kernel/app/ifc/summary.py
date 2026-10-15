"""IFC 文件摘要：schema 版本、导出方、长度单位、地理参考、构件统计。"""

from __future__ import annotations

from typing import Any

import ifcopenshell
import ifcopenshell.util.unit


def exporter(model: ifcopenshell.file, lang: str = "zh") -> str:
    """从文件头读取导出方信息（各软件写入的 originating_system / preprocessor_version）。"""
    file_name = getattr(model.header, "file_name", None)
    fields = []
    for attr in ("originating_system", "preprocessor_version"):
        value = getattr(file_name, attr, "") or ""
        if value.strip():
            fields.append(value.strip())
    unknown = "Unknown" if lang == "en" else "未知"
    return " / ".join(fields) if fields else unknown


def length_unit(model: ifcopenshell.file) -> dict[str, Any]:
    """读取项目长度单位定义（SI 单位前缀 + 单位名）。"""
    projects = model.by_type("IfcProject")
    units = []
    if projects and projects[0].UnitsInContext:
        units = list(projects[0].UnitsInContext.Units or [])

    for unit in units:
        unit_type = getattr(unit, "UnitType", None)
        if unit_type != "LENGTHUNIT":
            continue
        if unit.is_a("IfcSIUnit"):
            return {"kind": "SI", "prefix": unit.Prefix or "", "name": unit.Name or "METRE"}
        if unit.is_a("IfcConversionBasedUnit"):
            return {"kind": "CONVERSION_BASED", "prefix": "", "name": unit.Name or ""}
    return {"kind": "SI", "prefix": "", "name": "METRE"}


def unit_to_meter(model: ifcopenshell.file) -> float:
    """长度单位换算到米的系数（模型坐标 × 该系数 = 米）。"""
    return float(ifcopenshell.util.unit.calculate_unit_scale(model))


def georeference(model: ifcopenshell.file) -> dict[str, Any]:
    """读取地理参考（IfcMapConversion / IfcMapConversionScaled），无则返回 present=False。

    注意：IfcMapConversion 是 IFC4 实体，IFC2X3 schema 中不存在，直接 by_type 会抛 RuntimeError，
    这里捕获后按无地理参考处理。
    """
    try:
        conversions = model.by_type("IfcMapConversion")
    except RuntimeError:
        return {"present": False}
    if not conversions:
        return {"present": False}

    conversion = conversions[0]
    return {
        "present": True,
        "ifc_type": conversion.is_a(),
        "eastings": getattr(conversion, "Eastings", None),
        "northings": getattr(conversion, "Northings", None),
        "orthogonal_height": getattr(conversion, "OrthogonalHeight", None),
        "x_axis_abscissa": getattr(conversion, "XAxisAbscissa", None),
        "x_axis_ordinate": getattr(conversion, "XAxisOrdinate", None),
        "scale": getattr(conversion, "Scale", None),
    }


def project_info(model: ifcopenshell.file) -> dict[str, Any]:
    """项目基本信息。"""
    projects = model.by_type("IfcProject")
    if not projects:
        return {}
    project = projects[0]
    return {
        "guid": project.GlobalId,
        "name": project.Name,
        "phase": getattr(project, "Phase", None),
    }


def counts_by_type(model: ifcopenshell.file) -> dict[str, int]:
    """按 IFC 类型统计构件数量（以 IfcProduct 为口径，按数量降序）。"""
    counts: dict[str, int] = {}
    for product in model.by_type("IfcProduct"):
        key = product.is_a()
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def summarize(model: ifcopenshell.file, path: str, lang: str = "zh") -> dict[str, Any]:
    """组装 /ifc/summary 的响应体。"""
    counts = counts_by_type(model)
    return {
        "path": path,
        "schema": model.schema,
        "exporter": exporter(model, lang),
        "project": project_info(model),
        "length_unit": length_unit(model),
        "unit_to_meter": unit_to_meter(model),
        "georeference": georeference(model),
        "products_total": sum(counts.values()),
        "counts_by_type": counts,
    }
