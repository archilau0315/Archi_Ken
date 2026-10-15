"""IDS 文档读写：XML / 文件 → ifctester Ids 对象，并生成面向编辑器的结构预览。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ifctester import ids, reporter

# IDS 头部信息字段（与 IDS 1.0 schema 的 info 元素一致）。
INFO_FIELDS = ("title", "copyright", "version", "description", "author", "date", "purpose", "milestone")


class IdsError(ValueError):
    """IDS 文档不合法：XML 结构错误或不符合 IDS schema。"""


def load_xml(text: str) -> ids.Ids:
    """从 IDS XML 文本解析为 Ids 对象；非法时抛 IdsError。"""
    if not text or not text.strip():
        raise IdsError("IDS 内容为空")
    try:
        return ids.from_string(text)
    except Exception as exc:  # noqa: BLE001 —— 底层为 xmlschema 校验异常，统一归并为 IdsError
        raise IdsError(f"IDS 解析失败：{exc}") from exc


def load_file(path: str | Path) -> ids.Ids:
    """从 .ids 文件解析为 Ids 对象；文件缺失抛 FileNotFoundError，非法抛 IdsError。"""
    target = Path(path)
    if not target.is_file():
        raise FileNotFoundError(f"IDS 文件不存在：{target}")
    try:
        return ids.open(str(target))
    except Exception as exc:  # noqa: BLE001
        raise IdsError(f"IDS 文件解析失败：{exc}") from exc


def to_xml(document: ids.Ids) -> str:
    """Ids 对象 → 规范化 IDS XML 文本。"""
    return document.to_string()


def info(document: ids.Ids) -> dict[str, Any]:
    """提取 IDS 头部信息（仅保留有值字段）。"""
    raw = document.info or {}
    return {key: raw[key] for key in INFO_FIELDS if raw.get(key) is not None}


def _facet_text(facet: Any, clause: str, specification: Any) -> str:
    """把 facet 渲染为可读文本；失败时退回类型名。"""
    try:
        return facet.to_string(clause, specification, facet)
    except Exception:  # noqa: BLE001
        return type(facet).__name__


def describe(document: ids.Ids) -> dict[str, Any]:
    """生成编辑器用结构预览：规范 / 适用性 / 要求（含可读标签与取值）。"""
    specifications = []
    for specification in document.specifications:
        requirements = []
        for requirement in specification.requirements:
            label, value = reporter.get_requirement_label_value(requirement)
            requirements.append(
                {
                    "facet_type": type(requirement).__name__,
                    "label": label,
                    "value": value,
                    "description": _facet_text(requirement, "requirement", specification),
                }
            )
        specifications.append(
            {
                "name": specification.name,
                "description": specification.description,
                "identifier": specification.identifier,
                "ifc_version": specification.ifcVersion,
                "cardinality": reporter.get_cardinality(specification),
                "applicability": [
                    {"facet_type": type(facet).__name__, "description": _facet_text(facet, "applicability", specification)}
                    for facet in specification.applicability
                ],
                "requirements": requirements,
            }
        )
    return {
        "info": info(document),
        "specification_count": len(specifications),
        "specifications": specifications,
    }
