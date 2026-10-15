"""性能基线采集与回归比对工具。

对内核服务跑一组固定场景并计时，可选采集内核进程内存（需 psutil）；
结果可保存为基线，后续运行与基线比对，超出阈值视为性能回归。

前置：内核服务已启动（npm run kernel，默认 http://127.0.0.1:4319）。

用法：
    python tools/perf/perf_baseline.py                       # 直接采集并打印
    python tools/perf/perf_baseline.py --save v0.12          # 保存为基线
    python tools/perf/perf_baseline.py --compare v0.12       # 与基线比对（回归退出码 1）
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import statistics
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = PROJECT_ROOT / "corpus" / "samples" / "_smoke" / "smoke-ifc4.ifc"
STRUCT_MODEL = PROJECT_ROOT / "corpus" / "samples" / "_smoke" / "smoke-structural-ifc4.ifc"
BASELINE_DIR = Path(__file__).resolve().parent / "baselines"

try:
    import psutil
except ImportError:  # psutil 为可选依赖，缺失时仅计时
    psutil = None


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
            json.dump(data, handle, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def find_kernel_process():
    """按启动命令行特征定位内核进程（python kernel/main.py），跳过 cmd/npm 包装进程。"""
    if psutil is None:
        return None
    fallback = None
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline") or []
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        joined = " ".join(cmdline).replace("/", "\\")
        if "kernel\\main.py" not in joined and "kernel.main" not in joined:
            continue
        name = (proc.info.get("name") or "").lower()
        if name.startswith("python"):
            return proc  # 真正的内核进程优先
        fallback = fallback or proc
    return fallback


def rss_mb(proc) -> float | None:
    if proc is None:
        return None
    try:
        return round(proc.memory_info().rss / 1024 / 1024, 1)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


def build_scenarios(base_url: str, model: str, struct_model: str) -> list[tuple[str, object]]:
    """固定场景清单：(名称, 可调用)。保持与冒烟测试同口径，保证可复跑。"""
    presets = get(base_url, "/rules/presets")["items"]
    full = next((p for p in presets if p["id"] == "compliance-full"), presets[0])
    ids_xml = get(base_url, "/ids/example")["xml"]
    return [
        ("ifc/summary", lambda: get(base_url, "/ifc/summary", path=model)),
        ("ifc/hierarchy", lambda: get(base_url, "/ifc/hierarchy", path=model)),
        ("geometry/stats", lambda: get(base_url, "/geometry/stats", path=model)),
        ("clash/run", lambda: get(base_url, "/clash/run", path=model)),
        ("clash/matrix", lambda: post(base_url, "/clash/matrix", {"path": model})),
        ("rules/run(全部模板)", lambda: get(base_url, "/rules/run", path=model)),
        ("rules/run(合规全套)", lambda: post(
            base_url, "/rules/run", {"path": model, "rule_ids": full["rule_ids"]}
        )),
        ("federation/merge(2模型)", lambda: post(
            base_url, "/federation/merge", {"paths": [model, struct_model], "max_depth": 4}
        )),
        ("ids/validate(示例)", lambda: post(
            base_url, "/ids/validate", {"path": model, "xml": ids_xml}
        )),
        ("takeoff/run(3自定义列)", lambda: post(
            base_url, "/takeoff/run",
            {"path": model, "columns": [
                {"key": "volume", "name": "体积", "expr": "qty('volume')"},
                {"key": "volume2", "name": "两倍体积", "expr": "qty('volume') * 2"},
                {"key": "label", "name": "标签", "expr": "if(contains(attr('Name'), 'Wall'), '墙', '其他')"},
            ]},
        )),
        ("report/export(pdf)", lambda: post(
            base_url, "/report/export",
            {"report": {"model_path": model, "generated_at": "2026-10-14T00:00:00+00:00",
                        "summary": {"total": 0, "by_severity": {}, "by_category": {}, "by_source": {},
                                    "rules_run": 0, "rules_failed": 0, "clashes": 0},
                        "issues": []}, "format": "pdf"},
        )),
    ]


def collect(args: argparse.Namespace) -> dict:
    model = str(Path(args.model).resolve())
    struct_model = str(STRUCT_MODEL.resolve())
    if not Path(model).is_file():
        raise SystemExit(f"模型文件不存在：{model}")
    if not Path(struct_model).is_file():
        raise SystemExit(f"第二模型源不存在：{struct_model}")

    health = get(args.base_url, "/health")
    proc = find_kernel_process()
    mem_samples: list[float] = []
    start_rss = rss_mb(proc)
    if start_rss is not None:
        mem_samples.append(start_rss)

    results = []
    for name, fn in build_scenarios(args.base_url, model, struct_model):
        runs: list[float] = []
        for _ in range(args.repeat):
            tic = time.perf_counter()
            fn()
            runs.append(round((time.perf_counter() - tic) * 1000, 1))
            sample = rss_mb(proc)
            if sample is not None:
                mem_samples.append(sample)
        results.append({
            "name": name,
            "runs_ms": runs,
            "best_ms": min(runs),
            "avg_ms": round(statistics.fmean(runs), 1),
        })
        print(f"[perf] {name:<26} best={min(runs):>8.1f}ms  avg={statistics.fmean(runs):>8.1f}ms  runs={runs}")

    end_rss = rss_mb(proc)
    report = {
        "label": args.label,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "base_url": args.base_url,
        "kernel_version": health.get("version"),
        "model": model,
        "repeat": args.repeat,
        "hardware": {
            "platform": platform.platform(),
            "cpu": platform.processor() or platform.machine(),
            "cpu_count": os.cpu_count(),
            "ram_total_mb": round(psutil.virtual_memory().total / 1024 / 1024) if psutil else None,
            "python": platform.python_version(),
        },
        "kernel_memory_mb": (
            {"start": start_rss, "end": end_rss, "peak": max(mem_samples)} if mem_samples else None
        ),
        "results": results,
    }
    if mem_samples:
        print(f"[perf] 内核内存 MB：start={start_rss} end={end_rss} peak={max(mem_samples)}")
    else:
        print("[perf] 未找到内核进程或未安装 psutil，仅记录耗时")
    return report


def compare(current: dict, baseline: dict, threshold_pct: float, min_delta_ms: float) -> int:
    base_by_name = {item["name"]: item for item in baseline["results"]}
    regressions = 0
    print(f"\n{'场景':<26} {'基线best':>10} {'本次best':>10} {'Δms':>9} {'Δ%':>8}  判定")
    for item in current["results"]:
        base = base_by_name.get(item["name"])
        if base is None:
            print(f"{item['name']:<26} {'—':>10} {item['best_ms']:>10.1f} {'—':>9} {'—':>8}  新增场景")
            continue
        delta_ms = round(item["best_ms"] - base["best_ms"], 1)
        delta_pct = round(delta_ms / base["best_ms"] * 100, 1) if base["best_ms"] else 0.0
        regressed = delta_pct > threshold_pct and delta_ms > min_delta_ms
        verdict = "回归!" if regressed else ("变快" if delta_pct < -threshold_pct else "持平")
        regressions += 1 if regressed else 0
        print(f"{item['name']:<26} {base['best_ms']:>10.1f} {item['best_ms']:>10.1f} "
              f"{delta_ms:>9.1f} {delta_pct:>7.1f}%  {verdict}")
    missing = [n for n in base_by_name if n not in {i["name"] for i in current["results"]}]
    for name in missing:
        print(f"{name:<26} 基线中存在但本次未运行")
    cur_mem = current.get("kernel_memory_mb")
    base_mem = baseline.get("kernel_memory_mb")
    if cur_mem and base_mem:
        delta = round((cur_mem.get("peak") or 0) - (base_mem.get("peak") or 0), 1)
        print(f"\n内核峰值内存：基线 {base_mem.get('peak')}MB → 本次 {cur_mem.get('peak')}MB（Δ{delta}MB）")
    print(f"\n比对基线 {baseline['label']}（{baseline['recorded_at']}）：回归 {regressions} 个")
    return 1 if regressions else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="内核性能基线采集与回归比对")
    parser.add_argument("--base-url", default="http://127.0.0.1:4319")
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    parser.add_argument("--repeat", type=int, default=2, help="每场景重复次数，取 best/avg（默认 2）")
    parser.add_argument("--label", default="current", help="本次采集标签（默认 current）")
    parser.add_argument("--save", metavar="NAME", help="把结果保存为基线 baselines/<NAME>.json")
    parser.add_argument("--compare", metavar="NAME", help="与基线 baselines/<NAME>.json 比对")
    parser.add_argument("--threshold", type=float, default=20.0, help="回归判定阈值百分比（默认 20）")
    parser.add_argument("--min-delta-ms", type=float, default=50.0, help="回归判定最小绝对差毫秒（默认 50）")
    args = parser.parse_args()

    if args.save:
        args.label = args.save
    report = collect(args)

    if args.save:
        path = BASELINE_DIR / f"{args.save}.json"
        atomic_write_json(path, report)
        print(f"[perf] 基线已保存 → {path}")

    if args.compare:
        path = BASELINE_DIR / f"{args.compare}.json"
        if not path.is_file():
            raise SystemExit(f"基线不存在：{path}（先用 --save {args.compare} 建立）")
        baseline = json.loads(path.read_text(encoding="utf-8"))
        return compare(report, baseline, args.threshold, args.min_delta_ms)
    return 0


if __name__ == "__main__":
    sys.exit(main())
