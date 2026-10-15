"""规则引擎端点：内置模板列表、规则校验与规则求值（支持内置/自定义规则）。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import i18n
from app.rules import dsl, evaluator, presets, templates
from app.routes.deps import open_model

router = APIRouter(prefix="/rules", tags=["rules"])


class RuleRunRequest(BaseModel):
    """自定义规则求值请求体。"""

    path: str = Field(..., description="IFC 文件绝对路径")
    rules: list[dict[str, Any]] | None = Field(None, description="自定义规则数组；优先于 rule_ids")
    rule_ids: list[str] | None = Field(None, description="内置模板 id 子集；未提供则用全部模板")
    max_violations: int = Field(200, ge=1, le=5000, description="单规则最多返回的违规条数")
    lang: str | None = Field(None, description="返回语言：zh（默认）/ en")


class RuleValidateRequest(BaseModel):
    """规则校验请求体：仅校验规则定义，不需要模型。"""

    rules: list[dict[str, Any]] = Field(..., description="待校验的规则数组")


def _prepare(rule_ids: list[str] | None, rules: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if rules:
        return dsl.parse_rules(rules)
    return templates.select_rules(rule_ids)


def _run(
    path: str,
    rule_ids: list[str] | None,
    rules: list[dict[str, Any]] | None,
    max_violations: int,
    lang: str = "zh",
) -> dict[str, Any]:
    model = open_model(path)
    try:
        prepared = _prepare(rule_ids, rules)
    except dsl.RuleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # 规则名 / 分类 / message 模板按语言本地化，保证结果文案与动态 reason 一致
    prepared = i18n.localize_rules(prepared, lang)
    try:
        return evaluator.run(model, path, prepared, max_violations, lang)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/templates")
def rule_templates(
    lang: str | None = Query(None, description="返回语言：zh（默认）/ en"),
) -> dict[str, Any]:
    """列出内置规则模板，按语言本地化。"""
    lang_norm = i18n.pick_lang(lang)
    items = i18n.localize_rules(templates.builtin_rules(), lang_norm)
    return {"total": len(items), "items": items}


@router.get("/presets")
def rule_presets(
    lang: str | None = Query(None, description="返回语言：zh（默认）/ en"),
) -> dict[str, Any]:
    """列出合规性检查预设规则集（M5：无障碍 / 净高 / 消防），含展开后的规则。"""
    items = presets.list_presets(i18n.pick_lang(lang))
    return {"total": len(items), "items": items}


@router.get("/run")
def rules_run_get(
    path: str = Query(..., description="IFC 文件绝对路径"),
    rule_ids: str | None = Query(None, description="内置模板 id，逗号分隔；未提供则运行全部模板"),
    max_violations: int = Query(200, ge=1, le=5000),
    lang: str | None = Query(None, description="返回语言：zh（默认）/ en"),
) -> dict[str, Any]:
    """对模型运行内置规则模板。"""
    ids = [item.strip() for item in rule_ids.split(",") if item.strip()] if rule_ids else None
    return _run(path, ids, None, max_violations, i18n.pick_lang(lang))


@router.post("/run")
def rules_run_post(payload: RuleRunRequest) -> dict[str, Any]:
    """对模型运行自定义规则（或用 rule_ids 指定内置子集）。"""
    return _run(payload.path, payload.rule_ids, payload.rules, payload.max_violations, i18n.pick_lang(payload.lang))


@router.post("/validate")
def rules_validate(payload: RuleValidateRequest) -> dict[str, Any]:
    """校验规则定义（不需要模型）：合法返回规范化规则，非法返回 400 + 原因。"""
    try:
        normalized = dsl.parse_rules(payload.rules)
    except dsl.RuleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"valid": True, "total": len(normalized), "rules": normalized}
