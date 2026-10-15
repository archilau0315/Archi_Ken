"""IFC 解析服务端点。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.ifc import hierarchy, properties, summary
from app.routes.deps import open_model

router = APIRouter(prefix="/ifc", tags=["ifc"])


@router.get("/summary")
def ifc_summary(
    path: str = Query(..., description="IFC 文件绝对路径"),
    lang: str = Query("zh"),
) -> dict[str, Any]:
    """文件摘要：schema、导出方、单位、地理参考、构件统计。"""
    model = open_model(path)
    return summary.summarize(model, path, lang)


@router.get("/hierarchy")
def ifc_hierarchy(
    path: str = Query(...),
    max_depth: int = Query(8, ge=1, le=32),
) -> dict[str, Any]:
    """空间层级树。"""
    model = open_model(path)
    return hierarchy.build_hierarchy(model, max_depth)


@router.get("/elements")
def ifc_elements(
    path: str = Query(...),
    ifc_type: str | None = Query(None, description="按 IFC 类型过滤，如 IfcWall"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> dict[str, Any]:
    """构件列表（分页）。"""
    model = open_model(path)
    try:
        return properties.list_elements(model, ifc_type, offset, limit)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=f"未知的 IFC 类型：{ifc_type}") from exc


@router.get("/elements/{guid}")
def ifc_element_detail(path: str = Query(...), guid: str = "") -> dict[str, Any]:
    """单个构件详情：类型对象、所在空间、属性集。"""
    model = open_model(path)
    try:
        return properties.element_detail(model, guid)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
