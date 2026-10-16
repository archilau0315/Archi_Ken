"""几何缓存（.kengeo）。

以「模型路径 + 修改时间 + 大小」生成缓存文件名，把每个构件的三角网格与
轴对齐包围盒序列化到磁盘，避免同一模型重复三角化。

二进制格式（小端）：
    magic(6B) | 条目数(u32) | 每条目: guid | ifc_type | discipline | bbox(6×f64)
              | 顶点数(u32)+顶点(f64×n) | 索引数(u32)+索引(i32×n)
              | material(str) | parent_guid(str) | color(str)

顶点用 f64 存储：三角求交对精度敏感，避免 f32 舍入带来的误判。
v3 新增 material 与 parent_guid 字段，支持多材质构件（如幕墙玻璃/框料）拆分。
v4 新增 discipline 字段，使几何接口可按专业分组（如淡化外壳看内部管线）。
v5 discipline 带文件名模型提示（与融合模式口径统一），旧缓存失效重提取。
v6 新增 color 字段（IFC 原生表面颜色 "#rrggbb"，来自 IfcStyledItem），支持原始颜色显示。
v7 新增 transparency 字段（IFC 样式透明度 0~1，-1 表示无），前端据此区分玻璃/框料。
"""

from __future__ import annotations

import hashlib
import struct
from pathlib import Path

from app import config

MAGIC = b"KENGE\x07"


def cache_path(path: str | Path, mtime_ns: int, size: int) -> Path:
    """按模型指纹生成缓存文件路径。"""
    digest = hashlib.sha1(f"{path}|{mtime_ns}|{size}".encode()).hexdigest()[:16]
    return config.geometry_cache_dir() / f"{digest}.kengeo"


def load(file: Path) -> dict[str, dict] | None:
    """读取缓存；文件缺失或损坏时返回 None（由调用方重新提取）。"""
    try:
        with file.open("rb") as fh:
            if fh.read(len(MAGIC)) != MAGIC:
                return None
            entries: dict[str, dict] = {}
            for _ in range(_read_uint(fh)):
                guid = _read_str(fh)
                ifc_type = _read_str(fh)
                discipline = _read_str(fh)
                bbox = list(struct.unpack("<6d", fh.read(48)))
                verts = _read_float_list(fh)
                faces = _read_int_list(fh)
                material = _read_str(fh)
                parent_guid = _read_str(fh)
                color = _read_str(fh)
                transparency = struct.unpack("<f", fh.read(4))[0]
                entries[guid] = {
                    "ifc_type": ifc_type,
                    "discipline": discipline or None,
                    "bbox": bbox,
                    "verts": verts,
                    "faces": faces,
                    "material": material or None,
                    "parent_guid": parent_guid or None,
                    "color": color or None,
                    "transparency": None if transparency < 0 else transparency,
                }
        return entries
    except (OSError, struct.error, UnicodeDecodeError):
        return None


def save(file: Path, entries: dict[str, dict]) -> None:
    """原子写入缓存（先写临时文件再替换），避免半截文件被读到。"""
    file.parent.mkdir(parents=True, exist_ok=True)
    tmp = file.with_suffix(".tmp")
    with tmp.open("wb") as fh:
        fh.write(MAGIC)
        fh.write(struct.pack("<I", len(entries)))
        for guid, entry in entries.items():
            _write_str(fh, guid)
            _write_str(fh, entry["ifc_type"])
            _write_str(fh, entry.get("discipline") or "")
            fh.write(struct.pack("<6d", *entry["bbox"]))
            _write_float_list(fh, entry["verts"])
            _write_int_list(fh, entry["faces"])
            _write_str(fh, entry.get("material") or "")
            _write_str(fh, entry.get("parent_guid") or "")
            _write_str(fh, entry.get("color") or "")
            transparency = entry.get("transparency")
            fh.write(struct.pack("<f", float(transparency) if transparency is not None else -1.0))
    tmp.replace(file)


def _read_uint(fh) -> int:
    return struct.unpack("<I", fh.read(4))[0]


def _read_str(fh) -> str:
    return fh.read(struct.unpack("<H", fh.read(2))[0]).decode("utf-8")


def _read_float_list(fh) -> list[float]:
    count = _read_uint(fh)
    return list(struct.unpack(f"<{count}d", fh.read(8 * count)))


def _read_int_list(fh) -> list[int]:
    count = _read_uint(fh)
    return list(struct.unpack(f"<{count}i", fh.read(4 * count)))


def _write_str(fh, value: str) -> None:
    raw = value.encode("utf-8")
    fh.write(struct.pack("<H", len(raw)))
    fh.write(raw)


def _write_float_list(fh, values: list[float]) -> None:
    fh.write(struct.pack("<I", len(values)))
    fh.write(struct.pack(f"<{len(values)}d", *values))


def _write_int_list(fh, values: list[int]) -> None:
    fh.write(struct.pack("<I", len(values)))
    fh.write(struct.pack(f"<{len(values)}i", *values))
