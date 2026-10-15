"""碰撞分类：按一对构件的三角形网格判「硬碰撞 / 间隙 / 净空」。

语义（对齐 Solibri 的分类口径）：
- hard（硬碰撞）：两构件三角形存在交点。
- gap（间隙 / 软碰撞）：不相交，但最短距离小于 gap 容差。
- clearance（净空）：不相交，且未落入 gap，但最短距离小于净空要求值。
判定优先级 hard > gap > clearance（越近的分类优先）。
纯计算、无外部依赖，复用 geommath 与 broadphase。
"""

from __future__ import annotations

from app.clash import broadphase, geommath

HIT_LIMIT = 5  # 单对构件最多记录的相交三角形对数
TEST_LIMIT = 200_000  # 单对构件三角形求交次数上限


def _hard(tri_a: list, tri_b: list) -> dict:
    """硬碰撞扫描：返回相交对数、首个接触点与测试次数。"""
    hits = 0
    tests = 0
    contact = None
    for tri_a_item, box_a in tri_a:
        for tri_b_item, box_b in tri_b:
            if not broadphase.bbox_overlap(box_a, box_b):
                continue
            tests += 1
            point = geommath.tri_tri_contact(*tri_a_item, *tri_b_item)
            if point is not None:
                hits += 1
                if contact is None:
                    contact = point
                if hits >= HIT_LIMIT:
                    return {"hits": hits, "contact": contact, "tests": tests}
            if tests >= TEST_LIMIT:
                return {"hits": hits, "contact": contact, "tests": tests}
    return {"hits": hits, "contact": contact, "tests": tests}


def _min_distance(tri_a: list, tri_b: list, expand: float, stop_at: float) -> dict:
    """邻近扫描：返回最短距离与测试次数；一旦 ≤ stop_at 即提前退出。"""
    best = float("inf")
    tests = 0
    for tri_a_item, box_a in tri_a:
        for tri_b_item, box_b in tri_b:
            if not broadphase.bbox_overlap_expanded(box_a, box_b, expand):
                continue
            tests += 1
            distance = geommath.tri_tri_distance(tri_a_item, tri_b_item)
            if distance < best:
                best = distance
                if best <= stop_at:
                    return {"distance": best, "tests": tests}
            if tests >= TEST_LIMIT:
                return {"distance": best, "tests": tests}
    return {"distance": best, "tests": tests}


def classify_pair(
    tri_a: list,
    tri_b: list,
    gap_tolerance: float | None = None,
    clearance: float | None = None,
) -> dict:
    """对一对构件的三角形网格分类。

    gap_tolerance / clearance 为模型单位下的阈值（None 表示该分类关闭）。
    返回 {mode, contact_point, distance, triangle_pairs, tests}；无任何命中时 mode=None。
    """
    hard = _hard(tri_a, tri_b)
    if hard["hits"]:
        return {
            "mode": "hard",
            "contact_point": hard["contact"],
            "distance": 0.0,
            "triangle_pairs": hard["hits"],
            "tests": hard["tests"],
        }

    thresholds = [value for value in (gap_tolerance, clearance) if value is not None]
    if not thresholds:
        return {"mode": None, "contact_point": None, "distance": None, "triangle_pairs": 0, "tests": hard["tests"]}

    expand = max(thresholds)
    stop_at = min(thresholds)
    near = _min_distance(tri_a, tri_b, expand, stop_at)
    distance = near["distance"]
    tests = hard["tests"] + near["tests"]

    mode = None
    if gap_tolerance is not None and distance <= gap_tolerance:
        mode = "gap"
    elif clearance is not None and distance <= clearance:
        mode = "clearance"
    if mode is None:
        return {"mode": None, "contact_point": None, "distance": None, "triangle_pairs": 0, "tests": tests}

    return {
        "mode": mode,
        "contact_point": None,
        "distance": round(distance, 6),
        "triangle_pairs": 0,
        "tests": tests,
    }
