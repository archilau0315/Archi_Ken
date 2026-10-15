"""业务服务（L3）规则集管理端到端冒烟测试。

前置：内核服务（4319）与业务服务（4318）均已启动。

用法：
    python tools/server/smoke_test.py
    python tools/server/smoke_test.py --base-url http://127.0.0.1:4318
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = PROJECT_ROOT / "corpus" / "samples" / "_smoke" / "smoke-ifc4.ifc"

RULESET_RULES = [
    {
        "id": "probe-wall-fire",
        "name": "外墙防火等级",
        "category": "合规检查",
        "severity": "error",
        "target": {"ifc_type": ["IfcWall"]},
        "check": {"type": "property", "pset": "Pset_WallCommon", "prop": "FireRating", "op": "exists"},
    },
    {
        "id": "probe-duplicate",
        "name": "重复构件",
        "category": "模型质量",
        "severity": "warning",
        "target": {"ifc_type": ["IfcMember"]},
        "check": {"type": "duplicate", "size_tolerance": 0.02, "center_tolerance": 0.05},
    },
]


def request(base_url: str, method: str, endpoint: str, payload: dict | None = None, **params: str) -> dict:
    query = "&".join(f"{key}={urllib.parse.quote(str(value))}" for key, value in params.items())
    url = f"{base_url}{endpoint}" + (f"?{query}" if query else "")
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"请求失败 {method} {url}\nHTTP {exc.code}: {exc.read().decode('utf-8')}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"无法连接业务服务 {url}：{exc.reason}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="业务服务规则集管理冒烟测试")
    parser.add_argument("--base-url", default="http://127.0.0.1:4318")
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    args = parser.parse_args()

    model = str(Path(args.model).resolve())
    if not Path(model).is_file():
        raise SystemExit(f"模型文件不存在：{model}")

    health = request(args.base_url, "GET", "/health")
    print(f"[health]  {health}")

    saved = request(args.base_url, "POST", "/ruleset/save", {"name": "冒烟规则集", "description": "端到端测试", "rules": RULESET_RULES})
    ruleset_id = saved["id"]
    print(f"[save]    已保存规则集 id={ruleset_id} 规则数={len(saved['rules'])}")

    fetched = request(args.base_url, "GET", "/ruleset/get", id=ruleset_id)
    print(f"[get]     {fetched['name']} 规则={[rule['id'] for rule in fetched['rules']]}")

    listing = request(args.base_url, "GET", "/ruleset/list")
    ids = [item["id"] for item in listing["items"]]
    print(f"[list]    共 {listing['total']} 个规则集，包含当前={ruleset_id in ids}")

    report = request(args.base_url, "POST", "/ruleset/run", {"id": ruleset_id, "path": model})
    summary = report["summary"]
    print(
        f"[run]     规则={summary['rules_run']} 未通过={summary['rules_failed']} "
        f"碰撞={summary['clashes']} 问题共={summary['total']}"
    )
    for issue in report["issues"][:5]:
        print(f"          [{issue['severity']}] {issue['title']}：{issue['reason']}")

    deleted = request(args.base_url, "POST", "/ruleset/delete", {"id": ruleset_id})
    print(f"[delete]  deleted={deleted['deleted']}")

    # ---- M8 沟通与 BCF：问题生命周期 / 评论 / 快照 / 导入 / BCF 导出 ----
    created = request(
        args.base_url,
        "POST",
        "/issues/create",
        {
            "title": "手工标注问题",
            "description": "冒烟：手工创建",
            "severity": "warning",
            "category": "沟通",
            "source": "manual",
            "model_path": model,
        },
    )
    issue_id = created["id"]
    print(f"[issue]   已创建 id={issue_id} guid={created['guid'][:8]}… status={created['status']}")

    commented = request(args.base_url, "POST", "/issues/comment", {"id": issue_id, "author": "测试员", "text": "已现场复核"})
    print(f"[comment] 评论数={len(commented['comments'])} 首条作者={commented['comments'][0]['author']}")

    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    snap = request(args.base_url, "POST", "/issues/snapshot", {"id": issue_id, "data_url": png})
    print(f"[snapshot] has_snapshot={snap['has_snapshot']}")

    updated = request(args.base_url, "POST", "/issues/update", {"id": issue_id, "status": "acknowledged", "severity": "error"})
    print(f"[update]  status={updated['status']} severity={updated['severity']}")

    imported = request(args.base_url, "POST", "/issues/import", {"path": model, "include_clash": True})
    print(f"[import]  报告问题={imported['total']} 新建={imported['created']} 跳过={imported['skipped']}")

    listing = request(args.base_url, "GET", "/issues/list", status="open")
    print(f"[list]    open 状态共 {listing['total']} 条")

    bcf = request(args.base_url, "POST", "/issues/bcf/export", {})
    bcf_size = Path(bcf["path"]).stat().st_size
    print(f"[bcf]     导出 {bcf['topics']} 个主题 → {bcf['path']}（{bcf_size} 字节）")

    again = request(args.base_url, "POST", "/issues/import", {"path": model, "include_clash": True})
    if again["created"] != 0:
        raise SystemExit(f"去重失败：第二次导入不应新建问题（新建 {again['created']} 条）")
    print(f"[dedup]   二次导入新建={again['created']}（去重生效）")

    removed = request(args.base_url, "POST", "/issues/delete", {"id": issue_id})
    print(f"[delete]  deleted={removed['deleted']}")

    # ---- M9 报告生成：导出 PDF / Excel 并校验文件落盘 ----
    pdf = request(args.base_url, "POST", "/report/export", {"path": model, "format": "pdf"})
    pdf_path = Path(pdf["file"])
    assert pdf_path.is_file() and pdf_path.stat().st_size > 0, "PDF 报告导出失败或文件为空"
    head = pdf_path.read_bytes()[:5]
    assert head == b"%PDF-", f"PDF 文件头不正确：{head!r}"
    print(f"[report/pdf]  问题={pdf['issues']} 导出 {pdf['name']}（{pdf['size']} 字节，头校验通过）")

    xlsx = request(args.base_url, "POST", "/report/export", {"path": model, "format": "xlsx"})
    xlsx_path = Path(xlsx["file"])
    assert xlsx_path.is_file() and xlsx_path.stat().st_size > 0, "Excel 报告导出失败或文件为空"
    assert xlsx_path.read_bytes()[:2] == b"PK", "Excel 文件头不正确（应为 zip 包）"
    print(f"[report/xlsx] 问题={xlsx['issues']} 导出 {xlsx['name']}（{xlsx['size']} 字节，头校验通过）")

    # ---- M11 Autorun 批量检查：任务保存 / 批量运行 / 产物与分发 / 运行记录 ----
    out_dir = PROJECT_ROOT / ".data" / "autorun-smoke-out"
    task = request(
        args.base_url,
        "POST",
        "/autorun/save",
        {
            "name": "冒烟批量检查",
            "models": [model],
            "include_clash": True,
            "formats": ["pdf", "json"],
            "output_dir": str(out_dir),
        },
    )
    task_id = task["id"]
    print(f"[autorun/save] 任务 id={task_id} 模型数={len(task['models'])} 格式={task['formats']}")

    run = request(args.base_url, "POST", "/autorun/run", {"id": task_id})
    run_id = run["id"]
    totals = run["totals"]
    assert run["status"] == "done", f"批量运行状态异常：{run['status']}"
    assert totals["ok"] == 1 and totals["failed"] == 0, f"批量运行统计异常：{totals}"
    print(
        f"[autorun/run]  run={run_id} 状态={run['status']} 模型={totals['models']} "
        f"问题={totals['issues']} 产物={totals['files']}"
    )

    item = run["items"][0]
    outputs = {output["format"]: output for output in item["outputs"]}
    auto_pdf = Path(outputs["pdf"]["file"])
    assert auto_pdf.is_file() and auto_pdf.read_bytes()[:5] == b"%PDF-", "Autorun PDF 产物缺失或损坏"
    auto_json = Path(outputs["json"]["file"])
    assert auto_json.is_file(), "Autorun JSON 产物缺失"
    payload = json.loads(auto_json.read_text(encoding="utf-8"))
    assert payload["summary"]["total"] == item["issues"], "Autorun JSON 报告与运行记录不一致"
    run_manifest = auto_pdf.parent / "run.json"
    assert run_manifest.is_file(), "运行目录缺少 run.json（manifest）"
    dist_pdf = out_dir / run_id / auto_pdf.name
    assert dist_pdf.is_file(), f"结果未分发到 output_dir：{dist_pdf}"
    print(f"[autorun/out]  PDF/JSON/run.json 校验通过，已分发到 {dist_pdf.parent}")

    runs = request(args.base_url, "GET", "/autorun/runs", task_id=task_id)
    assert any(entry["id"] == run_id for entry in runs["items"]), "运行记录列表缺少本次运行"
    detail = request(args.base_url, "GET", "/autorun/run/get", id=run_id)
    assert detail["totals"]["issues"] == totals["issues"], "运行记录详情不一致"
    print(f"[autorun/runs] 运行记录 {runs['total']} 条，详情读取一致")

    removed = request(args.base_url, "POST", "/autorun/delete", {"id": task_id})
    assert removed["deleted"], "Autorun 任务删除失败"
    print(f"[autorun/del]  deleted={removed['deleted']}（运行记录保留）")

    print("\n业务服务冒烟测试通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
