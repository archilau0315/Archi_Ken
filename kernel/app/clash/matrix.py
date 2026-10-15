"""冲突矩阵：按专业两两对检，含硬 / 间隙 / 净空分类与忽略规则。

流程：构件专业分类 → 按专业分桶 → 宽相位（含容差膨胀）取候选对 →
忽略规则过滤 → 窄相位分类 → 按「专业对」单元格汇总统计与问题清单。
纯计算、幂等；不持有业务状态。阈值以模型长度单位为口径（由路由换算 mm）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ifcopenshell

from app import i18n
from app.clash import broadphase, classify, engine, ignore
from app.federation import discipline
from app.ifc import summary as ifc_summary

_ORDER = {item["key"]: index for index, item in enumerate(discipline.DISCIPLINES)}


def _cell_key(a: str, b: str) -> str:
    """专业对单元格键：按专业定义顺序排序，保证 (a,b) 与 (b,a) 一致。"""
    return f"{a}|{b}" if _ORDER.get(a, 99) <= _ORDER.get(b, 99) else f"{b}|{a}"


def _ref(meta: dict, lang: str) -> dict:
    """构件引用（含专业显示名，按语言本地化）。"""
    return {
        "guid": meta["guid"],
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

    meta: dict[str, dict] = {}
    counts: dict[str, int] = {}
    for guid, entry in entries.items():
        element = model.by_guid(entry.get("parent_guid") or guid)
        key = discipline.classify_element(element, model_hint)["key"]
        meta[guid] = {
            "guid": guid,
            "ifc_type": entry["ifc_type"],
            "discipline": key,
            "name": getattr(element, "Name", None),
        }
        counts[key] = counts.get(key, 0) + 1

    hard = bool(options.get("hard", True))
    gap = options.get("gap")
    clearance = options.get("clearance")
    rules = options.get("ignore") or []
    ignore_same = bool(options.get("ignore_same_discipline", True))
    cells = options.get("cells") or {}
    max_clashes = int(options.get("max_clashes", 200))

    thresholds = [value for value in (gap, clearance) if value is not None]
    expand = max(thresholds) if thresholds else 0.0
    pairs = broadphase.near_pairs(entries, expand)

    tri_cache: dict[str, list] = {}

    def tris(guid: str) -> list:
        if guid not in tri_cache:
            tri_cache[guid] = engine.triangles(entries[guid])
        return tri_cache[guid]

    items: list[dict] = []
    cell_stats: dict[str, dict] = {}
    ignored = 0
    tests = 0
    truncated = False
    for guid_a, guid_b in pairs:
        meta_a, meta_b = meta[guid_a], meta[guid_b]
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

        cell_a, cell_b = key.split("|")
        stat = cell_stats.setdefault(
            key,
            {"key": key, "a": cell_a, "b": cell_b, "hard": 0, "gap": 0, "clearance": 0, "total": 0},
        )
        stat[mode] += 1
        stat["total"] += 1

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
            }
        )
        if len(items) >= max_clashes:
            truncated = True
            break

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
        "total": len(items),
    }
    return {
        "path": path,
        "unit_to_meter": unit_to_meter,
        "modes": {"hard": hard, "gap": gap is not None, "clearance": clearance is not None},
        "thresholds": {"gap": gap, "clearance": clearance},
        "disciplines": disciplines,
        "cells": cell_list,
        "totals": totals,
        "candidate_pairs": len(pairs),
        "triangle_tests": tests,
        "ignored": ignored,
        "truncated": truncated,
        "items": items,
    }
