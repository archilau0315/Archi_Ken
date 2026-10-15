"""内核配置。

默认仅允许访问项目 corpus 目录下的模型文件；可通过环境变量
ARCHIKEN_MODEL_ROOTS（多个路径用系统分隔符分隔）扩展或覆盖。
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

ALLOWED_SUFFIXES = {".ifc", ".ifczip"}

# 模型缓存数量上限（按文件路径 + 修改时间 + 大小 作为键）
MODEL_CACHE_SIZE = 4


def model_roots() -> list[Path]:
    """返回允许读取模型的根目录列表。"""
    raw = os.environ.get("ARCHIKEN_MODEL_ROOTS", "").strip()
    if raw:
        return [Path(item).expanduser().resolve() for item in raw.split(os.pathsep) if item.strip()]
    return [(PROJECT_ROOT / "corpus").resolve(), (PROJECT_ROOT / ".data" / "uploads").resolve()]


def geometry_cache_dir() -> Path:
    """几何缓存（.achigeo）存放目录，默认项目根下 .cache/geometry。"""
    raw = os.environ.get("ARCHIKEN_CACHE_DIR", "").strip()
    base = Path(raw).expanduser().resolve() if raw else (PROJECT_ROOT / ".cache")
    return base / "geometry"


def exports_dir() -> Path:
    """导出文件（信息提取 Excel 等）存放目录，默认项目根下 .data/exports。"""
    raw = os.environ.get("ARCHIKEN_DATA_DIR", "").strip()
    base = Path(raw).expanduser().resolve() if raw else (PROJECT_ROOT / ".data")
    return base / "exports"
