"""IFC 模型加载与缓存。

对外只暴露 open_model(path)：同样的路径 + 未变更的文件，重复调用直接命中缓存，
保证「同一输入 → 同一输出」且避免重复解析大模型。
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from pathlib import Path

import ifcopenshell

from app import config

logger = logging.getLogger(__name__)

_cache: "OrderedDict[tuple[str, int, int], ifcopenshell.file]" = OrderedDict()


def resolve_path(raw_path: str) -> Path:
    """校验路径：必须是绝对路径、文件存在非空、扩展名合法、且位于允许的根目录内。"""
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        raise ValueError(f"必须是绝对路径：{raw_path}")
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"文件不存在：{path}")
    if path.suffix.lower() not in config.ALLOWED_SUFFIXES:
        raise ValueError(f"不支持的扩展名：{path.suffix}")
    roots = config.model_roots()
    if roots and not any(path.is_relative_to(root) for root in roots):
        raise PermissionError(f"路径不在允许的模型根目录内：{path}")
    if path.stat().st_size == 0:
        raise ValueError(f"文件内容为空，不是有效的 IFC 文件：{path.name}")
    return path


def open_model(raw_path: str) -> ifcopenshell.file:
    """打开（或从缓存取出）IFC 模型。"""
    path = resolve_path(raw_path)
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    cached = _cache.get(key)
    if cached is not None:
        _cache.move_to_end(key)
        return cached

    try:
        model = ifcopenshell.open(str(path))
    except (ifcopenshell.Error, OSError, RuntimeError) as exc:
        # 解析库异常 → 友好 400（记录栈便于定位，避免裸 500）。
        logger.warning(
            "IFC 解析失败 path=%s size=%d exporter_guess=unknown\n%s",
            path,
            stat.st_size,
            exc,
            exc_info=True,
        )
        raise ValueError(f"文件无法解析为有效的 IFC 模型（{path.name}，{stat.st_size} 字节）：{exc}") from exc
    _cache[key] = model
    while len(_cache) > config.MODEL_CACHE_SIZE:
        _cache.popitem(last=False)
    return model
