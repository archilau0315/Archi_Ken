"""工程量推导（QTO v1）：由包围盒尺寸近似推导体量工程量。

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

def _round(value: float) -> float:
    return round(value, _DECIMALS)
