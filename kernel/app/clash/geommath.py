"""三角形—三角形相交判定、接触点与最小距离计算（碰撞窄相位的数学）。

相交判定：非共面用「平面分割 + 交线区间重叠」，共面降到 2D 用凸多边形裁剪。
距离计算：点—三角形距离与线段—线段距离的组合，取三角形对的最小间距。
纯函数、无外部依赖，便于单独验证。
"""

from __future__ import annotations

import math

EPS = 1e-9

Vec = tuple[float, float, float]
Tri = tuple[Vec, Vec, Vec]


def dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _normal(v0: Vec, v1: Vec, v2: Vec) -> Vec:
    return cross(sub(v1, v0), sub(v2, v0))


def _is_degenerate(n: Vec) -> bool:
    return abs(n[0]) <= EPS and abs(n[1]) <= EPS and abs(n[2]) <= EPS


def tri_tri_intersect(p1: Vec, p2: Vec, p3: Vec, q1: Vec, q2: Vec, q3: Vec) -> bool:
    """两个三角形是否有交集。"""
    return _contact((p1, p2, p3), (q1, q2, q3)) is not None


def tri_tri_contact(p1: Vec, p2: Vec, p3: Vec, q1: Vec, q2: Vec, q3: Vec) -> list[float] | None:
    """两个三角形的接触点；无交集返回 None。"""
    return _contact((p1, p2, p3), (q1, q2, q3))


def _contact(p: Tri, q: Tri) -> list[float] | None:
    n1 = _normal(*p)
    if _is_degenerate(n1):
        return None
    dq = [dot(n1, vertex) - dot(n1, p[0]) for vertex in q]
    if _all_same_side(dq):
        return None

    n2 = _normal(*q)
    if _is_degenerate(n2):
        return None
    dp = [dot(n2, vertex) - dot(n2, q[0]) for vertex in p]
    if _all_same_side(dp):
        return None

    if all(abs(d) <= EPS for d in dq):
        return _coplanar_contact(n1, p, q)

    direction = cross(n1, n2)
    return _line_contact(_plane_section(p, dp, direction), _plane_section(q, dq, direction))


def _all_same_side(distances: list[float]) -> bool:
    return all(d > EPS for d in distances) or all(d < -EPS for d in distances)


def _plane_section(tri: Tri, distances: list[float], direction: Vec) -> list[tuple[float, Vec]]:
    """三角形被另一平面截出的线段点集，标注其在交线方向上的投影值。"""
    samples: list[tuple[float, Vec]] = []
    for i in range(3):
        j = (i + 1) % 3
        di, dj = distances[i], distances[j]
        if abs(di) <= EPS:
            samples.append((dot(tri[i], direction), tri[i]))
        if di * dj < 0:
            t = di / (di - dj)
            a, b = tri[i], tri[j]
            point = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]))
            samples.append((dot(point, direction), point))
    return samples


def _line_contact(sa: list, sb: list) -> list[float] | None:
    """两个截线段在交线方向上的重叠区间中点。"""
    if len(sa) < 2 or len(sb) < 2:
        return None
    lo = max(min(s[0] for s in sa), min(s[0] for s in sb))
    hi = min(max(s[0] for s in sa), max(s[0] for s in sb))
    if hi - lo <= EPS:
        return None
    middle = (lo + hi) / 2
    first, last = min(sa, key=lambda s: s[0]), max(sa, key=lambda s: s[0])
    if abs(last[0] - first[0]) <= EPS:
        return list(first[1])
    ratio = (middle - first[0]) / (last[0] - first[0])
    a, b = first[1], last[1]
    return [a[k] + ratio * (b[k] - a[k]) for k in range(3)]


def _coplanar_contact(n: Vec, p: Tri, q: Tri) -> list[float] | None:
    axis = max(range(3), key=lambda i: abs(n[i]))
    keep = [i for i in range(3) if i != axis]
    p2 = [(v[keep[0]], v[keep[1]]) for v in p]
    q2 = [(v[keep[0]], v[keep[1]]) for v in q]
    overlap = _clip(p2, q2)
    if not overlap or abs(_area(overlap)) <= EPS:
        return None
    cx, cy = _centroid(overlap)
    return _unproject((cx, cy), p, p2)


def _area(poly: list) -> float:
    total = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        total += a[0] * b[1] - b[0] * a[1]
    return total / 2


def _centroid(poly: list) -> tuple[float, float]:
    area = _area(poly)
    if abs(area) <= EPS:
        return poly[0]
    cx = cy = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        factor = a[0] * b[1] - b[0] * a[1]
        cx += (a[0] + b[0]) * factor
        cy += (a[1] + b[1]) * factor
    return cx / (6 * area), cy / (6 * area)


def _orient2d(a, b, c) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _cross_point(p1, p2, p3, p4):
    """两线段交点（用于裁剪边界）。"""
    d1 = _orient2d(p3, p4, p1)
    d2 = _orient2d(p3, p4, p2)
    if abs(d1 - d2) <= EPS:
        return p1
    t = d1 / (d1 - d2)
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


def _clip(subject: list, clip: list) -> list:
    """Sutherland–Hodgman：用凸多边形 clip 裁剪 subject。"""
    if _area(clip) < 0:
        clip = list(reversed(clip))
    output = list(subject)
    for i in range(len(clip)):
        if not output:
            return []
        a, b = clip[i], clip[(i + 1) % len(clip)]
        output = _clip_edge(output, a, b)
    return output


