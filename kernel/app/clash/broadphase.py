"""宽相位：轴对齐包围盒候选对筛选。

按 X 轴 min 排序后扫描；一旦后者的 minx 超过前者的 maxx 即跳出，
复杂度由 O(n²) 降为接近 O(n·k)（k 为单构件在 X 上的重叠数）。
`near_pairs` 支持把包围盒按 expand 膨胀，用于间隙/净空这类邻近判定。
`bbox_gap` 给出两包围盒表面间距（实际距离下界），供窄相位前的廉价预筛。

注：曾实现 3D 均匀网格哈希并与本扫描基准对比（2k / 17k / 38k 构件、
疏散与致密两种分布、expand 0 / 0.5），纯 Python 下网格因字典 / 元组
常数因子全面慢于扫描（0.6~0.9x），故保留扫描实现；真实大模型若成为
瓶颈，优先评估 numpy 向量化或 scipy cKDTree 方案。
"""

from __future__ import annotations


def bbox_overlap(a: list[float], b: list[float]) -> bool:
    """两个 [minx,miny,minz,maxx,maxy,maxz] 包围盒三轴均重叠。"""
    return (
        a[0] <= b[3]
        and b[0] <= a[3]
        and a[1] <= b[4]
        and b[1] <= a[4]
        and a[2] <= b[5]
        and b[2] <= a[5]
    )


def bbox_overlap_expanded(a: list[float], b: list[float], expand: float) -> bool:
    """三轴各向外膨胀 expand 后是否重叠（用于邻近对筛选）。"""
    return (
        a[0] <= b[3] + expand
        and b[0] <= a[3] + expand
        and a[1] <= b[4] + expand
        and b[1] <= a[4] + expand
        and a[2] <= b[5] + expand
        and b[2] <= a[5] + expand
    )


def bbox_gap(a: list[float], b: list[float]) -> float:
    """两包围盒表面间距：重叠为 0，否则取三轴分离距离的最大值。

    包围盒间距是构件实际最小距离的下界，可用作三角形求交前的廉价预筛。
    """
    sep_x = max(a[0] - b[3], b[0] - a[3])
    sep_y = max(a[1] - b[4], b[1] - a[4])
    sep_z = max(a[2] - b[5], b[2] - a[5])
    return max(0.0, sep_x, sep_y, sep_z)


def candidate_pairs(entries: dict[str, dict]) -> list[tuple[str, str]]:
    """返回所有包围盒相交的构件对 (guid_a, guid_b)。"""
    items = sorted(((entry["bbox"], guid) for guid, entry in entries.items()), key=lambda item: item[0][0])
    pairs: list[tuple[str, str]] = []
    for i, (bbox_i, guid_i) in enumerate(items):
        for bbox_j, guid_j in items[i + 1 :]:
            if bbox_j[0] > bbox_i[3]:
                break
            if bbox_overlap(bbox_i, bbox_j):
                pairs.append((guid_i, guid_j))
    return pairs


def near_pairs(entries: dict[str, dict], expand: float = 0.0) -> list[tuple[str, str]]:
    """返回包围盒膨胀 expand 后仍相交的构件对（expand=0 等价 candidate_pairs）。"""
    items = sorted(((entry["bbox"], guid) for guid, entry in entries.items()), key=lambda item: item[0][0])
    pairs: list[tuple[str, str]] = []
    for i, (bbox_i, guid_i) in enumerate(items):
        for bbox_j, guid_j in items[i + 1 :]:
            if bbox_j[0] > bbox_i[3] + expand:
                break
            if bbox_overlap_expanded(bbox_i, bbox_j, expand):
                pairs.append((guid_i, guid_j))
    return pairs
