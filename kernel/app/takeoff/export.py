"""信息提取 Excel 导出：openpyxl 写 xlsx，先写临时文件再原子替换。"""

from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.utils import get_column_letter

from app.takeoff.columns import FIXED_FIELDS, FIXED_KEY_SET, ColumnError, localize_columns

I18N = {
    "zh": {"sheet": "信息提取", "total": "合计", "yes": "是", "no": "否"},
    "en": {"sheet": "Takeoff", "total": "Total", "yes": "Yes", "no": "No"},
}


def export_xlsx(
    result: dict,
    out: Path,
    lang: str = "zh",
) -> Path:
    """把 run_takeoff 结果写为 xlsx：表头 + 数据行 + 合计行。"""
    txt = I18N[lang if lang in I18N else "zh"]
    rows: list[dict] = result.get("rows") or []
    columns: list[dict] = result.get("columns") or []
    # 列名已按语言本地化（由路由层传入 localize_columns 结果）。
    headers = [field["name"] for field in localize_columns(FIXED_FIELDS, lang)] + [column["name"] for column in columns]
    keys = [field["key"] for field in FIXED_FIELDS] + [column["key"] for column in columns]
    if len(set(keys)) != len(FIXED_KEY_SET) + len(columns):
        raise ColumnError("存在与固定字段重名的自定义列")

    book = Workbook()
    sheet = book.active
    sheet.title = txt["sheet"]
    sheet.append(headers)
    for row in rows:
        sheet.append([_cell(row.get(key), txt) for key in keys])
    totals: dict = result.get("totals") or {}
    if totals:
        sheet.append([txt["total"] if index == 0 else totals.get(key, "") for index, key in enumerate(keys)])

    for index, header in enumerate(headers, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = max(len(str(header)) * 2 + 4, 10)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    book.save(tmp)
    tmp.replace(out)
    return out

def _cell(value: object, txt: dict) -> object:
    if isinstance(value, bool):
        return txt["yes"] if value else txt["no"]
    return value if value is not None else ""
