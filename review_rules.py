"""全量规则在 IFC 模型上逐条复核：分域跑全部规则集，输出每条规则的
target 数、命中数、示例，重点标出全灭可疑与无对象的规则。

用法：
    python -X utf8 review_rules.py [ifc路径] [域过滤子串]
缺省模型为 .data/uploads 下最新的 .ifc 文件。
"""
import json
import pathlib
import sys

sys.path.insert(0, 'kernel')

import ifcopenshell

from app.rules import evaluator

if len(sys.argv) > 1 and sys.argv[1].endswith('.ifc'):
    path = sys.argv[1]
    domain = sys.argv[2] if len(sys.argv) > 2 else None
else:
    uploads = sorted(pathlib.Path('.data/uploads').glob('*.ifc'), key=lambda p: p.stat().st_mtime)
    if not uploads:
        raise SystemExit('未找到 .data/uploads 下的 IFC 模型')
    path = str(uploads[-1])
    domain = sys.argv[1] if len(sys.argv) > 1 else None

rs_dir = pathlib.Path('.data/rulesets')

model = ifcopenshell.open(path)
print('model:', path)

for p in sorted(rs_dir.glob('*.json')):
    if domain and domain not in p.stem:
        continue
    rs = json.loads(p.read_text(encoding='utf-8'))
    result = evaluator.run(model, path, rs['rules'], lang='zh')
    print(f"\n===== {rs['name']} ({len(rs['rules'])} 条) =====")
    for r in result['rules']:
        mark = {'error': 'E', 'warning': 'W', 'info': 'I'}.get(r['severity'], '?')
        line = f"[{mark}] {r['rule_id']}: targets={r['target_total']} hits={r['violations']}"
        if r['violations'] and r['target_total'] == r['violations'] and r['target_total'] > 3:
            line += '  <<< 全灭可疑'
        if r['target_total'] == 0:
            line += '  (无对象)'
        print(line)
        for it in r['items'][:2]:
            print(f"      {it.get('name')} | {it.get('reason')}")
