"""硬碰撞引擎：宽相位筛候选构件对，窄相位逐三角形精确求交。"""

from __future__ import annotations

import ifcopenshell

from app.clash import broadphase, geommath

HIT_LIMIT = 5  # 单对构件最多记录几组相交三角形（拿到接触点即可）
TEST_LIMIT = 200_000  # 单对构件三角形测试次数上限，防止超长响应


def triangles(entry: dict) -> list[tuple[geommath.Tri, list[float]]]:
    """把构件网格拆成 (三角形, 三角形包围盒) 列表。"""
    verts, faces = entry["verts"], entry["faces"]
    result = []
    for k in range(0, len(faces), 3):
        tri = tuple(
            (verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]) for i in (faces[k], faces[k + 1], faces[k + 2])
        )
        xs = (tri[0][0], tri[1][0], tri[2][0])
        ys = (tri[0][1], tri[1][1], tri[2][1])
        zs = (tri[0][2], tri[1][2], tri[2][2])
        result.append((tri, [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]))
    return result


def _pair_clash(tri_a: list, tri_b: list) -> dict:
    """对一对构件做三角形求交，返回接触点数与测试次数。"""
    hits = 0
    tests = 0
    contact: list[float] | None = None
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
                    return {"contact": contact, "hits": hits, "tests": tests}
            if tests >= TEST_LIMIT:
                return {"contact": contact, "hits": hits, "tests": tests}
    return {"contact": contact, "hits": hits, "tests": tests}


def _ref(model: ifcopenshell.file, guid: str, entry: dict) -> dict:
    element = model.by_guid(entry.get("parent_guid") or guid)
    return {"guid": guid, "ifc_type": entry["ifc_type"], "name": getattr(element, "Name", None)}


def run(
    model: ifcopenshell.file,
    entries: dict[str, dict],
    ifc_type_a: str | None = None,
    ifc_type_b: str | None = None,
    max_clashes: int = 200,
) -> dict:
    """执行硬碰撞检测：返回碰撞清单与统计。"""
    set_a = {guid for guid, entry in entries.items() if ifc_type_a is None or entry["ifc_type"] == ifc_type_a}
    set_b = {guid for guid, entry in entries.items() if ifc_type_b is None or entry["ifc_type"] == ifc_type_b}
    scope = {guid: entries[guid] for guid in set_a | set_b}
    candidates = broadphase.candidate_pairs(scope)

    tri_cache: dict[str, list] = {}

    def tris(guid: str) -> list:
        if guid not in tri_cache:
            tri_cache[guid] = triangles(entries[guid])
        return tri_cache[guid]

    items: list[dict] = []
    tests = 0
    truncated = False
    for guid_a, guid_b in candidates:
        if not (guid_a in set_a and guid_b in set_b) and not (guid_a in set_b and guid_b in set_a):
            continue
        result = _pair_clash(tris(guid_a), tris(guid_b))
        tests += result["tests"]
        if result["hits"] == 0:
            continue
        items.append(
            {
                "a": _ref(model, guid_a, entries[guid_a]),
                "b": _ref(model, guid_b, entries[guid_b]),
                "contact_point": [round(value, 6) for value in result["contact"]] if result["contact"] else None,
                "triangle_pairs": result["hits"],
            }
        )
        if len(items) >= max_clashes:
            truncated = True
            break

    return {
        "total": len(items),
        "candidate_pairs": len(candidates),
        "triangle_tests": tests,
        "truncated": truncated,
        "items": items,
    }
