"""规则检查实现：属性 / 相交 / 净距 / 净高 / 净尺寸 / 重复。

每个 check_* 返回 (违规项列表, 是否因超限被截断)。
违规项字段：guid/name/ifc_type（主构件）、related（关联构件，可为空）、
actual/expected（实测与要求）、reason、steps（原因链）、location（坐标，可选）。
"""

from __future__ import annotations

import math
from typing import Any

from app.clash import engine as clash_engine
from app.rules import operators, selector

EPS = 1e-6


def _related(refs: dict[str, dict], guid: str) -> dict[str, Any] | None:
    return refs.get(guid)


# ------------------------------- 属性检查 -------------------------------

NUMERIC_OPS = {"==", "!=", ">", ">=", "<", "<="}


def property_check(
    targets: list[dict[str, Any]],
    check: dict[str, Any],
    model_unit_to_meter: float,
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """逐构件比较属性值与阈值。

    unit 换算仅对数值比较算子生效；contains / matches / exists 等直接按原值比较。
    """
    op = check.get("op", ">=")
    unit = check.get("unit", "model")
    missing = check.get("missing", "violation")
    raw = check.get("value")

    expected = raw
    if raw is not None and op in NUMERIC_OPS:
        expected = round(operators.to_model_units(raw, unit, model_unit_to_meter), 6)

    items: list[dict[str, Any]] = []
    truncated = False
    for target in targets:
        value = selector.property_value(target["element"], check)
        absent = value is operators.MISSING

        if absent and op not in ("exists", "not_exists"):
            if missing == "skip":
                continue
            if missing == "pass":
                continue
            ok = False
        else:
            ok = operators.compare(op, value, expected)
        if ok:
            continue

        if absent:
            actual = None
            if lang == "en":
                reason = "Element missing required property"
                steps = [f"Property {check.get('pset')}.{check.get('prop')} not found", "Treated as violation per missing policy"]
            else:
                reason = "构件缺少待检属性"
                steps = [f"未找到属性 {check.get('pset')}.{check.get('prop')}", "按 missing 策略判定为违规"]
        else:
            actual = value if isinstance(value, bool) else (round(value, 6) if isinstance(value, (int, float)) else value)
            if lang == "en":
                reason = f"Actual value {actual} does not satisfy requirement {op} {expected}"
                steps = [f"Read {check.get('pset')}.{check.get('prop')} = {actual}", f"Evaluate {actual} {op} {expected} → not satisfied"]
            else:
                reason = f"属性实际值 {actual} 不满足要求 {op} {expected}"
                steps = [f"读取 {check.get('pset')}.{check.get('prop')} = {actual}", f"判定 {actual} {op} {expected} → 不满足"]

        items.append(
            {
                "guid": target["guid"], "name": target["name"], "ifc_type": target["ifc_type"],
                "actual": actual, "expected": expected, "related": None,
                "reason": reason, "steps": steps,
            }
        )
        if len(items) >= max_violations:
            truncated = True
            break
    return items, truncated


# ------------------------------- 相交检查 -------------------------------

def intersection_check(
    model,
    entries: dict[str, dict],
    set_a: set[str],
    set_b: set[str],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """复用硬碰撞引擎，报告跨集合（跨专业）构件的几何相交对。"""
    scope = {guid: entries[guid] for guid in (set_a | set_b) if guid in entries}
    result = clash_engine.run(model, scope, None, None, max_violations)

    items: list[dict[str, Any]] = []
    for hit in result["items"]:
        guid_a, guid_b = hit["a"]["guid"], hit["b"]["guid"]
        if not ((guid_a in set_a and guid_b in set_b) or (guid_a in set_b and guid_b in set_a)):
            continue
        items.append(
            {
                "guid": guid_a, "name": hit["a"]["name"], "ifc_type": hit["a"]["ifc_type"],
                "related": hit["b"],
                "actual": hit["triangle_pairs"], "expected": 0,
                "location": hit["contact_point"],
                "reason": (
                    f"Intersects with {hit['b']['name']} ({hit['b']['ifc_type']})"
                    if lang == "en"
                    else f"与 {hit['b']['name']}（{hit['b']['ifc_type']}）发生几何相交"
                ),
                "steps": (
                    [f"Intersecting triangle pairs = {hit['triangle_pairs']}", "Intersection exists → interdisciplinary clash"]
                    if lang == "en"
                    else [f"三角形相交对数 = {hit['triangle_pairs']}", "存在相交 → 判定为跨专业碰撞"]
                ),
            }
        )
    return items, result["truncated"]


# ------------------------------- 净距检查 -------------------------------

def _gap(box_a: list[float], box_b: list[float], axis: str) -> float:
    """两包围盒在指定轴上的分离间隙；重叠轴贡献 0；all 取三轴间隙的欧氏距离。"""
    gx = max(box_a[0] - box_b[3], box_b[0] - box_a[3], 0.0)
    gy = max(box_a[1] - box_b[4], box_b[1] - box_a[4], 0.0)
    gz = max(box_a[2] - box_b[5], box_b[2] - box_a[5], 0.0)
    if axis == "x":
        return gx
    if axis == "y":
        return gy
    if axis == "z":
        return gz
    return math.sqrt(gx * gx + gy * gy + gz * gz)


def clearance_check(
    entries: dict[str, dict],
    set_a: set[str],
    set_b: set[str],
    check: dict[str, Any],
    model_unit_to_meter: float,
    refs: dict[str, dict],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """比较两构件集合的包围盒净距，低于阈值即违规。"""
    axis = check.get("axis", "all")
    min_distance = round(operators.to_model_units(check["value"], check.get("unit", "model"), model_unit_to_meter), 6)
    same = set_a == set_b

    guids_a = sorted(guid for guid in set_a if guid in entries)
    guids_b = sorted(guid for guid in set_b if guid in entries)
    pairs: list[tuple[str, str]] = []
    if same:
        for i in range(len(guids_a)):
            for j in range(i + 1, len(guids_a)):
                pairs.append((guids_a[i], guids_a[j]))
    else:
        for guid_a in guids_a:
            for guid_b in guids_b:
                pairs.append((guid_a, guid_b))

    items: list[dict[str, Any]] = []
    truncated = False
    for guid_a, guid_b in pairs:
        gap = round(_gap(entries[guid_a]["bbox"], entries[guid_b]["bbox"], axis), 6)
        if gap + EPS >= min_distance:
            continue
        ref_a, ref_b = refs.get(guid_a, {}), refs.get(guid_b, {})
        items.append(
            {
                "guid": guid_a, "name": ref_a.get("name"), "ifc_type": ref_a.get("ifc_type"),
                "related": {"guid": guid_b, "name": ref_b.get("name"), "ifc_type": ref_b.get("ifc_type")},
                "actual": gap, "expected": min_distance,
                "reason": (
                    f"Clearance to {ref_b.get('name')} {gap} below required {min_distance} (axis {axis})"
                    if lang == "en"
                    else f"与 {ref_b.get('name')} 净距 {gap} 小于要求 {min_distance}（轴 {axis}）"
                ),
                "steps": (
                    [f"Bounding box gap (axis {axis}) = {gap}", f"Evaluate {gap} ≥ {min_distance} → not satisfied"]
                    if lang == "en"
                    else [f"包围盒间隙（轴 {axis}）= {gap}", f"判定 {gap} ≥ {min_distance} → 不满足"]
                ),
            }
        )
        if len(items) >= max_violations:
            truncated = True
            break
    return items, truncated


# ------------------------------- 净高检查 -------------------------------

def _overlap_xy(box_a: list[float], box_b: list[float]) -> bool:
    """两包围盒在 X、Y 投影上是否有重叠（用于判断上方遮挡是否落在目标范围内）。"""
    return box_a[0] < box_b[3] and box_b[0] < box_a[3] and box_a[1] < box_b[4] and box_b[1] < box_a[4]


def headroom_check(
    entries: dict[str, dict],
    set_a: set[str],
    set_b: set[str],
    check: dict[str, Any],
    model_unit_to_meter: float,
    refs: dict[str, dict],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """空间净高检查：目标底面到其投影范围内最低遮挡构件底面的垂直净空，低于阈值即违规。

    遮挡构件（other）须与目标在 X、Y 投影上重叠且位于目标底面之上；
    若无遮挡构件，则退回目标自身包围盒高度作为净高。
    """
    min_height = round(operators.to_model_units(check["value"], check.get("unit", "model"), model_unit_to_meter), 6)
    guids_a = sorted(guid for guid in set_a if guid in entries)
    guids_b = [guid for guid in set_b if guid in entries and guid not in set_a]

    items: list[dict[str, Any]] = []
    truncated = False
    for guid_a in guids_a:
        box_a = entries[guid_a]["bbox"]
        floor_z = box_a[2]
        lowest_z: float | None = None
        lowest_guid: str | None = None
        for guid_b in guids_b:
            box_b = entries[guid_b]["bbox"]
            if box_b[2] <= floor_z + EPS or not _overlap_xy(box_a, box_b):
                continue
            if lowest_z is None or box_b[2] < lowest_z:
                lowest_z, lowest_guid = box_b[2], guid_b

        clear = round((lowest_z if lowest_z is not None else box_a[5]) - floor_z, 6)
        if clear + EPS >= min_height:
            continue

        ref_a = refs.get(guid_a, {})
        ref_b = refs.get(lowest_guid, {}) if lowest_guid else {}
        related = (
            {"guid": lowest_guid, "name": ref_b.get("name"), "ifc_type": ref_b.get("ifc_type")}
            if lowest_guid
            else None
        )
        center_xy = [round((box_a[0] + box_a[3]) / 2, 6), round((box_a[1] + box_a[4]) / 2, 6)]
        items.append(
            {
                "guid": guid_a, "name": ref_a.get("name"), "ifc_type": ref_a.get("ifc_type"),
                "related": related,
                "actual": clear, "expected": min_height,
                "location": [center_xy[0], center_xy[1], round(floor_z, 6)],
                "reason": (
                    (
                        f"Headroom {clear} below required {min_height} (blocked by {ref_b.get('name')})"
                        if related
                        else f"Headroom {clear} below required {min_height}"
                    )
                    if lang == "en"
                    else (
                        f"净高 {clear} 低于要求 {min_height}（被 {ref_b.get('name')} 遮挡）"
                        if related
                        else f"净高 {clear} 低于要求 {min_height}"
                    )
                ),
                "steps": (
                    [
                        f"Space floor Z = {round(floor_z, 6)}",
                        f"Lowest obstruction floor Z = {round(lowest_z, 6)}" if lowest_z is not None else "No obstruction above, using space height",
                        f"Headroom = {clear}, evaluate ≥ {min_height} → not satisfied",
                    ]
                    if lang == "en"
                    else [
                        f"空间底面 Z = {round(floor_z, 6)}",
                        f"最低遮挡底面 Z = {round(lowest_z, 6)}" if lowest_z is not None else "上方无遮挡，按空间自身高度计",
                        f"净高 = {clear}，判定 ≥ {min_height} → 不满足",
                    ]
                ),
            }
        )
        if len(items) >= max_violations:
            truncated = True
            break
    return items, truncated


# ------------------------------- 净尺寸检查 -------------------------------

def dimension_check(
    entries: dict[str, dict],
    guids: set[str],
    check: dict[str, Any],
    refs: dict[str, dict],
    model_unit_to_meter: float,
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """构件 / 空间净尺寸检查：包围盒在指定轴上的尺寸低于阈值即违规。

    axis：x / y / z 取对应轴向尺寸；min 取水平两轴（X、Y）的较小值（通道净宽常用）。
    """
    axis = check.get("axis", "min")
    min_size = round(operators.to_model_units(check["value"], check.get("unit", "model"), model_unit_to_meter), 6)
    ordered = sorted(guid for guid in guids if guid in entries)

    items: list[dict[str, Any]] = []
    truncated = False
    for guid in ordered:
        box = entries[guid]["bbox"]
        sizes = {"x": box[3] - box[0], "y": box[4] - box[1], "z": box[5] - box[2]}
        if axis == "min":
            size = min(sizes["x"], sizes["y"])
        elif axis in sizes:
            size = sizes[axis]
        else:
            raise ValueError(f"dimension 检查不支持的轴向：{axis}（可选 x/y/z/min）")
        size = round(size, 6)
        if size + EPS >= min_size:
            continue
        ref = refs.get(guid, {})
        items.append(
            {
                "guid": guid, "name": ref.get("name"), "ifc_type": ref.get("ifc_type"),
                "related": None, "actual": size, "expected": min_size,
                "reason": (
                    f"Dimension (axis {axis}) {size} below required {min_size}"
                    if lang == "en"
                    else f"净尺寸（轴 {axis}）{size} 小于要求 {min_size}"
                ),
                "steps": (
                    [f"Axis {axis} size = {size} (X={round(sizes['x'], 6)} Y={round(sizes['y'], 6)} Z={round(sizes['z'], 6)})",
                     f"Evaluate {size} ≥ {min_size} → not satisfied"]
                    if lang == "en"
                    else [f"轴向 {axis} 尺寸 = {size}（X={round(sizes['x'], 6)} Y={round(sizes['y'], 6)} Z={round(sizes['z'], 6)}）",
                          f"判定 {size} ≥ {min_size} → 不满足"]
                ),
            }
        )
        if len(items) >= max_violations:
            truncated = True
            break
    return items, truncated


# ------------------------------- 重复检查 -------------------------------

def _similar(box_a: list[float], box_b: list[float], size_tol: float, center_tol: float) -> bool:
    for i in range(3):
        size_a, size_b = box_a[i + 3] - box_a[i], box_b[i + 3] - box_b[i]
        center_a, center_b = (box_a[i] + box_a[i + 3]) / 2, (box_b[i] + box_b[i + 3]) / 2
        scale = max(size_a, size_b, EPS)
        if abs(size_a - size_b) > size_tol * scale:
            return False
        if abs(center_a - center_b) > center_tol * scale:
            return False
    return True


def duplicate_check(
    entries: dict[str, dict],
    guids: set[str],
    check: dict[str, Any],
    refs: dict[str, dict],
    max_violations: int,
    lang: str = "zh",
) -> tuple[list[dict[str, Any]], bool]:
    """在目标集合内查找尺寸一致且中心重合的构件（疑似重复建模）。"""
    size_tol = float(check.get("size_tolerance", 0.02))
    center_tol = float(check.get("center_tolerance", 0.05))
    ordered = sorted(guid for guid in guids if guid in entries)

    items: list[dict[str, Any]] = []
    truncated = False
    for i in range(len(ordered)):
        for j in range(i + 1, len(ordered)):
            guid_a, guid_b = ordered[i], ordered[j]
            if not _similar(entries[guid_a]["bbox"], entries[guid_b]["bbox"], size_tol, center_tol):
                continue
            ref_a, ref_b = refs.get(guid_a, {}), refs.get(guid_b, {})
            box = entries[guid_a]["bbox"]
            center = [round((box[k] + box[k + 3]) / 2, 6) for k in range(3)]
            items.append(
                {
                    "guid": guid_a, "name": ref_a.get("name"), "ifc_type": ref_a.get("ifc_type"),
                    "related": {"guid": guid_b, "name": ref_b.get("name"), "ifc_type": ref_b.get("ifc_type")},
                    "actual": (
                        "Identical shape and center" if lang == "en" else "尺寸一致且中心重合"
                    ),
                    "expected": (
                        "Should be unique element" if lang == "en" else "应为唯一构件"
                    ),
                    "location": center,
                    "reason": (
                        f"Identical shape and center with {ref_b.get('name')}, suspected duplicate"
                        if lang == "en"
                        else f"与 {ref_b.get('name')} 外形尺寸一致且中心重合，疑似重复构件"
                    ),
                    "steps": (
                        [f"Size tolerance ≤ {size_tol:.1%}", f"Center tolerance ≤ {center_tol:.1%}", "Bounding boxes nearly identical → duplicate"]
                        if lang == "en"
                        else [f"尺寸容差 ≤ {size_tol:.1%}", f"中心容差 ≤ {center_tol:.1%}", "两构件包围盒几乎一致 → 判定重复"]
                    ),
                }
            )
            if len(items) >= max_violations:
                truncated = True
                return items, truncated
    return items, truncated
