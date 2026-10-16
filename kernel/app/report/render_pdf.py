"""PDF 报告渲染（M9）：reportlab 生成封面摘要 + 按严重度分组的问题清单表。

中文使用内置 CID 字体 STSong-Light，无需外部字体文件；
写入采用临时文件 + 原子替换，避免并发读写损坏产物。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT = "STSong-Light"
SEVERITY_ORDER = ("error", "warning", "info")

I18N = {
    "zh": {
        "severity": {"error": "错误", "warning": "警告", "info": "提示"},
        "source": {"rule": "规则", "clash": "碰撞"},
        "title": "ArchiKen 模型检查报告",
        "model": "模型",
        "generated_at": "生成时间",
        "summary": ["问题总数", "错误", "警告", "提示", "硬碰撞", "未通过规则"],
        "headers": ("分类 / 规则", "构件", "关联构件", "原因（含判定链）", "位置", "来源"),
        "empty": "未发现问题：所有检查均通过。",
    },
    "en": {
        "severity": {"error": "Error", "warning": "Warning", "info": "Info"},
        "source": {"rule": "Rule", "clash": "Clash"},
        "title": "ArchiKen Model Check Report",
        "model": "Model",
        "generated_at": "Generated at",
        "summary": ["Total Issues", "Errors", "Warnings", "Infos", "Hard Clashes", "Failed Rules"],
        "headers": ("Category / Rule", "Element", "Related Element", "Reason (with decision chain)", "Location", "Source"),
        "empty": "No issues found: all checks passed.",
    },
}

INK = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")
LINE = colors.HexColor("#d0d5dd")
HEAD_BG = colors.HexColor("#f2f4f7")
SEVERITY_COLOR = {
    "error": colors.HexColor("#d92d20"),
    "warning": colors.HexColor("#dc6803"),
    "info": colors.HexColor("#1570ef"),
}

_font_ready = False


def _ensure_font() -> None:
    """注册中文 CID 字体（幂等）。"""
    global _font_ready
    if not _font_ready:
        pdfmetrics.registerFont(UnicodeCIDFont(FONT))
        _font_ready = True


def _esc(value: Any) -> str:
    """转义 Paragraph 迷你标记语言中的特殊字符。"""
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _fmt(value: Any) -> str:
    """数值保留 3 位小数；列表逗号连接；空值显示 —。"""
    if value is None:
        return "—"
    if isinstance(value, (int, float)):
        return str(round(value, 3))
    if isinstance(value, list):
        return ", ".join(_fmt(item) for item in value)
    return str(value)


def _element_text(ref: dict | None) -> str:
    """构件单元格：名称（类型）+ 第二行小字 GUID（供报告溯源）。"""
    if not ref:
        return "—"
    name = ref.get("name") or ref.get("guid") or "—"
    ifc_type = ref.get("ifc_type") or ""
    main = f"{name}（{ifc_type}）" if ifc_type else str(name)
    guid = ref.get("guid") or ""
    if guid:
        main += f'<br/><font size="7" color="#6b7280">{_esc(guid)}</font>'
    return main


def _location_text(location: Any) -> str:
    if isinstance(location, list) and location:
        return ", ".join(str(round(float(v), 3)) for v in location[:3])
    return "—"


def _styles() -> dict[str, ParagraphStyle]:
    _ensure_font()
    return {
        "title": ParagraphStyle("title", fontName=FONT, fontSize=20, leading=26, textColor=INK, spaceAfter=2 * mm),
        "meta": ParagraphStyle("meta", fontName=FONT, fontSize=9, leading=14, textColor=MUTED),
        "h2": ParagraphStyle("h2", fontName=FONT, fontSize=13, leading=18, textColor=INK, spaceBefore=5 * mm, spaceAfter=2 * mm),
        "cell": ParagraphStyle("cell", fontName=FONT, fontSize=8.5, leading=12, textColor=INK),
        "muted": ParagraphStyle("muted", fontName=FONT, fontSize=8, leading=11, textColor=MUTED),
        "head": ParagraphStyle("head", fontName=FONT, fontSize=9, leading=12, textColor=INK),
    }


def _summary_grid(report: dict, styles: dict[str, ParagraphStyle], lang: str = "zh") -> Table:
    """封面摘要统计格：总数 / 错误 / 警告 / 提示 / 碰撞 / 规则未通过。"""
    summary = report.get("summary") or {}
    by_severity = summary.get("by_severity") or {}
    txt = I18N[lang if lang in I18N else "zh"]
    labels = txt["summary"]
    values = [
        summary.get("total", 0),
        by_severity.get("error", 0),
        by_severity.get("warning", 0),
        by_severity.get("info", 0),
        summary.get("clashes", 0),
        summary.get("rules_failed", 0),
    ]
    head = [Paragraph(f'<font size="8" color="#6b7280">{_esc(label)}</font>', styles["cell"]) for label in labels]
    value_cells = [Paragraph(f'<font size="15"><b>{value}</b></font>', styles["cell"]) for value in values]
    table = Table([head, value_cells], colWidths=[28 * mm] * 6)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _reason_cell(issue: dict, styles: dict[str, ParagraphStyle]) -> Paragraph:
    """原因 + 判定链（steps 逐条小字）。"""
    parts = [_esc(issue.get("reason") or "—")]
    for step in issue.get("steps") or []:
        parts.append(f'<font size="7.5" color="#6b7280">· {_esc(step)}</font>')
    return Paragraph("<br/>".join(parts), styles["cell"])


def _issue_table(issues: list[dict], styles: dict[str, ParagraphStyle], lang: str = "zh") -> Table:
    """某一严重度分组的问题清单表。"""
    txt = I18N[lang if lang in I18N else "zh"]
    head = [Paragraph(_esc(text), styles["head"]) for text in txt["headers"]]
    rows = [head]
    for issue in issues:
        ref = issue.get("reference") or ""
        rule_cell = f"{_esc(issue.get('category') or '—')}<br/><font size=\"7.5\" color=\"#6b7280\">{_esc(issue.get('title') or '')}</font>"
        if ref:
            rule_cell += f'<br/><font size="7" color="#6b7280">{_esc(ref)}</font>'
        rows.append(
            [
                Paragraph(rule_cell, styles["cell"]),
                Paragraph(_element_text(issue.get("element")), styles["cell"]),
                Paragraph(_element_text(issue.get("related")), styles["cell"]),
                _reason_cell(issue, styles),
                Paragraph(f'<font face="{FONT}" size="8">{_esc(_location_text(issue.get("location")))}</font>', styles["cell"]),
                Paragraph(_esc(txt["source"].get(issue.get("source") or "", issue.get("source") or "—")), styles["cell"]),
            ]
        )
    table = Table(rows, colWidths=[30 * mm, 34 * mm, 32 * mm, 52 * mm, 24 * mm, 14 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    return table


def render_pdf(
    report: dict, out: Path, title: str | None = None, lang: str = "zh"
) -> Path:
    """把统一问题清单渲染为 PDF：摘要页（统计 + 按严重度分组清单）。"""
    txt = I18N[lang if lang in I18N else "zh"]
    if title is None:
        title = txt["title"]
    styles = _styles()
    story: list = [
        Paragraph(_esc(title), styles["title"]),
        Paragraph(
            f"{txt['model']}：{_esc(report.get('model_path') or '—')}<br/>{txt['generated_at']}：{_esc(report.get('generated_at') or '—')}",
            styles["meta"],
        ),
        Spacer(1, 4 * mm),
        _summary_grid(report, styles, lang),
    ]

    issues: list[dict] = report.get("issues") or []
    if not issues:
        story.append(Paragraph(txt["empty"], styles["h2"]))
    for severity in SEVERITY_ORDER:
        group = [issue for issue in issues if issue.get("severity") == severity]
        if not group:
            continue
        color = SEVERITY_COLOR[severity].hexval().replace("0x", "#")
        story.append(
            Paragraph(f'<font color="{color}">■</font> {_esc(txt["severity"][severity])}（{len(group)}）', styles["h2"])
        )
        story.append(_issue_table(group, styles, lang))

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    doc = SimpleDocTemplate(
        str(tmp),
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=title,
        author="ArchiKen 筑审通",
    )
    doc.build(story)
    tmp.replace(out)
    return out
