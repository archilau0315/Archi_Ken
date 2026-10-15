"""IDS 校验端点：示例 IDS、结构解析、对模型执行校验。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ids import example as ids_example
from app.ids import spec as ids_spec
from app.ids import validate as ids_validate
from app.ids.spec import IdsError
from app.routes.deps import open_model

router = APIRouter(prefix="/ids", tags=["ids"])


class ParseRequest(BaseModel):
    """IDS 结构解析请求体。"""

    xml: str = Field(..., description="IDS XML 文本")


class ValidateRequest(BaseModel):
    """IDS 校验请求体。"""

    path: str = Field(..., description="IFC 文件绝对路径")
    xml: str | None = Field(None, description="IDS XML 文本；与 ids_path 二选一")
    ids_path: str | None = Field(None, description="IDS 文件绝对路径；与 xml 二选一")
    hide_skipped: bool = Field(False, description="是否隐藏被跳过的规范")
    entity_limit: int = Field(100, ge=1, le=1000, description="每个实体清单最多返回的条目数")


def _load(xml: str | None, ids_path: str | None):
    """按需从 XML 文本或 IDS 文件加载文档，统一映射错误码。"""
    try:
        if xml:
            return ids_spec.load_xml(xml)
        return ids_spec.load_file(ids_path or "")
    except IdsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/example")
def ids_example_spec() -> dict[str, Any]:
    """返回内置示例 IDS（原始 XML + 结构预览）。"""
    document = ids_spec.load_xml(ids_example.EXAMPLE_XML)
    return {"xml": ids_example.EXAMPLE_XML, "spec": ids_spec.describe(document)}


@router.post("/parse")
def ids_parse(payload: ParseRequest) -> dict[str, Any]:
    """解析 IDS XML：返回规范化 XML 与结构预览（供编辑器导入）。"""
    document = _load(payload.xml, None)
    return {"xml": ids_spec.to_xml(document), "spec": ids_spec.describe(document)}


@router.post("/validate")
def ids_validate_model(payload: ValidateRequest) -> dict[str, Any]:
    """对模型执行 IDS 校验，返回逐规范 / 逐要求的通过情况与失败实体。"""
    if not payload.xml and not payload.ids_path:
        raise HTTPException(status_code=400, detail="需提供 xml 或 ids_path")
    document = _load(payload.xml, payload.ids_path)
    model = open_model(payload.path)
    return ids_validate.run(
        model,
        document,
        limit=payload.entity_limit,
        hide_skipped=payload.hide_skipped,
        filepath=payload.path,
    )
