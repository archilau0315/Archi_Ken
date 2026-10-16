"""冲突矩阵：按专业两两对检，含硬 / 间隙 / 净空分类与忽略规则。

流程：构件专业分类 → 按专业分桶 → 宽相位（含容差膨胀）取候选对 →
忽略规则过滤 → 窄相位分类 → 按「专业对」单元格汇总统计与问题清单。
纯计算、幂等；不持有业务状态。阈值以模型长度单位为口径（由路由换算 mm）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ifcopenshell
import ifcopenshell.util.element

from app import i18n
from app.clash import broadphase, classify, duplicates, engine, ignore, merge
from app.federation import discipline
from app.ifc import summary as ifc_summary

_ORDER = {item["key"]: index for index, item in enumerate(discipline.DISCIPLINES)}


def _type_eq(actual: str, expected: str) -> bool:
    """IFC 类型匹配支持前缀（如 IfcDuct 命中 IfcDuctSegment）。"""
    return actual == expected or actual.startswith(expected)


def _storey_of(element) -> str:
    """取构件所属楼层名；未分配楼层返回空串。"""
    container = ifcopenshell.util.element.get_container(element)
    return getattr(container, "Name", None) or ""


def _in_selection(meta_entry: dict, selection: dict | None) -> bool:
    """构件是否命中选择集；selection 为空表示不过滤（全集）。"""
    if not selection:
        return True
    types = selection.get("ifc_types") or []
    if types and not any(_type_eq(meta_entry["ifc_type"], item) for item in types):
        return False
    storeys = selection.get("storeys") or []
    if storeys and meta_entry.get("storey", "") not in storeys:
        return False
    return True


def _cell_key(a: str, b: str) -> str:
    """专业对单元格键：按专业定义顺序排序，保证 (a,b) 与 (b,a) 一致。"""
    return f"{a}|{b}" if _ORDER.get(a, 99) <= _ORDER.get(b, 99) else f"{b}|{a}"


def _ref(meta: dict, lang: str) -> dict:
    """构件引用（含专业显示名，按语言本地化；parent_guid 供拆分构造层归一）。"""
    return {
        "guid": meta["guid"],
        "parent_guid": meta.get("parent_guid"),
        "name": meta["name"],
        "ifc_type": meta["ifc_type"],
        "discipline": meta["discipline"],
        "discipline_name": i18n.pick_text(discipline.definition(meta["discipline"]), "name", lang),
    }


def run(
    model: ifcopenshell.file,
    entries: dict[str, dict],
    options: dict[str, Any],
    path: str,
    lang: str = "zh",
) -> dict:
    """执行冲突矩阵检测：返回专业矩阵、单元格统计与问题清单。"""
    unit_to_meter = ifc_summary.unit_to_meter(model)
    model_hint = discipline.classify_model(Path(path).name, ifc_summary.exporter(model))["key"]

    selection_a = options.get("selection_a")
    selection_b = options.get("selection_b")
    selections_on = bool(selection_a or selection_b)
    # 仅当选择集带楼层过滤时才逐构件解析楼层名，避免无谓开销。
    need_storey = selections_on and any(
        (sel or {}).get("storeys") for sel in (selection_a, selection_b)
    )

    meta: dict[str, dict] = {}
    counts: dict[str, int] = {}
    for guid, entry in entries.items():
        element = model.by_guid(entry.get("parent_guid") or guid)
        key = discipline.classify_element(element, model_hint)["key"]
        meta[guid] = {
            "guid": guid,
            "parent_guid": entry.get("parent_guid"),
            "ifc_type": entry["ifc_type"],
            "discipline": key,
            "name": getattr(element, "Name", None),
        }
        if need_storey:
            meta[guid]["storey"] = _storey_of(element)
        counts[key] = counts.get(key, 0) + 1

    hard = bool(options.get("hard", True))
    gap = options.get("gap")
    clearance = options.get("clearance")
    rules = options.get("ignore") or []
    ignore_same = bool(options.get("ignore_same_discipline", True))
    cells = options.get("cells") or {}
    max_clashes = int(options.get("max_clashes", 200))
    duplicate_overlap = options.get("duplicate_overlap")  # 0~1，None 表示关闭重复检测
    merge_dist = options.get("merge_dist")  # 模型单位；None 表示不合并邻近碰撞

    # 自定义构件对：宽相位前先按选择集收窄范围，减少候选对。
    scope = entries
    if selections_on:
        scope = {
            guid: entry
            for guid, entry in entries.items()
            if _in_selection(meta[guid], selection_a) or _in_selection(meta[guid], selection_b)
        }

    thresholds = [value for value in (gap, clearance) if value is not None]
    expand = max(thresholds) if thresholds else 0.0
    pairs = broadphase.near_pairs(scope, expand)

    tri_cache: dict[str, list] = {}

    def tris(guid: str) -> list:
        if guid not in tri_cache:
            tri_cache[guid] = engine.triangles(entries[guid])
        return tri_cache[guid]

    items: list[dict] = []
    ignored = 0
    tests = 0
    truncated = False
    for guid_a, guid_b in pairs:
        meta_a, meta_b = meta[guid_a], meta[guid_b]
        # 自定义构件对：仅保留「一侧命中 A、另一侧命中 B」的交叉对。
        if selections_on and not (
            (_in_selection(meta_a, selection_a) and _in_selection(meta_b, selection_b))
            or (_in_selection(meta_b, selection_a) and _in_selection(meta_a, selection_b))
        ):
            continue
        if ignore.should_ignore(meta_a, meta_b, rules, ignore_same):
            ignored += 1
            continue

        key = _cell_key(meta_a["discipline"], meta_b["discipline"])
        cfg = cells.get(key)
        cell_hard = hard if cfg is None else bool(cfg.get("hard", hard))
        cell_gap = gap if (cfg is None or cfg.get("gap", True)) else None
        cell_clear = clearance if (cfg is None or cfg.get("clearance", True)) else None
        if not cell_hard and cell_gap is None and cell_clear is None:
            continue

        result = classify.classify_pair(tris(guid_a), tris(guid_b), cell_gap, cell_clear)
        tests += result["tests"]
        mode = result["mode"]
        if mode is None:
            continue
        if mode == "hard" and not cell_hard:
            continue
        if mode == "gap" and cell_gap is None:
            continue
        if mode == "clearance" and cell_clear is None:
            continue

        contact = result["contact_point"]
        items.append(
            {
                "mode": mode,
                "cell": key,
                "a": _ref(meta_a, lang),
                "b": _ref(meta_b, lang),
                "distance": result["distance"],
                "contact_point": [round(value, 6) for value in contact] if contact else None,
                "triangle_pairs": result["triangle_pairs"],
                "overlap": None,
            }
        )
        if len(items) >= max_clashes:
            truncated = True
            break

    # 重复构件检测：独立于碰撞分类，不受「忽略同专业」与单元格启停影响（重复本就多为同专业）。
    if duplicate_overlap is not None and len(items) < max_clashes:
        for guid_a, guid_b, ratio in duplicates.run(scope, duplicate_overlap):
            meta_a, meta_b = meta[guid_a], meta[guid_b]
            if ignore.should_ignore(meta_a, meta_b, rules, False):
                ignored += 1
                continue
            items.append(
                {
                    "mode": "duplicate",
                    "cell": _cell_key(meta_a["discipline"], meta_b["discipline"]),
                    "a": _ref(meta_a, lang),
                    "b": _ref(meta_b, lang),
                    "distance": None,
                    "contact_point": None,
                    "triangle_pairs": 0,
                    "overlap": ratio,
                }
            )
            if len(items) >= max_clashes:
                truncated = True
                break

    # 邻近碰撞合并（硬碰撞专属；无接触点的间隙 / 净空 / 重复保持单条），再按最终清单统计单元格。
    items = merge.apply(items, merge_dist)
    cell_stats: dict[str, dict] = {}
    for item in items:
        key = item["cell"]
        cell_a, cell_b = key.split("|")
        stat = cell_stats.setdefault(
            key,
            {"key": key, "a": cell_a, "b": cell_b, "hard": 0, "gap": 0, "clearance": 0, "duplicate": 0, "total": 0},
        )
        stat[item["mode"]] += 1
        stat["total"] += 1

    disciplines = [
        {
            "key": item["key"],
            "name": i18n.pick_text(item, "name", lang),
            "color": item["color"],
            "element_count": counts.get(item["key"], 0),
        }
        for item in discipline.DISCIPLINES
        if counts.get(item["key"], 0) > 0
    ]
    cell_list = sorted(cell_stats.values(), key=lambda s: (_ORDER.get(s["a"], 99), _ORDER.get(s["b"], 99)))

    totals = {
        "hard": sum(c["hard"] for c in cell_list),
        "gap": sum(c["gap"] for c in cell_list),
        "clearance": sum(c["clearance"] for c in cell_list),
        "duplicate": sum(c["duplicate"] for c in cell_list),
        "total": len(items),
    }
    return {
        "path": path,
        "unit_to_meter": unit_to_meter,
        "modes": {"hard": hard, "gap": gap is not None, "clearance": clearance is not None, "duplicate": duplicate_overlap is not None},
        "thresholds": {"gap": gap, "clearance": clearance, "duplicate_overlap": duplicate_overlap},
        "disciplines": disciplines,
        "cells": cell_list,
        "totals": totals,
        "candidate_pairs": len(pairs),
        "triangle_tests": tests,
        "ignored": ignored,
        "truncated": truncated,
        "selections": {"a": selection_a, "b": selection_b} if selections_on else None,
        "items": items,
    }
