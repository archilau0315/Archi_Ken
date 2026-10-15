"""内核解析 / 几何 / 碰撞 / 规则 / 融合 / IDS / 合规服务端到端冒烟测试。

前置：内核服务已启动（npm run kernel，默认 http://127.0.0.1:4319）。

用法：
    python tools/kernel/smoke_test.py
    python tools/kernel/smoke_test.py --base-url http://127.0.0.1:4321 --model corpus/samples/_smoke/smoke-ifc4.ifc
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
STRUCT_MODEL = PROJECT_ROOT / "corpus" / "samples" / "_smoke" / "smoke-structural-ifc4.ifc"


def get(base_url: str, endpoint: str, **params: str) -> dict:
    query = "&".join(f"{key}={urllib.parse.quote(str(value))}" for key, value in params.items())
    url = f"{base_url}{endpoint}" + (f"?{query}" if query else "")
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"请求失败 {url}\nHTTP {exc.code}: {exc.read().decode('utf-8')}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"无法连接内核服务 {url}：{exc.reason}") from exc


def post(base_url: str, endpoint: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{endpoint}", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"请求失败 {endpoint}\nHTTP {exc.code}: {exc.read().decode('utf-8')}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"无法连接内核服务 {endpoint}：{exc.reason}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="内核 IFC 解析服务冒烟测试")
    parser.add_argument("--base-url", default="http://127.0.0.1:4319")
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    args = parser.parse_args()

    model = str(Path(args.model).resolve())
    if not Path(model).is_file():
        raise SystemExit(f"模型文件不存在：{model}")

    health = get(args.base_url, "/health")
    print(f"[health]    {health}")

    summary = get(args.base_url, "/ifc/summary", path=model)
    print(f"[summary]   schema={summary['schema']} 导出方={summary['exporter']}")
    print(f"            长度单位={summary['length_unit']} 换算系数={summary['unit_to_meter']}")
    print(f"            地理参考={summary['georeference']}")
    print(f"            构件总数={summary['products_total']} 分布={summary['counts_by_type']}")

    tree = get(args.base_url, "/ifc/hierarchy", path=model)

    def walk(node: dict, depth: int = 0) -> None:
        print(f"            {'  ' * depth}- {node['ifc_type']} {node['name']} (构件 {node['element_total']})")
        for child in node["children"]:
            walk(child, depth + 1)

    print("[hierarchy]")
    for root in tree["roots"]:
        walk(root)

    walls = get(args.base_url, "/ifc/elements", path=model, ifc_type="IfcWall")
    print(f"[elements]  IfcWall 共 {walls['total']} 个：{walls['items']}")

    if walls["items"]:
        detail = get(args.base_url, f"/ifc/elements/{walls['items'][0]['guid']}", path=model)
        print(f"[detail]    {detail['name']} 类型对象={detail['type_object']} 所在空间={detail['container']}")
        print(f"            属性集={detail['psets']}")

    stats = get(args.base_url, "/geometry/stats", path=model)
    print(
        f"[geom/stats] 有几何构件={stats['elements_with_geometry']} "
        f"三角面={stats['triangles']} 命中缓存={stats['cache_hit']}"
    )
    print(f"            分布={stats['by_type']}")

    bboxes = get(args.base_url, "/geometry/bboxes", path=model, ifc_type="IfcWall")
    print(f"[geom/bbox] IfcWall 包围盒共 {bboxes['total']} 个")
    for item in bboxes["items"]:
        print(f"            {item['guid']} 中心={item['center']} 尺寸={item['size']} 三角面={item['triangle_count']}")

    if bboxes["items"]:
        guid = bboxes["items"][0]["guid"]
        mesh = get(args.base_url, f"/geometry/elements/{guid}", path=model, mesh="true")
        print(f"[geom/mesh] {guid} 顶点数={len(mesh['verts']) // 3} 三角面={mesh['triangle_count']}")

    clash = get(args.base_url, "/clash/run", path=model)
    print(
        f"[clash]    候选对={clash['candidate_pairs']} 碰撞={clash['total']} "
        f"三角形测试={clash['triangle_tests']} 截断={clash['truncated']}"
    )
    for item in clash["items"]:
        print(
            f"            {item['a']['name']} <-> {item['b']['name']} "
            f"相交三角形={item['triangle_pairs']} 接触点={item['contact_point']}"
        )

    matrix_default = post(args.base_url, "/clash/matrix", {"path": model})
    print(
        f"[matrix]   专业={[d['name'] for d in matrix_default['disciplines']]} "
        f"候选对={matrix_default['candidate_pairs']} 忽略={matrix_default['ignored']} "
        f"合计={matrix_default['totals']}"
    )
    for cell in matrix_default["cells"]:
        print(f"            单元格 {cell['a']}|{cell['b']} 硬={cell['hard']} 间隙={cell['gap']} 净空={cell['clearance']}")
    for item in matrix_default["items"][:5]:
        print(
            f"            [{item['mode']}] {item['a']['name']}（{item['a']['discipline_name']}）"
            f" <-> {item['b']['name']}（{item['b']['discipline_name']}）"
        )

    matrix_full = post(
        args.base_url,
        "/clash/matrix",
        {"path": model, "gap_mm": 60, "clearance_mm": 600, "ignore_same_discipline": False},
    )
    print(
        f"[matrix+]  开启间隙/净空且不忽略同专业：合计={matrix_full['totals']} "
        f"忽略={matrix_full['ignored']} 阈值={matrix_full['thresholds']}"
    )
    for item in matrix_full["items"]:
        label = item["distance"] if item["mode"] != "hard" else f"相交{item['triangle_pairs']}对"
        print(
            f"            [{item['mode']}] {item['a']['name']} <-> {item['b']['name']} → {label}"
        )

    templates = get(args.base_url, "/rules/templates")
    print(f"[rules/tpl] 内置模板 {templates['total']} 个：{[t['id'] for t in templates['items']]}")

    report = get(args.base_url, "/rules/run", path=model)
    print(
        f"[rules]    规则={report['rules_run']} 通过={report['rules_passed']} "
        f"未通过={report['rules_failed']} 违规合计={report['violations_total']}"
    )
    for rule in report["rules"]:
        print(f"            {rule['rule_id']}（{rule['name']}）目标={rule['target_total']} 违规={rule['violations']}")
        for item in rule["items"][:3]:
            related = item["related"]
            suffix = f" ↔ {related['name']}" if related else ""
            print(f"              {item['name']}（{item['ifc_type']}）{suffix}：{item['reason']}")

    validate = post(
        args.base_url,
        "/rules/validate",
        {
            "rules": [
                {
                    "id": "probe-rule",
                    "target": {"ifc_type": ["IfcWall"]},
                    "check": {"type": "property", "pset": "Pset_WallCommon", "prop": "FireRating", "op": "exists"},
                }
            ]
        },
    )
    print(f"[rules/val] 规则校验通过，规范化 {validate['total']} 条规则")

    rules_table = get(args.base_url, "/federation/disciplines")
    print(
        f"[fed/rules] 专业定义 {len(rules_table['disciplines'])} 个："
        f"{[d['name'] for d in rules_table['disciplines']]}"
    )

    struct_model = str(STRUCT_MODEL)
    if not Path(struct_model).is_file():
        raise SystemExit(
            f"第二模型源不存在：{struct_model}\n请先运行 python tools/corpus/make_smoke_ifc.py"
        )
    federation = post(
        args.base_url,
        "/federation/merge",
        {"paths": [model, struct_model], "max_depth": 4},
    )
    totals = federation["totals"]
    print(
        f"[federation] 模型={totals['models']} 构件={totals['products']} "
        f"有几何={totals['geo_elements']} 专业={totals['disciplines']} GUID冲突={totals['guid_conflicts']}"
    )
    for entry in federation["models"]:
        print(
            f"            #{entry['index']} {entry['name']} 专业推断={entry['discipline_hint']['key']} "
            f"构件={entry['products']} 专业分布={entry['disciplines']}"
        )
    for bucket in federation["disciplines"]:
        print(
            f"            专业 {bucket['name']}（{bucket['key']}）构件={bucket['element_count']} "
            f"有几何={bucket['geo_count']} 来源模型={bucket['models']} 类型={bucket['element_types']}"
        )

    def walk_fed(node: dict, depth: int = 0) -> None:
        chips = node.get("elements_by_discipline")
        label = f"{node['ifc_type'] or '模型'} {node['name']}"
        suffix = f" 专业分布={chips}" if chips else ""
        print(f"            {'  ' * depth}- {label}（构件 {node['element_total']}）{suffix}")
        for child in node["children"]:
            walk_fed(child, depth + 1)

    for root in federation["tree"]["roots"]:
        walk_fed(root)

    example = get(args.base_url, "/ids/example")
    print(
        f"[ids/示例] 规范 {example['spec']['specification_count']} 条："
        f"{[s['name'] for s in example['spec']['specifications']]}"
    )

    parsed = post(args.base_url, "/ids/parse", {"xml": example["xml"]})
    print(f"[ids/解析] 解析成功，规范化规范 {parsed['spec']['specification_count']} 条")

    ids_result = post(args.base_url, "/ids/validate", {"path": model, "xml": example["xml"]})
    ids_totals = ids_result["totals"]
    print(
        f"[ids/校验] 总体通过={ids_result['status']} 规范={ids_totals['total_specifications']} "
        f"通过={ids_totals['total_specifications_pass']} 未通过={ids_totals['total_specifications_fail']} "
        f"检查通过率={ids_totals['percent_checks_pass']}%"
    )
    for spec in ids_result["specifications"]:
        state = "通过" if spec["status"] else "未通过"
        print(
            f"            [{state}] {spec['name']} 适用={spec['applicable_total']} "
            f"检查={spec['total_checks_pass']}/{spec['total_checks']}"
        )
        for req in spec["requirements"]:
            print(f"              {req['facet_type']} {req['description']} 通过={req['total_pass']}/{req['total_applicable']}")
            for entity in req["failed_entities"][:3]:
                print(f"                失败 {entity['name']}（{entity['ifc_type']}）：{entity.get('reason')}")

    presets = get(args.base_url, "/rules/presets")
    print(f"[rules/预设] 合规预设 {presets['total']} 个：{[p['name'] for p in presets['items']]}")
    full = next(p for p in presets["items"] if p["id"] == "compliance-full")
    compliance = post(args.base_url, "/rules/run", {"path": model, "rule_ids": full["rule_ids"]})
    print(
        f"[compliance] 规则={compliance['rules_run']} 通过={compliance['rules_passed']} "
        f"未通过={compliance['rules_failed']} 违规合计={compliance['violations_total']}"
    )
    for rule in compliance["rules"]:
        print(
            f"            {rule['rule_id']}（{rule['name']}）[{rule['category']}] "
            f"目标={rule['target_total']} 违规={rule['violations']}"
        )
        for item in rule["items"][:2]:
            print(f"              {item['name']}：{item['reason']}")

    columns_info = get(args.base_url, "/takeoff/columns")
    print(
        f"[takeoff/列] 固定字段={len(columns_info['fixed'])} 建议列={len(columns_info['suggested'])} "
        f"函数={len(columns_info['functions'])}"
    )

    takeoff = post(
        args.base_url,
        "/takeoff/run",
        {
            "path": model,
            "columns": [
                {"key": "volume", "name": "体积", "expr": "qty('volume')"},
                {"key": "volume2", "name": "两倍体积", "expr": "qty('volume') * 2"},
                {"key": "label", "name": "标签", "expr": "if(contains(attr('Name'), 'Wall'), '墙', '其他')"},
            ],
        },
    )
    print(
        f"[takeoff/run] 行={takeoff['total']} 截断={takeoff['truncated']} 表达式错误={takeoff['expression_errors']} "
        f"缓存命中={takeoff['cache_hit']} 合计={takeoff['totals']}"
    )
    for row in takeoff["rows"][:3]:
        print(f"            {row['name']}（{row['ifc_type']}）值={row['values']}")

    exported = post(args.base_url, "/takeoff/export", {"path": model})
    export_path = Path(exported["file"])
    assert export_path.is_file() and export_path.stat().st_size > 0, "导出的 Excel 文件为空或缺失"
    print(f"[takeoff/export] 已导出 {exported['file']}（{export_path.stat().st_size} 字节，{exported['total']} 行）")

    # ---- M9 报告生成：合成问题清单直测 PDF / Excel 渲染器 ----
    report_payload = {
        "report": {
            "model_path": model,
            "generated_at": "2026-10-13T00:00:00+00:00",
            "summary": {
                "total": 2,
                "by_severity": {"error": 1, "warning": 1},
                "by_category": {"合规检查": 1, "碰撞检查": 1},
                "by_source": {"rule": 1, "clash": 1},
                "rules_run": 3,
                "rules_failed": 1,
                "clashes": 1,
            },
            "issues": [
                {
                    "id": "rule|probe|g1|-",
                    "source": "rule",
                    "severity": "error",
                    "category": "合规检查",
                    "title": "外墙防火等级",
                    "element": {"guid": "g1", "name": "外墙 W-01", "ifc_type": "IfcWall"},
                    "related": None,
                    "location": None,
                    "actual": None,
                    "expected": "存在 FireRating",
                    "reason": "缺少属性 Pset_WallCommon.FireRating",
                    "steps": ["目标构件：IfcWall", "属性集缺失 → 判定未通过"],
                },
                {
                    "id": "clash|g1|g2",
                    "source": "clash",
                    "severity": "warning",
                    "category": "碰撞检查",
                    "title": "硬碰撞",
                    "element": {"guid": "g1", "name": "外墙 W-01", "ifc_type": "IfcWall"},
                    "related": {"guid": "g2", "name": "梁 B-02", "ifc_type": "IfcBeam"},
                    "location": [1.23456, 2.0, 3.0],
                    "actual": 4,
                    "expected": 0,
                    "reason": "外墙 W-01 与 梁 B-02 发生几何相交",
                    "steps": ["三角形相交对数 = 4"],
                },
            ],
        }
    }
    pdf = post(args.base_url, "/report/export", {**report_payload, "format": "pdf"})
    pdf_path = Path(pdf["file"])
    assert pdf_path.is_file() and pdf_path.read_bytes()[:5] == b"%PDF-", "PDF 渲染失败或文件头不正确"
    print(f"[report/pdf]  导出 {pdf['name']}（{pdf['size']} 字节，{pdf['issues']} 条问题）")

    xlsx = post(args.base_url, "/report/export", {**report_payload, "format": "xlsx"})
    xlsx_path = Path(xlsx["file"])
    assert xlsx_path.is_file() and xlsx_path.read_bytes()[:2] == b"PK", "Excel 渲染失败或文件头不正确"
    print(f"[report/xlsx] 导出 {xlsx['name']}（{xlsx['size']} 字节，{xlsx['issues']} 条问题）")

    listed = get(args.base_url, "/report/exports")
    assert listed["total"] >= 2, "报告导出列表应包含刚导出的文件"
    print(f"[report/exports] 共 {listed['total']} 个报告文件")

    print("\n冒烟测试通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
