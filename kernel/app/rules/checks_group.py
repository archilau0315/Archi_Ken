"""计数与包含检查（DSL v1 扩展，Phase B）。

- count：统计目标构件数量（可选按楼层分组），不满足阈值即违规；
  用于「模型应包含某类构件」「每层安全出口 ≥2」等。
- containment：目标构件（包围盒中心）必须落在 other 集合某空间包围盒内；
  用于「消火栓必须设在走道/前室」「配电柜必须在配电间」等。
违规项字段与 checks.py 保持一致；count 违规以组内首个构件为代表 guid。
"""

from __future__ import annotations

from typing import Any

import ifcopenshell.util.element

from app.rules import operators

EPS = 1e-6


def _storey_of(element: Any) -> str:
    """取构件所属楼层名；未分配楼层的归入固定组名。"""
    container = ifcopenshell.util.element.get_container(element)
    name = getattr(container, "Name", None)
    return name or "(未分配楼层)"


# ------------------------------- 计数检查 -------------------------------

def count_check(
    targets: list[dict[str, Any]],
    check: dict[str, Any],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """统计目标数量并与阈值比较（op 默认 >=）。

    group_by："storey" 时按楼层分组统计（每组独立判定）；缺省为全模型统计一次。
    """
    op = check.get("op", ">=")
    value = check["value"]
    group_by = check.get("group_by")

    def make_item(members: list[dict[str, Any]], scope: str) -> dict[str, Any]:
        count = len(members)
        rep = members[0] if members else {}
        if lang == "en":
            reason = f"{scope}: component count {count} does not satisfy {op} {value}"
            steps = [f"Selected {count} component(s) in {scope}", f"Evaluate {count} {op} {value} → not satisfied"]
        else:
            reason = f"{scope}：构件数量 {count} 不满足要求 {op} {value}"
            steps = [f"{scope} 内命中构件 {count} 个", f"判定 {count} {op} {value} → 不满足"]
        return {
            "guid": rep.get("guid"), "name": f"{scope}" if not rep else f"{scope}（{rep.get('name')} 等 {count} 个）",
            "ifc_type": rep.get("ifc_type", "*"),
            "actual": count, "expected": f"{op} {value}", "related": None,
            "reason": reason, "steps": steps,
        }

    items: list[dict[str, Any]] = []
    truncated = False

    if group_by == "storey":
        groups: dict[str, list[dict[str, Any]]] = {}
        for target in targets:
            groups.setdefault(_storey_of(target["element"]), []).append(target)
        for scope in sorted(groups):
            members = groups[scope]
            if operators.compare(op, len(members), value):
                continue
            items.append(make_item(members, scope))
            if len(items) >= max_violations:
                return items, True
        return items, truncated

    if not operators.compare(op, len(targets), value):
        scope = "Whole model" if lang == "en" else "全模型"
        items.append(make_item(targets, scope))
    return items, truncated


# ------------------------------- 包含检查 -------------------------------

def _contains_point(box: list[float], point: list[float]) -> bool:
    """点是否落在包围盒内（三轴闭区间）。"""
    return all(box[i] - EPS <= point[i] <= box[i + 3] + EPS for i in range(3))


def containment_check(
    entries: dict[str, dict],
    set_a: set[str],
    set_b: set[str],
    check: dict[str, Any],
    refs: dict[str, dict],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """目标构件包围盒中心必须落在 other 集合至少一个空间的包围盒内，否则违规。"""
    guids_a = sorted(guid for guid in set_a if guid in entries)
    boxes_b = [entries[guid]["bbox"] for guid in set_b if guid in entries and guid not in set_a]

    items: list[dict[str, Any]] = []
    truncated = False
    for guid_a in guids_a:
        box_a = entries[guid_a]["bbox"]
        center = [round((box_a[i] + box_a[i + 3]) / 2, 6) for i in range(3)]
        if any(_contains_point(box_b, center) for box_b in boxes_b):
            continue
        ref_a = refs.get(guid_a, {})
        items.append(
            {
                "guid": guid_a, "name": ref_a.get("name"), "ifc_type": ref_a.get("ifc_type"),
                "related": None,
                "actual": "Outside all target spaces" if lang == "en" else "不在任何目标空间内",
                "expected": "Inside at least one target space" if lang == "en" else "应位于目标空间内",
                "location": center,
                "reason": (
                    f"{ref_a.get('name')} center is not inside any required space"
                    if lang == "en"
                    else f"{ref_a.get('name')} 中心未落在任何要求的空间内"
                ),
                "steps": (
                    [f"Element bbox center = {center}", f"Target spaces checked = {len(boxes_b)}", "No space contains the center → violation"]
                    if lang == "en"
                    else [f"构件包围盒中心 = {center}", f"目标空间数量 = {len(boxes_b)}", "无空间包含该中心点 → 违规"]
                ),
            }
        )
        if len(items) >= max_violations:
            truncated = True
            break
    return items, truncated
