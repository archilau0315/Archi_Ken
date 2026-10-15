"""报告导出端点（M9）：接收统一问题清单 JSON，渲染 PDF / Excel 到 .data/exports。"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import exports_dir
from app.report import render_pdf, render_xlsx

router = APIRouter(prefix="/report", tags=["report"])

RENDERERS = {"pdf": (render_pdf.render_pdf, ".pdf"), "xlsx": (render_xlsx.render_xlsx, ".xlsx")}


class ReportExportRequest(BaseModel):
    """报告导出请求体。"""

    report: dict[str, Any] = Field(..., description="统一问题清单（L3 buildReport 产物）")
    format: str = Field("pdf", description="导出格式：pdf | xlsx")
    title: str | None = Field(None, description="报告标题（不传则按语言自动选择）")
    lang: str = Field("zh", description="语言：zh | en")


@router.post("/export")
def report_export(payload: ReportExportRequest) -> dict[str, Any]:
    """把问题清单渲染为指定格式文件（原子写入 exports 目录）。"""
    report = payload.report
    if not isinstance(report.get("summary"), dict) or not isinstance(report.get("issues"), list):
        raise HTTPException(status_code=400, detail="report 结构不完整（缺少 summary / issues）")

    fmt = payload.format.lower()
    if fmt not in RENDERERS:
        raise HTTPException(status_code=400, detail=f"不支持的导出格式：{payload.format}（支持 pdf / xlsx）")
    renderer, suffix = RENDERERS[fmt]
    lang = "en" if payload.lang == "en" else "zh"

    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = exports_dir() / f"report-{stamp}{suffix}"
    try:
        written = renderer(report, target, payload.title, lang)
    except Exception as exc:  # 渲染期错误统一映射为 500，避免泄漏堆栈
        raise HTTPException(status_code=500, detail=f"报告渲染失败：{exc}") from exc
    return {
        "file": str(written),
        "name": written.name,
        "size": written.stat().st_size,
        "format": fmt,
        "issues": len(report["issues"]),
    }


@router.get("/exports")
def report_exports() -> dict[str, Any]:
    """列出已导出的报告文件（report-*.pdf / report-*.xlsx）。"""
    base = exports_dir()
    items = sorted(
        (
            {"file": str(item), "name": item.name, "size": item.stat().st_size}
            for item in base.glob("report-*.*")
            if item.suffix in {".pdf", ".xlsx"}
        ),
        key=lambda item: item["name"],
        reverse=True,
    )
    return {"total": len(items), "items": items}
