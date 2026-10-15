"""IDS 校验执行：对模型运行 Ids 校验，并把结果转为 JSON 安全结构。

复用 ifctester 官方 reporter 的判定语义（保证与 IDS 标准实现一致），
仅把其中的实体引用压缩为前端可用的轻量摘要（GUID / 类型 / 名称 / 预定义类型）。
"""

from __future__ import annotations

from typing import Any

import ifcopenshell
from ifctester import ids, reporter

# 单次响应中每个实体清单最多返回的条目数，避免大模型响应过大。
ENTITY_LIMIT = 100

# 与 reporter 结果字典一一对应的汇总键。
TOTAL_KEYS = (
    "total_specifications",
    "total_specifications_pass",
    "total_specifications_fail",
    "percent_specifications_pass",
    "total_requirements",
    "total_requirements_pass",
    "total_requirements_fail",
    "percent_requirements_pass",
    "total_checks",
    "total_checks_pass",
    "total_checks_fail",
    "percent_checks_pass",
)


def _ref(entry: dict[str, Any], with_reason: bool = False) -> dict[str, Any]:
    """把报告中的实体条目压缩为前端可用摘要。"""
    ref = {
        "guid": entry.get("global_id"),
        "ifc_type": entry.get("class"),
        "name": entry.get("name"),
        "predefined_type": entry.get("predefined_type"),
    }
    if with_reason:
        ref["reason"] = entry.get("reason")
    return ref


def _entities(items: Any, limit: int, with_reason: bool = False) -> list[dict[str, Any]]:
    return [_ref(item, with_reason) for item in list(items or [])[:limit]]


def _requirement(report: dict[str, Any], limit: int) -> dict[str, Any]:
    passed = report.get("passed_entities") or []
    failed = report.get("failed_entities") or []
    return {
        "facet_type": report.get("facet_type"),
        "label": report.get("label"),
        "value": report.get("value"),
        "description": report.get("description"),
        "status": report.get("status"),
        "total_applicable": report.get("total_applicable"),
        "total_pass": report.get("total_pass"),
        "total_fail": report.get("total_fail"),
        "percent_pass": report.get("percent_pass"),
        "passed_total": len(passed),
        "failed_total": len(failed),
        "passed_entities": _entities(passed, limit),
        "failed_entities": _entities(failed, limit, with_reason=True),
    }


def _specification(report: dict[str, Any], limit: int) -> dict[str, Any]:
    applicable = report.get("applicable_entities") or []
    return {
        "name": report.get("name"),
        "description": report.get("description"),
        "instructions": report.get("instructions"),
        "status": report.get("status"),
        "is_skipped": report.get("is_skipped"),
        "is_ifc_version": report.get("is_ifc_version"),
        "cardinality": report.get("cardinality"),
        "applicability": report.get("applicability") or [],
        "total_applicable": report.get("total_applicable"),
        "total_applicable_pass": report.get("total_applicable_pass"),
        "total_applicable_fail": report.get("total_applicable_fail"),
        "percent_applicable_pass": report.get("percent_applicable_pass"),
        "total_checks": report.get("total_checks"),
        "total_checks_pass": report.get("total_checks_pass"),
        "total_checks_fail": report.get("total_checks_fail"),
        "percent_checks_pass": report.get("percent_checks_pass"),
        "applicable_total": len(applicable),
        "applicable_entities": _entities(applicable, limit),
        "requirements": [_requirement(item, limit) for item in report.get("requirements") or []],
    }


def run(
    model: ifcopenshell.file,
    document: ids.Ids,
    limit: int = ENTITY_LIMIT,
    hide_skipped: bool = False,
    filepath: str | None = None,
) -> dict[str, Any]:
    """执行 IDS 校验并返回 JSON 安全结果。"""
    document.validate(model, filepath=filepath)
    raw = reporter.Json(document, hide_skipped=hide_skipped).report()
    return {
        "status": raw.get("status"),
        "title": raw.get("title"),
        "filename": raw.get("filename"),
        "date": raw.get("date"),
        "entity_limit": limit,
        "totals": {key: raw.get(key) for key in TOTAL_KEYS},
        "specifications": [_specification(item, limit) for item in raw.get("specifications") or []],
    }
