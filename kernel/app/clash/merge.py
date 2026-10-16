"""碰撞合并分组：把接触点邻近且共享同一构件的多条碰撞合并为一个 issue。

典型场景：一根梁穿过风管（或幕墙龙骨穿过面板区），会与多个相邻构件各产生
一条碰撞，问题清单被刷屏。对齐 Solibri 的合并口径：接触点间距在合并半径内、
且两条碰撞共享同一构件（父 GUID 归一）时归并为一组。
判定用并查集；仅合并带接触点的项（硬碰撞），间隙 / 净空 / 重复保持单条。
纯计算、幂等，不依赖 ifcopenshell。
"""

from __future__ import annotations


def _dist2(p: list[float], q: list[float]) -> float:
    """两点平方距离（避免开方）。"""
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2


def _guids(item: dict) -> set:
    """一条碰撞涉及的构件集合：a/b 两侧条目键 + 父 GUID（拆分构造层归一）。"""
    result = set()
    for side in ("a", "b"):
        ref = item[side]
        result.add(ref["guid"])
        parent = ref.get("parent_guid")
        if parent:
            result.add(parent)
    return result


def _cluster(items: list[dict], merge_dist: float) -> list[list[int]]:
    """并查集分组：返回成员索引组的列表（按组内最小索引排序，保持原顺序）。"""
    n = len(items)
    root = list(range(n))

    def find(x: int) -> int:
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    limit2 = merge_dist * merge_dist
    for i in range(n):
        pi = items[i].get("contact_point")
        if not pi:
            continue
        gi = _guids(items[i])
        for j in range(i + 1, n):
            pj = items[j].get("contact_point")
            if not pj or _dist2(pi, pj) > limit2:
                continue
            if not (gi & _guids(items[j])):
                continue
            ri, rj = find(i), find(j)
            if ri != rj:
                root[rj] = ri

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return sorted(groups.values(), key=lambda group: group[0])


def apply(items: list[dict], merge_dist: float | None) -> list[dict]:
    """合并邻近碰撞：返回新的问题清单。

    每项保证带 merged（合并条数，单条为 1）与 related_guids（涉及的全部条目键，
    供视图框选 / 隔离）。merge_dist 为 None 或组内仅一条时不做合并，仅补字段。
    """
    if not merge_dist:
        for item in items:
            item["merged"] = 1
            item["related_guids"] = [item["a"]["guid"], item["b"]["guid"]]
        return items

    merged_items: list[dict] = []
    for group in _cluster(items, merge_dist):
        if len(group) == 1:
            item = items[group[0]]
            item["merged"] = 1
            item["related_guids"] = [item["a"]["guid"], item["b"]["guid"]]
            merged_items.append(item)
            continue

        members = [items[index] for index in group]
        # 代表构件：组内出现次数最多的 GUID（父级归一）；另一侧取首个非代表构件。
        counts: dict[str, int] = {}
        for member in members:
            for guid in _guids(member):
                counts[guid] = counts.get(guid, 0) + 1
        common = max(counts, key=lambda guid: counts[guid])
        rep = None
        other = None
        for member in members:
            for side in ("a", "b"):
                ref = member[side]
                if ref["guid"] == common or ref.get("parent_guid") == common:
                    rep = rep or ref
                elif other is None:
                    other = ref

        points = [member["contact_point"] for member in members if member.get("contact_point")]
        centroid = (
            [round(sum(point[k] for point in points) / len(points), 6) for k in range(3)] if points else None
        )
        distances = [member["distance"] for member in members if member.get("distance") is not None]
        first = members[0]
        merged_items.append(
            {
                "mode": first["mode"],
                "cell": first["cell"],
                "a": rep or first["a"],
                "b": other or first["b"],
                "distance": round(min(distances), 6) if distances else None,
                "contact_point": centroid,
                "triangle_pairs": sum(member["triangle_pairs"] for member in members),
                "overlap": None,
                "merged": len(members),
                "related_guids": sorted({ref["guid"] for member in members for ref in (member["a"], member["b"])}),
            }
        )
    return merged_items
