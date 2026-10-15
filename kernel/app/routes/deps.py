"""路由公共依赖：统一打开模型并映射错误码。"""

from __future__ import annotations

import ifcopenshell
from fastapi import HTTPException

from app.ifc import loader


def open_model(path: str) -> ifcopenshell.file:
    """打开模型；路径/权限/格式问题分别映射为 404 / 403 / 400。"""
    try:
        return loader.open_model(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
