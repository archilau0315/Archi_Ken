"""服务端文案国际化（M12）：双语字段选择与语言参数解析。

规则：双语字段以 ``_en`` 后缀存储英文，原字段为中文；``lang=zh`` 返回中文，``lang=en`` 返回英文。
未提供 lang 时默认中文（保持向后兼容）。
"""

from __future__ import annotations

from typing import Any

Lang = str  # "zh" | "en"


def pick_lang(raw: str | None) -> Lang:
    """把查询参数规范化为内部语言标识。"""
    return "en" if raw == "en" else "zh"


def pick_text(obj: dict[str, Any], key: str, lang: Lang) -> str:
    """按语言取字段：``lang=en`` 优先取 ``key_en``，缺省回退原字段。"""
    if lang == "en":
        en_key = f"{key}_en"
        if en_key in obj and obj[en_key]:
            return str(obj[en_key])
    return str(obj.get(key, ""))


def localize_rule(rule: dict[str, Any], lang: Lang) -> dict[str, Any]:
    """返回按语言本地化的规则副本（name / category / message / reference）。"""
    out = dict(rule)
    out["name"] = pick_text(rule, "name", lang)
    out["category"] = pick_text(rule, "category", lang)
    out["message"] = pick_text(rule, "message", lang)
    out["reference"] = pick_text(rule, "reference", lang)
    return out


def localize_rules(rules: list[dict[str, Any]], lang: Lang) -> list[dict[str, Any]]:
    return [localize_rule(rule, lang) for rule in rules]


def localize_preset(preset: dict[str, Any], lang: Lang) -> dict[str, Any]:
    """返回按语言本地化的预设副本（name / description / categories）。"""
    out = dict(preset)
    out["name"] = pick_text(preset, "name", lang)
    out["description"] = pick_text(preset, "description", lang)
    out["categories"] = [pick_text({"c": c}, "c", lang) for c in preset["categories"]]
    return out


def localize_discipline(disc: dict[str, Any], lang: Lang) -> dict[str, Any]:
    """返回按语言本地化的专业定义副本（name）。"""
    out = dict(disc)
    out["name"] = pick_text(disc, "name", lang)
    return out
