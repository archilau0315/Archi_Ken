"""黄金基准比对流水线：把内核输出固化为黄金文件，后续运行逐字段比对出差异报告。

用途：
- record：对指定模型跑一组固定检查，把确定性指标固化为 golden/<key>.json（基准录入 / 更新）。
- run：重跑全部黄金文件对应的检查，逐字段比对，差异落到 .data/benchmark/ 报告；
  任一模型有差异即退出码 1，可直接接入 CI / 提交前检查。

前置：内核服务已启动（npm run kernel，默认 http://127.0.0.1:4319）。

用法：
    python tools/benchmark/benchmark.py record --model corpus/samples/_smoke/smoke-ifc4.ifc
    python tools/benchmark/benchmark.py run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_DIR = Path(__file__).resolve().parent / "golden"
REPORT_DIR = PROJECT_ROOT / ".data" / "benchmark"
FLOAT_DIGITS = 4  # 浮点比对精度（L2 幂等，整数计数字段必须精确一致）


def get(base_url: str, endpoint: str, **params: str) -> dict:
    query = "&".join(f"{key}={urllib.parse.quote(str(value))}" for key, value in params.items())
    url = f"{base_url}{endpoint}" + (f"?{query}" if query else "")
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
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
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"请求失败 {endpoint}\nHTTP {exc.code}: {exc.read().decode('utf-8')}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"无法连接内核服务 {endpoint}：{exc.reason}") from exc


def atomic_write_json(path: Path, data: dict) -> None:
    """原子写入 JSON：先写临时文件再替换，避免并发读写损坏。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def rules_digest(report: dict) -> dict:
    """提取规则报告的确定性指标：总量 + 逐规则违规数。"""
    return {
        "rules_run": report["rules_run"],
        "rules_passed": report["rules_passed"],
        "rules_failed": report["rules_failed"],
        "violations_total": report["violations_total"],
        "per_rule": {rule["rule_id"]: rule["violations"] for rule in report["rules"]},
    }


def collect_checks(base_url: str, model: str) -> dict:
    """固定检查集：只取确定性输出字段（L2 幂等约束保证可逐字段比对）。"""
    checks: dict = {}

    summary = get(base_url, "/ifc/summary", path=model)
    checks["summary"] = {
        "schema": summary["schema"],
        "exporter": summary["exporter"],
        "length_unit": summary["length_unit"],
        "products_total": summary["products_total"],
        "counts_by_type": summary["counts_by_type"],
    }

    stats = get(base_url, "/geometry/stats", path=model)
    checks["geometry"] = {
        "elements_with_geometry": stats["elements_with_geometry"],
        "triangles": stats["triangles"],
        "by_type": stats["by_type"],
    }

    clash = get(base_url, "/clash/run", path=model)
    checks["clash"] = {
        "candidate_pairs": clash["candidate_pairs"],
        "total": clash["total"],
        "triangle_tests": clash["triangle_tests"],
    }

    matrix = post(base_url, "/clash/matrix", {"path": model})
    checks["clash_matrix"] = {
        "candidate_pairs": matrix["candidate_pairs"],
        "ignored": matrix["ignored"],
        "totals": matrix["totals"],
    }

    checks["rules_all"] = rules_digest(get(base_url, "/rules/run", path=model))

    presets = get(base_url, "/rules/presets")["items"]
    full = next((p for p in presets if p["id"] == "compliance-full"), presets[0])
    checks["rules_compliance"] = rules_digest(
        post(base_url, "/rules/run", {"path": model, "rule_ids": full["rule_ids"]})
    )

    ids_xml = get(base_url, "/ids/example")["xml"]
    ids = post(base_url, "/ids/validate", {"path": model, "xml": ids_xml})
    checks["ids"] = {"status": ids["status"], "totals": ids["totals"]}

    takeoff = post(base_url, "/takeoff/run", {"path": model})
    checks["takeoff"] = {
        "total": takeoff["total"],
        "expression_errors": takeoff["expression_errors"],
        "totals": takeoff["totals"],
    }
    return checks


def flatten(data: object, prefix: str = "") -> dict[str, object]:
    """把嵌套 dict 展平为点路径 → 叶子值，浮点按 FLOAT_DIGITS 归一。"""
    if isinstance(data, dict):
        out: dict[str, object] = {}
        for key, value in data.items():
            out.update(flatten(value, f"{prefix}{key}."))
        return out
    if isinstance(data, list):
        out = {}
        for index, value in enumerate(data):
            out.update(flatten(value, f"{prefix}{index}."))
        return out
    if isinstance(data, float):
        return {prefix[:-1]: round(data, FLOAT_DIGITS)}
    return {prefix[:-1]: data}


