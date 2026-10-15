"""规则求值编排：选择目标构件 → 执行对应检查 → 汇总结果与原因链。"""

from __future__ import annotations

from typing import Any

import ifcopenshell

from app.geometry import extract
from app.ifc import summary
from app.rules import checks, checks_group, selector

RULE_LIMIT_HINT = "max_violations"


def _refs_for(model: ifcopenshell.file, targets: list[dict[str, Any]]) -> dict[str, dict]:
    """构建 guid → 简要信息 的映射（名称、类型）。"""
    return {
        target["guid"]: {"guid": target["guid"], "name": target["name"], "ifc_type": target["ifc_type"]}
        for target in targets
    }


def _apply_message(rule: dict[str, Any], item: dict[str, Any]) -> None:
    """若规则提供了 message 模板，则覆盖默认 reason。"""
    template = rule.get("message")
    if not template:
        return
    related = item.get("related") or {}
    values = {
        "guid": item.get("guid"),
        "name": item.get("name"),
        "ifc_type": item.get("ifc_type"),
        "actual": item.get("actual"),
        "expected": item.get("expected"),
        "related_name": related.get("name"),
        "related_guid": related.get("guid"),
    }
    try:
        item["reason"] = template.format(**values)
    except (KeyError, IndexError, ValueError):
        pass


def run(
    model: ifcopenshell.file,
    path: str,
    rules: list[dict[str, Any]],
    max_violations: int = 200,
    lang: str = "zh",
) -> dict[str, Any]:
    """依次求值每条规则，返回逐规则结果与整体统计。"""
    model_unit_to_meter = summary.unit_to_meter(model)
    # 几何提取（ifcopenshell）输出的坐标/包围盒恒为米，与文件声明单位无关；
    # 因此几何类检查（clearance/headroom/dimension）的阈值换算因子固定为 1.0。
    # 属性检查读的是 Pset/Qto 原始值（文件单位），仍用 model_unit_to_meter。
    geometry_unit_to_meter = 1.0

    entries_slot: dict[str, dict] = {}

    def entries() -> dict[str, dict]:
        """几何缓存按需加载，避免纯属性规则也做三角化。"""
        if "data" not in entries_slot:
            entries_slot["data"] = extract.load_or_extract(model, path)[0]
        return entries_slot["data"]

    results: list[dict[str, Any]] = []
    violations_total = 0

    for rule in rules:
        check = rule["check"]
        check_type = check["type"]
        targets = selector.select(model, rule["target"])
        refs = _refs_for(model, targets)
        set_a = {target["guid"] for target in targets}
        truncated = False

        if check_type == "property":
            items, truncated = checks.property_check(targets, check, model_unit_to_meter, max_violations, lang)
        elif check_type == "intersection":
            others = selector.select(model, check.get("other", {}))
            refs.update(_refs_for(model, others))
            items, truncated = checks.intersection_check(
                model, entries(), set_a, {other["guid"] for other in others}, max_violations, lang
            )
        elif check_type == "clearance":
            others = selector.select(model, check.get("other", {}))
            refs.update(_refs_for(model, others))
            items, truncated = checks.clearance_check(
                entries(), set_a, {other["guid"] for other in others}, check, geometry_unit_to_meter, refs, max_violations, lang
            )
        elif check_type == "headroom":
            others = selector.select(model, check.get("other", {}))
            refs.update(_refs_for(model, others))
            items, truncated = checks.headroom_check(
                entries(), set_a, {other["guid"] for other in others}, check, geometry_unit_to_meter, refs, max_violations, lang
            )
        elif check_type == "dimension":
            items, truncated = checks.dimension_check(
                entries(), set_a, check, refs, geometry_unit_to_meter, max_violations, lang
            )
        elif check_type == "count":
            items, truncated = checks_group.count_check(targets, check, max_violations, lang)
        elif check_type == "containment":
            others = selector.select(model, check.get("other", {}))
            refs.update(_refs_for(model, others))
            items, truncated = checks_group.containment_check(
                entries(), set_a, {other["guid"] for other in others}, check, refs, max_violations, lang
            )
        else:  # duplicate
            items, truncated = checks.duplicate_check(entries(), set_a, check, refs, max_violations, lang)

        for item in items:
            _apply_message(rule, item)

        violations_total += len(items)
        results.append(
            {
                "rule_id": rule["id"],
                "name": rule["name"],
                "category": rule["category"],
                "severity": rule["severity"],
                "check_type": check_type,
                "reference": rule.get("reference") or None,
                "target_total": len(targets),
                "violations": len(items),
                "truncated": truncated,
                "items": items,
            }
        )

    passed = sum(1 for result in results if result["violations"] == 0)
    return {
        "path": path,
        "rules_run": len(results),
        "rules_passed": passed,
        "rules_failed": len(results) - passed,
        "violations_total": violations_total,
        "max_violations": max_violations,
        "truncated": any(result["truncated"] for result in results),
        "rules": results,
    }
