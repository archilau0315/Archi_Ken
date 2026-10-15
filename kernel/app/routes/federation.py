"""模型加载与融合（M1）端点：专业分类规则、多模型融合、融合模型树。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import i18n
from app.federation import discipline, merge, tree
from app.routes.deps import open_model

router = APIRouter(prefix="/federation", tags=["federation"])


class FederationRequest(BaseModel):
    """多模型融合请求体。"""

    paths: list[str] = Field(..., min_length=1, description="待融合的 IFC 文件绝对路径列表")
    normalize: bool = Field(True, description="是否按单位/地理参考归一坐标（换算到米）")
    max_depth: int = Field(8, ge=1, le=32, description="模型树最大深度")
    limit: int = Field(2000, ge=1, le=20000, description="融合构件表最多返回的条数")
    lang: str | None = Field(None, description="返回语言：zh（默认）/ en")


def _open_all(paths: list[str]) -> list[tuple[int, str, Any]]:
    """逐个打开模型（错误码由 open_model 统一映射），保留原始顺序与序号。"""
    entries: list[tuple[int, str, Any]] = []
    for index, path in enumerate(paths):
        entries.append((index, path, open_model(path)))
    return entries


@router.get("/disciplines")
def federation_disciplines(
    lang: str | None = Query(None, description="返回语言：zh（默认）/ en"),
) -> dict[str, Any]:
    """返回专业定义与自动映射规则表（供界面展示/后续可配置），按语言本地化专业名。"""
    return discipline.rule_table(i18n.pick_lang(lang))


@router.post("/merge")
def federation_merge(payload: FederationRequest) -> dict[str, Any]:
    """融合多个 IFC 模型：统一构件表（坐标归一）+ 专业聚合 + GUID 冲突，并附融合模型树。"""
    entries = _open_all(payload.paths)
    result = merge.build(entries, normalize=payload.normalize, limit=payload.limit, lang=i18n.pick_lang(payload.lang))
    result["tree"] = tree.build(entries, max_depth=payload.max_depth)
    return result


@router.post("/tree")
def federation_tree(payload: FederationRequest) -> dict[str, Any]:
    """仅返回融合模型树（模型 → 空间层级，含专业分布）。"""
    entries = _open_all(payload.paths)
    return tree.build(entries, max_depth=payload.max_depth)


@router.get("/merge")
def federation_merge_get(
    paths: str = Query(..., description="IFC 文件绝对路径，多个用逗号分隔"),
    normalize: bool = Query(True),
    max_depth: int = Query(8, ge=1, le=32),
    limit: int = Query(2000, ge=1, le=20000),
    lang: str | None = Query(None, description="返回语言：zh（默认）/ en"),
) -> dict[str, Any]:
    """GET 便捷入口：以逗号分隔的 paths 触发融合。"""
    path_list = [item.strip() for item in paths.split(",") if item.strip()]
    if not path_list:
        raise HTTPException(status_code=400, detail="paths 不能为空")
    entries = _open_all(path_list)
    result = merge.build(entries, normalize=normalize, limit=limit, lang=i18n.pick_lang(lang))
    result["tree"] = tree.build(entries, max_depth=max_depth)
    return result
