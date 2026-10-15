"""几何内核服务端点：包围盒、单构件网格、几何统计。"""

from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.federation.discipline import DISCIPLINES
from app.federation.merge import georef_offset
from app.geometry import extract
from app.routes.deps import open_model

router = APIRouter(prefix="/geometry", tags=["geometry"])

# 专业 key → 标准配色（与融合接口同源，网格模式按专业着色用）。
_DISCIPLINE_COLORS = {d["key"]: d["color"] for d in DISCIPLINES}


def _entries(path: str) -> tuple[dict[str, dict], bool]:
    return extract.load_or_extract(open_model(path), path)


def _center(bbox: list[float]) -> list[float]:
    return [round((bbox[i] + bbox[i + 3]) / 2, 6) for i in range(3)]


def _size(bbox: list[float]) -> list[float]:
    return [round(bbox[i + 3] - bbox[i], 6) for i in range(3)]


@router.get("/bboxes")
def geometry_bboxes(
    path: str = Query(..., description="IFC 文件绝对路径"),
    ifc_type: str | None = Query(None, description="按 IFC 类型过滤，如 IfcWall"),
    offset: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    """构件包围盒列表（分页）：供碰撞粗筛与空间索引使用。"""
    entries, cached = _entries(path)
    items = [
        {
            "guid": guid,
            "ifc_type": entry["ifc_type"],
            "discipline": entry.get("discipline"),
            "bbox": entry["bbox"],
            "center": _center(entry["bbox"]),
            "size": _size(entry["bbox"]),
            "triangle_count": len(entry["faces"]) // 3,
        }
        for guid, entry in entries.items()
        if ifc_type is None or entry["ifc_type"] == ifc_type
    ]
    return {
        "total": len(items),
        "offset": offset,
        "limit": limit,
        "cache_hit": cached,
        "items": items[offset : offset + limit],
    }


@router.get("/elements/{guid}")
def geometry_element(
    path: str = Query(...),
    guid: str = "",
    mesh: bool = Query(False, description="为 true 时返回顶点与三角面索引"),
) -> dict[str, Any]:
    """单个构件的几何：包围盒必返，网格按需返回。"""
    entries, _ = _entries(path)
    entry = entries.get(guid)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"构件无几何或 GUID 不存在：{guid}")
    result: dict[str, Any] = {
        "guid": guid,
        "ifc_type": entry["ifc_type"],
        "bbox": entry["bbox"],
        "center": _center(entry["bbox"]),
        "size": _size(entry["bbox"]),
        "triangle_count": len(entry["faces"]) // 3,
    }
    if mesh:
        result["verts"] = entry["verts"]
        result["faces"] = entry["faces"]
    return result


@router.get("/meshes")
def geometry_meshes(
    path: str = Query(..., description="IFC 文件绝对路径"),
    ifc_type: str | None = Query(None, description="按 IFC 类型过滤"),
    offset: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    """批量构件三角网格：一次返回多个构件的顶点与索引，供 3D 视图真实化显示。

    model_offset 为该模型的地理参考平移（东 / 北 / 高，米）：多模型叠加时前端按此偏移
    平移各网格，使不同模型对齐到同一空间；单模型或无地理参考时为零向量。
    """
    model = open_model(path)
    entries, cached = extract.load_or_extract(model, path)
    geo_offset, _ = georef_offset(model)
    items = [
        {
            "guid": guid,
            "ifc_type": entry["ifc_type"],
            "discipline": entry.get("discipline"),
            "discipline_color": _DISCIPLINE_COLORS.get(entry.get("discipline")),
            "ifc_color": entry.get("color"),
            "material": entry.get("material"),
            "bbox": entry["bbox"],
            "center": _center(entry["bbox"]),
            "size": _size(entry["bbox"]),
            "triangle_count": len(entry["faces"]) // 3,
            "verts": entry["verts"],
            "faces": entry["faces"],
        }
        for guid, entry in entries.items()
        if ifc_type is None or entry["ifc_type"] == ifc_type
    ]
    return {
        "total": len(items),
        "offset": offset,
        "limit": limit,
        "cache_hit": cached,
        "model_offset": geo_offset,
        "items": items[offset : offset + limit],
    }


@router.get("/stats")
def geometry_stats(path: str = Query(...)) -> dict[str, Any]:
    """几何提取统计：有几何的构件数、三角面总数、按类型分布。"""
    entries, cached = _entries(path)
    by_type = Counter(entry["ifc_type"] for entry in entries.values())
    return {
        "elements_with_geometry": len(entries),
        "triangles": sum(len(entry["faces"]) // 3 for entry in entries.values()),
        "vertices": sum(len(entry["verts"]) // 3 for entry in entries.values()),
        "by_type": dict(sorted(by_type.items())),
        "cache_hit": cached,
    }
