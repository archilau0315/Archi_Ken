"""信息提取端点（M6）：默认列说明、内置 Definition 模板、提取运行与 Excel 导出。"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import i18n
from app.config import exports_dir
from app.routes.deps import open_model
from app.takeoff import export, extract
from app.takeoff.columns import ColumnError, FIXED_FIELDS, SUGGESTED_COLUMNS, localize_columns
from app.takeoff.definitions import CATEGORIES, DEFINITIONS, localize_definitions

router = APIRouter(prefix="/takeoff", tags=["takeoff"])


class TakeoffRunRequest(BaseModel):
    """信息提取请求体。"""

    path: str = Field(..., description="IFC 文件绝对路径")
    columns: list[dict[str, Any]] | None = Field(None, description="自定义计算列 [{key,name,expr}]")
    limit: int = Field(500, ge=1, le=5000, description="最多返回的行数")
    lang: str = Field("zh", description="语言：zh | en")
    ifc_types: list[str] | None = Field(None, description="按 IFC 类型过滤；空或缺省 = 全部")
    group_by: str | None = Field(None, description="分组字段：container | ifc_type；空 = 不分组")


class TakeoffExportRequest(BaseModel):
    """Excel 导出请求体。"""

    path: str = Field(..., description="IFC 文件绝对路径")
    columns: list[dict[str, Any]] | None = Field(None, description="自定义计算列 [{key,name,expr}]")
    lang: str = Field("zh", description="语言：zh | en")
    ifc_types: list[str] | None = Field(None, description="按 IFC 类型过滤；空或缺省 = 全部")
    group_by: str | None = Field(None, description="分组字段：container | ifc_type；空 = 不分组")


@router.get("/columns")
def takeoff_columns(lang: str = Query("zh")) -> dict[str, Any]:
    """列出固定字段、内置建议列与表达式可用函数。"""
    from app.takeoff.expr import FUNCTIONS_DOC

    locale = i18n.pick_lang(lang)
    return {
        "fixed": localize_columns(FIXED_FIELDS, locale),
        "suggested": localize_columns(SUGGESTED_COLUMNS, locale),
        "functions": FUNCTIONS_DOC,
    }


@router.get("/definitions")
def takeoff_definitions(lang: str = Query("zh")) -> dict[str, Any]:
    """列出内置信息提取模板（Solibri Definition 模式）。"""
    locale = i18n.pick_lang(lang)
    categories = [
        {
            "id": c["id"],
            "name": c["name_en"] if locale == "en" else c["name"],
        }
        for c in CATEGORIES
    ]
    return {
        "categories": categories,
        "items": localize_definitions(DEFINITIONS, locale),
    }


@router.post("/run")
def takeoff_run(payload: TakeoffRunRequest) -> dict[str, Any]:
    """对模型执行信息提取（固定字段 + 自定义列求值 + 可选过滤与分组）。"""
    model = open_model(payload.path)
    try:
        result = extract.run_takeoff(
            model,
            payload.path,
            payload.columns,
            payload.limit,
            ifc_types=payload.ifc_types,
            group_by=payload.group_by,
        )
        locale = i18n.pick_lang(payload.lang)
        result["columns"] = localize_columns(result["columns"], locale)
        return result
    except ColumnError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/export")
def takeoff_export(payload: TakeoffExportRequest) -> dict[str, Any]:
    """执行信息提取并导出为 Excel（.data/exports 下，原子写入）。"""
    model = open_model(payload.path)
    try:
        locale = i18n.pick_lang(payload.lang)
        result = extract.run_takeoff(
            model,
            payload.path,
            payload.columns,
            ifc_types=payload.ifc_types,
            group_by=payload.group_by,
        )
        result["columns"] = localize_columns(result["columns"], locale)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        target = exports_dir() / f"takeoff-{stamp}.xlsx"
        written = export.export_xlsx(result, target, locale)
    except ColumnError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"file": str(written), "total": result["total"], "expression_errors": result["expression_errors"]}


@router.get("/exports")
def takeoff_exports() -> dict[str, Any]:
    """列出已导出的 Excel 文件。"""
    base = exports_dir()
    items = sorted(
        ({"file": str(item), "name": item.name, "size": item.stat().st_size} for item in base.glob("*.xlsx")),
        key=lambda item: item["name"],
        reverse=True,
    )
    return {"total": len(items), "items": items}
