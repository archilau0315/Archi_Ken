"""重复构件检测：同类型构件包围盒高度重合视为重复（纯宽相位，无三角形精算）。

对齐 Solibri 的 Duplicates 检查口径：同一位置被放置两次的构件（如同一面墙
建模两遍）是常见建模错误。判据为「同 ifc_type 且包围盒重合度 ≥ 阈值」，
重合度 = 交集体积 / 较小者体积（小构件被大构件完全罩住时亦为 1）。
多材质拆分条目（<guid>#mN，属同一父构件的构造层）互相不参与比较。
纯计算、幂等；复用 broadphase 候选对筛选。
"""

from __future__ import annotations

from app.clash import broadphase


def _overlap_ratio(a: list[float], b: list[float]) -> float:
    """两包围盒重合度：交集体积 / 较小者体积（0~1；不重叠为 0）。"""
    dx = min(a[3], b[3]) - max(a[0], b[0])
    dy = min(a[4], b[4]) - max(a[1], b[1])
    dz = min(a[5], b[5]) - max(a[2], b[2])
    if dx <= 0 or dy <= 0 or dz <= 0:
        return 0.0
    volume_a = (a[3] - a[0]) * (a[4] - a[1]) * (a[5] - a[2])
    volume_b = (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2])
    smaller = min(volume_a, volume_b)
    if smaller <= 0:
        return 0.0
    return dx * dy * dz / smaller


def _same_parent(entries: dict[str, dict], guid_a: str, guid_b: str) -> bool:
    """两条目是否属同一父构件（构造层拆分条目互为同父）。"""
    parent_a = entries[guid_a].get("parent_guid") or guid_a
    parent_b = entries[guid_b].get("parent_guid") or guid_b
    return parent_a == parent_b


def run(entries: dict[str, dict], threshold: float) -> list[tuple[str, str, float]]:
    """返回 [(guid_a, guid_b, ratio)]：同 ifc_type 且重合度 ≥ threshold 的构件对。"""
    by_type: dict[str, list[str]] = {}
    for guid, entry in entries.items():
        by_type.setdefault(entry["ifc_type"], []).append(guid)

    results: list[tuple[str, str, float]] = []
    for guids in by_type.values():
        if len(guids) < 2:
            continue
        subset = {guid: entries[guid] for guid in guids}
        for guid_a, guid_b in broadphase.candidate_pairs(subset):
            if _same_parent(entries, guid_a, guid_b):
                continue
            ratio = _overlap_ratio(entries[guid_a]["bbox"], entries[guid_b]["bbox"])
            if ratio >= threshold:
                results.append((guid_a, guid_b, round(ratio, 4)))
    return results
