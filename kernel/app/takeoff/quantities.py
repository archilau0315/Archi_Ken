"""工程量推导（QTO）。

优先用真实三角网格计算净体积与总表面积（对齐 Solibri 的 net volume / total area）：
包围盒体积是"毛体积"，会把洞口、凹口、多块拼合的大包围盒一并算进去，
实测复合墙的铝板 / 砂浆层可虚高数倍。网格非闭合（导出件偶见开口壳）时回退包围盒口径。

bbox 为 [minx,miny,minz,maxx,maxy,maxz]，模型单位；结果四舍五入 6 位。
"""

from __future__ import annotations

_DECIMALS = 6


def from_bbox(bbox: list[float]) -> dict[str, float]:
    """由包围盒推导常用体量工程量。"""
    dx = max(bbox[3] - bbox[0], 0.0)
    dy = max(bbox[4] - bbox[1], 0.0)
    dz = max(bbox[5] - bbox[2], 0.0)
    return {
        "length": _round(max(dx, dy, dz)),
        "width": _round(min(dx, dy, dz)),
        "height": _round(dz),
        # 面积取最大投影面（轮廓展开面积），不是包围盒表面积；
        # 墙 / 幕墙 / 板 / 门窗 这类扁平构件的工程量都按正面算。
        "area": _round(max(dx * dy, dy * dz, dx * dz)),
        "volume": _round(dx * dy * dz),
    }


def from_geometry(entry: dict) -> dict[str, float]:
    """由几何条目推导工程量：真实网格优先（净体积 / 总表面积），包围盒兜底。"""
    values = from_bbox(entry.get("bbox") or [0.0] * 6)
    verts = entry.get("verts") or []
    faces = entry.get("faces") or []
    if not verts or not faces:
        # 无自身网格（父构件由子条目合并）：体积 / 表面积取子条目累加结果，其余维持包围盒口径
        for key in ("volume", "surface_area"):
            if entry.get(key) is not None:
                values[key] = _round(entry[key])
        return values
    closed, net, area = _mesh_stats(verts, faces)
    # 表面积只与面片有关，与网格是否闭合无关，恒可用
    values["surface_area"] = _round(area)
    # 净体积必然 ≤ 包围盒体积；非闭合网格（开口壳）散度定理会失真，保持包围盒口径
    if closed and 0.0 < net <= values["volume"] * 1.001:
        values["volume"] = _round(net)
    return values


def _mesh_stats(verts: list[float], faces: list[int]) -> tuple[bool, float, float]:
    """单次遍历网格，返回（是否闭合流形, 净体积, 总表面积）。

    净体积用散度定理：累加各面片与原点构成的有向四面体体积。
    闭合判定：每条有向边只出现一次（闭合流形的邻接面朝向相反）。
    """
    total_v = 0.0
    total_a = 0.0
    edges: set[tuple[int, int]] = set()
    closed = True
    for i in range(0, len(faces) - 2, 3):
        a, b, c = faces[i], faces[i + 1], faces[i + 2]
        ax, ay, az = verts[a * 3], verts[a * 3 + 1], verts[a * 3 + 2]
        bx, by, bz = verts[b * 3], verts[b * 3 + 1], verts[b * 3 + 2]
        cx, cy, cz = verts[c * 3], verts[c * 3 + 1], verts[c * 3 + 2]
        total_v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx - ax, cy - ay, cz - az
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        total_a += (nx * nx + ny * ny + nz * nz) ** 0.5 / 2.0
        if closed:
            for edge in ((a, b), (b, c), (c, a)):
                if edge in edges:
                    closed = False
                    break
                edges.add(edge)
    return closed, abs(total_v) / 6.0, total_a


def _round(value: float) -> float:
    return round(value, _DECIMALS)
