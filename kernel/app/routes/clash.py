"""碰撞检测端点：硬碰撞单次运行 + 冲突矩阵（专业两两对检，含分类与忽略规则）。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app import i18n
from app.clash import engine, matrix
from app.geometry import extract
from app.ifc import summary as ifc_summary
from app.routes.deps import open_model
from app.rules import operators

router = APIRouter(prefix="/clash", tags=["clash"])


class PairSelection(BaseModel):
    """自定义构件对选择集：两个条件同时给出时取交集；均为空等价不过滤。"""

    ifc_types: list[str] | None = Field(None, description="IFC 类型过滤，支持前缀（如 IfcDuct 命中 IfcDuctSegment）")
    storeys: list[str] | None = Field(None, description="楼层名过滤（精确匹配楼层 Name）")


class MatrixRequest(BaseModel):
    """冲突矩阵请求体。阈值单位为 mm（由内核按模型单位换算）。"""

    path: str = Field(..., description="IFC 文件绝对路径")
    hard: bool = Field(True, description="是否启用硬碰撞")
    gap_mm: float | None = Field(None, ge=0, description="间隙（软碰撞）容差，单位 mm；None 表示关闭")
    clearance_mm: float | None = Field(None, ge=0, description="净空要求值，单位 mm；None 表示关闭")
    duplicate_overlap: float | None = Field(None, ge=0, le=1, description="重复构件重合度阈值（0~1，包围盒交集体积/较小体积）；None 表示关闭")
    ignore_same_discipline: bool = Field(True, description="是否忽略同专业构件对")
    ignore: list[dict[str, Any]] | None = Field(None, description="忽略规则：type_a/type_b、discipline_a/discipline_b、guids")
    cells: dict[str, dict[str, bool]] | None = Field(None, description="按单元格启停，键为 discipline_a|discipline_b")
    selection_a: PairSelection | None = Field(None, description="自定义构件对 A 侧选择集；与 selection_b 至少给一个才生效")
    selection_b: PairSelection | None = Field(None, description="自定义构件对 B 侧选择集；缺省表示对侧为全集")
    merge_mm: float | None = Field(None, ge=0, description="邻近碰撞合并半径，单位 mm；None 表示不合并")
    max_clashes: int = Field(200, ge=1, le=5000, description="最多返回的问题条数")
    lang: str | None = Field(None, description="返回语言：zh（默认）/ en")


@router.get("/run")
def clash_run(
    path: str = Query(..., description="IFC 文件绝对路径"),
    ifc_type_a: str | None = Query(None, description="A 侧构件类型，如 IfcWall"),
    ifc_type_b: str | None = Query(None, description="B 侧构件类型，如 IfcDuctSegment"),
    max_clashes: int = Query(200, ge=1, le=5000),
) -> dict[str, Any]:
    """对模型内构件做硬碰撞检测，返回碰撞清单与统计。"""
    model = open_model(path)
    entries, cached = extract.load_or_extract(model, path)
    result = engine.run(model, entries, ifc_type_a, ifc_type_b, max_clashes)
    result["elements_with_geometry"] = len(entries)
    result["cache_hit"] = cached
    return result


@router.post("/matrix")
def clash_matrix(payload: MatrixRequest) -> dict[str, Any]:
    """冲突矩阵：按专业两两对检，分类为硬碰撞 / 间隙 / 净空，支持忽略规则与单元格启停。"""
    model = open_model(payload.path)
    entries, cached = extract.load_or_extract(model, payload.path)
    unit_to_meter = ifc_summary.unit_to_meter(model)
    options: dict[str, Any] = {
        "hard": payload.hard,
        "gap": operators.to_model_units(payload.gap_mm, "mm", unit_to_meter) if payload.gap_mm is not None else None,
        "clearance": (
            operators.to_model_units(payload.clearance_mm, "mm", unit_to_meter)
            if payload.clearance_mm is not None
            else None
        ),
        "ignore_same_discipline": payload.ignore_same_discipline,
        "ignore": payload.ignore,
        "cells": payload.cells,
        "duplicate_overlap": payload.duplicate_overlap,
        "selection_a": payload.selection_a.model_dump() if payload.selection_a else None,
        "selection_b": payload.selection_b.model_dump() if payload.selection_b else None,
        "merge_dist": (
            operators.to_model_units(payload.merge_mm, "mm", unit_to_meter)
            if payload.merge_mm is not None
            else None
        ),
        "max_clashes": payload.max_clashes,
    }
    result = matrix.run(model, entries, options, payload.path, i18n.pick_lang(payload.lang))
    result["elements_with_geometry"] = len(entries)
    result["cache_hit"] = cached
    return result
