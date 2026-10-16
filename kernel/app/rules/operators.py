"""规则算子：比较运算与单位换算（纯函数、无外部依赖）。

约定：构件的数值型属性（如 Pset 中的尺寸）视作「模型长度单位」；
规则中的阈值通过 unit 字段声明单位，换算到模型单位后参与比较。
"""

from __future__ import annotations

import re
from typing import Any

# 缺失值哨兵：区分「属性不存在」与「属性值为 0/空串」
MISSING = object()

# 单位 → 米 的换算系数；model 表示沿用模型自身单位（不换算）
UNIT_FACTORS: dict[str, float] = {"m": 1.0, "meter": 1.0, "metre": 1.0, "cm": 0.01, "mm": 0.001}

# 面积单位 → 平方米 的换算系数（用于 Qto 面积类属性比较）
AREA_FACTORS: dict[str, float] = {"m2": 1.0, "sqm": 1.0, "cm2": 1e-4, "mm2": 1e-6}


def to_model_units(value: float, unit: str, model_unit_to_meter: float) -> float:
    """把阈值的 unit 换算为模型单位的数值（长度按一次方、面积按平方）。

    model_unit_to_meter：模型 1 单位 = 多少米（由 IfcOpenShell 单位换算给出）。
    """
    if unit in ("model", "", None):
        return float(value)
    area = AREA_FACTORS.get(unit)
    if area is not None:
        return float(value) * area / (model_unit_to_meter**2)
    factor = UNIT_FACTORS.get(unit)
    if factor is None:
        raise ValueError(f"不支持的单位：{unit}（可选 model/m/cm/mm/m2/cm2/mm2）")
    return float(value) * factor / model_unit_to_meter


def _as_number(value: Any) -> float | None:
    """尽力把值转成数值；bool 不参与数值比较（避免 True 当 1）。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def compare(op: str, left: Any, right: Any) -> bool:
    """按 op 比较 left（实际值）与 right（期望值）。

    exists/not_exists 语义：空字符串视为「未填写」——部分建模工具会导出
    空串占位属性（如 FireRating=""），若不剔除会把未标注构件误判为已标注。
    """
    if op == "exists":
        return left is not MISSING and left is not None and left != ""
    if op == "not_exists":
        return left is MISSING or left is None or left == ""
    if left is MISSING or left is None:
        return False
    if op == "in":
        return isinstance(right, (list, tuple, set)) and left in right
    if op == "contains":
        return str(right) in str(left)
    if op == "startswith":
        return str(left).startswith(str(right))
    if op == "endswith":
        return str(left).endswith(str(right))
    if op in ("matches", "regex"):
        return re.search(str(right), str(left)) is not None

    ln, rn = _as_number(left), _as_number(right)
    l, r = (ln, rn) if ln is not None and rn is not None else (left, right)
    if op == "==":
        return l == r
    if op == "!=":
        return l != r
    if op == ">":
        return l > r
    if op == ">=":
        return l >= r
    if op == "<":
        return l < r
    if op == "<=":
        return l <= r
    raise ValueError(f"未知算子：{op}")
