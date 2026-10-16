"""信息提取列定义：固定字段 + 自定义计算列的规范化与校验。"""

from __future__ import annotations

from typing import Any

from app.takeoff.expr import ExprError, check

class ColumnError(ValueError):
    """列定义非法。"""

# 每行固定携带的基础字段（不参与表达式计算）。
FIXED_FIELDS: list[dict[str, str]] = [
    {"key": "guid", "name": "GUID", "name_en": "GUID"},
    {"key": "name", "name": "构件名称", "name_en": "Element Name"},
    {"key": "ifc_type", "name": "IFC 类型", "name_en": "IFC Type"},
    {"key": "container", "name": "所在容器", "name_en": "Container"},
]

# 内置建议列：开箱即用的常用 ITO 计算列（expr 基于工程量与属性）。
SUGGESTED_COLUMNS: list[dict[str, str]] = [
    {"key": "volume", "name": "体积", "name_en": "Volume", "expr": "qty('volume')"},
    {"key": "surface_area", "name": "表面积", "name_en": "Surface Area", "expr": "qty('area')"},
    {"key": "height", "name": "高度", "name_en": "Height", "expr": "qty('height')"},
    {"key": "width", "name": "宽度", "name_en": "Width", "expr": "qty('width')"},
    {"key": "length", "name": "长度", "name_en": "Length", "expr": "qty('length')"},
]


def localize_columns(columns: list[dict[str, str]], lang: str) -> list[dict[str, str]]:
    """按语言选择列名：lang=en 时用 name_en，否则用 name。"""
    use_en = lang == "en"
    out = []
    for col in columns:
        item = dict(col)
        item["name"] = col.get("name_en") if (use_en and col.get("name_en")) else col["name"]
        out.append(item)
    return out

def normalize_columns(items: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    """校验并规范化自定义列：key 唯一非空、expr 必填且语法合法。"""
    if not items:
        return []
    seen: set[str] = set()
    columns: list[dict[str, str]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ColumnError(f"第 {index + 1} 列定义必须是对象")
        key = str(item.get("key") or "").strip()
        expr = str(item.get("expr") or "").strip()
        if not key:
            raise ColumnError(f"第 {index + 1} 列缺少 key")
        if key in FIXED_KEY_SET:
            raise ColumnError(f"列 key「{key}」与固定字段重名")
        if key in seen:
            raise ColumnError(f"列 key「{key}」重复")
        if not expr:
            raise ColumnError(f"列「{key}」缺少表达式 expr")
        try:
            check(expr)
        except ExprError as exc:
            raise ColumnError(f"列「{key}」表达式非法：{exc}") from exc
        seen.add(key)
        col = {"key": key, "name": str(item.get("name") or key), "expr": expr}
        name_en = item.get("name_en")
        if isinstance(name_en, str) and name_en.strip():
            col["name_en"] = name_en.strip()
        # 计量单位随列透传（表头与 Excel 导出展示为「面积 (m²)」）
        unit = item.get("unit")
        if isinstance(unit, str) and unit.strip():
            col["unit"] = unit.strip()
        columns.append(col)
    return columns

FIXED_KEY_SET = {field["key"] for field in FIXED_FIELDS}