def _clip_edge(poly: list, a, b) -> list:
    result = []
    for i in range(len(poly)):
        cur, prev = poly[i], poly[i - 1]
        side_cur, side_prev = _orient2d(a, b, cur), _orient2d(a, b, prev)
        if side_cur >= -EPS:
            if side_prev < -EPS:
                result.append(_cross_point(prev, cur, a, b))
            result.append(cur)
        elif side_prev >= -EPS:
            result.append(_cross_point(prev, cur, a, b))
    return result


def _unproject(point2: tuple[float, float], tri3: Tri, tri2: list) -> list[float]:
    """把 2D 点按重心坐标映射回该平面上的 3D 点。"""
    (x1, y1), (x2, y2), (x3, y3) = tri2
    denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    if abs(denom) <= EPS:
        return list(tri3[0])
    px, py = point2
    w1 = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / denom
    w2 = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / denom
    w3 = 1 - w1 - w2
    return [w1 * tri3[0][k] + w2 * tri3[1][k] + w3 * tri3[2][k] for k in range(3)]


# ------------------------------- 最小距离（间隙 / 净空） -------------------------------


def length(v: Vec) -> float:
    return math.sqrt(dot(v, v))


def _add(u: Vec, v: Vec) -> Vec:
    return (u[0] + v[0], u[1] + v[1], u[2] + v[2])


def _scale(u: Vec, s: float) -> Vec:
    return (u[0] * s, u[1] * s, u[2] * s)


def _clamp(value: float, low: float, high: float) -> float:
    return low if value < low else (high if value > high else value)


def point_triangle_distance(p: Vec, a: Vec, b: Vec, c: Vec) -> float:
    """点 p 到三角形 abc 的最短距离（Ericson 重心坐标分域法）。"""
    ab, ac, ap = sub(b, a), sub(c, a), sub(p, a)
    d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0.0 and d2 <= 0.0:
        return length(ap)

    bp = sub(p, b)
    d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0.0 and d4 <= d3:
        return length(bp)

    vc = d1 * d4 - d3 * d2
    if vc <= 0.0 and d1 >= 0.0 and d3 <= 0.0:
        denom = d1 - d3
        v = d1 / denom if abs(denom) > EPS else 0.0
        return length(sub(p, _add(a, _scale(ab, v))))

    cp = sub(p, c)
    d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0.0 and d5 <= d6:
        return length(cp)

    vb = d5 * d2 - d1 * d6
    if vb <= 0.0 and d2 >= 0.0 and d6 <= 0.0:
        denom = d2 - d6
        w = d2 / denom if abs(denom) > EPS else 0.0
        return length(sub(p, _add(a, _scale(ac, w))))

    va = d3 * d6 - d5 * d4
    if va <= 0.0 and (d4 - d3) >= 0.0 and (d5 - d6) >= 0.0:
        denom = (d4 - d3) + (d5 - d6)
        w = (d4 - d3) / denom if abs(denom) > EPS else 0.0
        return length(sub(p, _add(b, _scale(sub(c, b), w))))

    denom = va + vb + vc
    if abs(denom) <= EPS:
        return length(ap)
    v = vb / denom
    w = vc / denom
    proj = _add(_add(a, _scale(ab, v)), _scale(ac, w))
    return length(sub(p, proj))


def segment_segment_distance(p1: Vec, p2: Vec, q1: Vec, q2: Vec) -> float:
    """两线段的最短距离（Ericson 最近点算法，含端点截断）。"""
    d1, d2, r = sub(p2, p1), sub(q2, q1), sub(p1, q1)
    a, e, f = dot(d1, d1), dot(d2, d2), dot(d2, r)
    if a <= EPS and e <= EPS:
        return length(r)
    if a <= EPS:
        s, t = 0.0, _clamp(f / e, 0.0, 1.0)
    else:
        c = dot(d1, r)
        if e <= EPS:
            t, s = 0.0, _clamp(-c / a, 0.0, 1.0)
        else:
            b = dot(d1, d2)
            denom = a * e - b * b
            s = _clamp((b * f - c * e) / denom, 0.0, 1.0) if denom > EPS else 0.0
            t = (b * s + f) / e
            if t < 0.0:
                t, s = 0.0, _clamp(-c / a, 0.0, 1.0)
            elif t > 1.0:
                t, s = 1.0, _clamp((b - c) / a, 0.0, 1.0)
    cp = _add(p1, _scale(d1, s))
    cq = _add(q1, _scale(d2, t))
    return length(sub(cp, cq))


def tri_tri_distance(p: Tri, q: Tri) -> float:
    """两个三角形的最短距离；相交返回 0，不相交取「顶点—面」与「边—边」的最小值。"""
    if _contact(p, q) is not None:
        return 0.0
    best = float("inf")
    for vertex in p:
        best = min(best, point_triangle_distance(vertex, q[0], q[1], q[2]))
    for vertex in q:
        best = min(best, point_triangle_distance(vertex, p[0], p[1], p[2]))
    for i in range(3):
        p1, p2 = p[i], p[(i + 1) % 3]
        for j in range(3):
            q1, q2 = q[j], q[(j + 1) % 3]
            best = min(best, segment_segment_distance(p1, p2, q1, q2))
    return best
