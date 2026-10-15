"""语料库清单校验与覆盖率统计工具（计划工作包 1.1）。

用法：
    python tools/corpus/check_manifest.py
    python tools/corpus/check_manifest.py --check-files

输出：格式错误清单 + 4 版本 × 4 导出方 × 4 规模档 的覆盖矩阵与覆盖率。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "corpus" / "manifest.json"

REQUIRED_FIELDS = (
    "id",
    "file",
    "ifc_version",
    "exporter",
    "size_tier",
    "size_bytes",
    "elements",
    "note",
    "added_at",
)


def load_manifest(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"未找到清单文件：{path}")
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def validate(manifest: dict) -> list[str]:
    """返回错误信息列表，无错误则为空列表。"""
    errors: list[str] = []
    matrix = manifest.get("matrix") or {}
    versions = matrix.get("ifc_versions") or []
    exporters = matrix.get("exporters") or []
    tiers = matrix.get("size_tiers") or []

    if not versions or not exporters or not tiers:
        errors.append("matrix 缺少 ifc_versions / exporters / size_tiers 之一")
        return errors

    samples = manifest.get("samples")
    if not isinstance(samples, list):
        errors.append("samples 必须是数组")
        return errors

    seen_ids: set[str] = set()
    for index, sample in enumerate(samples):
        where = f"samples[{index}]"
        missing = [f for f in REQUIRED_FIELDS if f not in sample]
        if missing:
            errors.append(f"{where} 缺少字段：{', '.join(missing)}")
            continue

        sample_id = sample["id"]
        if sample_id in seen_ids:
            errors.append(f"{where} id 重复：{sample_id}")
        seen_ids.add(sample_id)

        if sample["ifc_version"] not in versions:
            errors.append(f"{where} ifc_version 非法：{sample['ifc_version']}")
        if sample["exporter"] not in exporters:
            errors.append(f"{where} exporter 非法：{sample['exporter']}")
        if sample["size_tier"] not in tiers:
            errors.append(f"{where} size_tier 非法：{sample['size_tier']}")

    return errors


def coverage(manifest: dict) -> dict[tuple[str, str, str], int]:
    """统计每个矩阵格子内的样本数。"""
    counts: dict[tuple[str, str, str], int] = {}
    for sample in manifest.get("samples", []):
        key = (sample["ifc_version"], sample["exporter"], sample["size_tier"])
        counts[key] = counts.get(key, 0) + 1
    return counts


def print_coverage(manifest: dict, counts: dict[tuple[str, str, str], int]) -> None:
    matrix = manifest["matrix"]
    versions: list[str] = matrix["ifc_versions"]
    exporters: list[str] = matrix["exporters"]
    tiers: list[str] = matrix["size_tiers"]

    total_cells = len(versions) * len(exporters) * len(tiers)
    filled = sum(1 for key, n in counts.items() if n > 0)

    print("覆盖矩阵（版本 / 导出方 / 规模档 → 样本数）")
    for version in versions:
        print(f"\n  [{version}]")
        header = "    " + "".join(f"{tier:>10}" for tier in tiers)
        print(header)
        for exporter in exporters:
            row = f"    {exporter:<8}"
            for tier in tiers:
                n = counts.get((version, exporter, tier), 0)
                row += f"{('-' if n == 0 else str(n)):>10}"
            print(row)

    print(f"\n已覆盖格：{filled} / {total_cells}  覆盖率：{filled / total_cells:.1%}")
    print(f"样本总数：{sum(counts.values())}")


def check_files(manifest: dict) -> list[str]:
    missing: list[str] = []
    for sample in manifest.get("samples", []):
        if not (ROOT / sample["file"]).exists():
            missing.append(sample["file"])
    return missing


def main() -> int:
    parser = argparse.ArgumentParser(description="语料库清单校验与覆盖率统计")
    parser.add_argument("--check-files", action="store_true", help="同时校验样本文件是否存在")
    args = parser.parse_args()

    manifest = load_manifest(MANIFEST_PATH)
    errors = validate(manifest)

    if errors:
        print("发现格式错误：")
        for err in errors:
            print(f"  - {err}")
        return 1

    print_coverage(manifest, coverage(manifest))

    if args.check_files:
        missing = check_files(manifest)
        if missing:
            print(f"\n缺失样本文件（{len(missing)}）：")
            for path in missing:
                print(f"  - {path}")
            return 1
        print("\n样本文件校验：全部存在")

    print("\n清单格式校验：通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