def diff_checks(expected: dict, actual: dict) -> list[dict]:
    """逐字段比对两组检查，返回差异清单。"""
    diffs: list[dict] = []
    for check_name in sorted(set(expected) | set(actual)):
        if check_name not in expected:
            diffs.append({"check": check_name, "path": "(整组)", "expected": "缺失", "actual": "新增"})
            continue
        if check_name not in actual:
            diffs.append({"check": check_name, "path": "(整组)", "expected": "存在", "actual": "缺失"})
            continue
        exp_flat = flatten(expected[check_name])
        act_flat = flatten(actual[check_name])
        for path in sorted(set(exp_flat) | set(act_flat)):
            if path not in exp_flat:
                diffs.append({"check": check_name, "path": path, "expected": "缺失", "actual": act_flat[path]})
            elif path not in act_flat:
                diffs.append({"check": check_name, "path": path, "expected": exp_flat[path], "actual": "缺失"})
            elif exp_flat[path] != act_flat[path]:
                diffs.append({"check": check_name, "path": path,
                              "expected": exp_flat[path], "actual": act_flat[path]})
    return diffs


def cmd_record(args: argparse.Namespace) -> int:
    model = str(Path(args.model).resolve())
    if not Path(model).is_file():
        raise SystemExit(f"模型文件不存在：{model}")
    key = args.key or Path(model).stem
    health = get(args.base_url, "/health")
    checks = collect_checks(args.base_url, model)
    golden = {
        "key": key,
        "model": model,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "kernel_version": health.get("version"),
        "checks": checks,
    }
    path = GOLDEN_DIR / f"{key}.json"
    atomic_write_json(path, golden)
    field_count = sum(len(flatten(check)) for check in checks.values())
    print(f"[record] {key}：{len(checks)} 组检查 / {field_count} 个比对字段 → {path}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    goldens = sorted(GOLDEN_DIR.glob("*.json"))
    if not goldens:
        raise SystemExit(f"黄金文件为空：{GOLDEN_DIR}（先用 record 录入）")
    health = get(args.base_url, "/health")
    print(f"[benchmark] 内核 {health.get('version')}，黄金文件 {len(goldens)} 个\n")

    started = time.strftime("%Y-%m-%dT%H:%M:%S")
    results = []
    failed = 0
    for path in goldens:
        golden = json.loads(path.read_text(encoding="utf-8"))
        model = golden["model"]
        if not Path(model).is_file():
            print(f"[{golden['key']}] 模型文件缺失：{model}，跳过")
            results.append({"key": golden["key"], "model": model, "status": "missing_model", "diffs": []})
            failed += 1
            continue
        tic = time.perf_counter()
        actual = collect_checks(args.base_url, model)
        elapsed = round((time.perf_counter() - tic) * 1000)
        diffs = diff_checks(golden["checks"], actual)
        status = "pass" if not diffs else "fail"
        failed += 0 if not diffs else 1
        results.append({"key": golden["key"], "model": model, "status": status,
                        "elapsed_ms": elapsed, "golden_recorded_at": golden.get("recorded_at"), "diffs": diffs})
        print(f"[{golden['key']}] {status}（{elapsed}ms，差异 {len(diffs)} 处）")
        for diff in diffs[:20]:
            print(f"    {diff['check']}.{diff['path']}：期望 {diff['expected']} ≠ 实际 {diff['actual']}")
        if len(diffs) > 20:
            print(f"    … 其余 {len(diffs) - 20} 处见报告文件")

    report = {
        "started_at": started,
        "base_url": args.base_url,
        "kernel_version": health.get("version"),
        "total": len(results),
        "failed": failed,
        "results": results,
    }
    report_path = REPORT_DIR / f"benchmark-{time.strftime('%Y%m%d-%H%M%S')}.json"
    atomic_write_json(report_path, report)
    print(f"\n[benchmark] 通过 {len(results) - failed}/{len(results)}，报告 → {report_path}")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="黄金基准比对流水线")
    parser.add_argument("--base-url", default="http://127.0.0.1:4319")
    sub = parser.add_subparsers(dest="command", required=True)

    p_record = sub.add_parser("record", help="录入 / 更新黄金文件")
    p_record.add_argument("--model", required=True, help="模型文件路径")
    p_record.add_argument("--key", help="黄金文件键名（默认取模型文件名）")

    sub.add_parser("run", help="重跑并比对全部黄金文件")
    args = parser.parse_args()

    if args.command == "record":
        return cmd_record(args)
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
