"""同步模板到规则集存储（在 review 前运行）。"""
import json
import pathlib
import datetime
import sys

sys.path.insert(0, 'kernel')

from app.rules import templates, dsl

rules = templates.builtin_rules()
for r in rules:
    dsl.parse_rule(r)

GENERAL = {'碰撞检查', '合规检查', '模型质量', '施工可行性'}
IDS = {
    '通用规则': 'builtin-general', '无障碍': 'builtin-accessibility', '净高': 'builtin-headroom',
    '结构': 'builtin-structure', '疏散': 'builtin-evacuation', '机电': 'builtin-mep',
    '门窗': 'builtin-openings', '消防': 'builtin-fire', '空间': 'builtin-space', '防护': 'builtin-guard',
}

groups = {}
for r in rules:
    key = '通用规则' if r.get('category') in GENERAL else r.get('category', '其他')
    groups.setdefault(key, []).append(r)

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
dst = pathlib.Path('.data/rulesets')
for name, items in groups.items():
    rid = IDS[name]
    f = dst / f'{rid}.json'
    old = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {'name': f'内置模板-{name}', 'description': ''}
    ruleset = {'id': rid, 'name': old['name'], 'description': old['description'], 'rules': items, 'updated_at': now}
    f.write_text(json.dumps(ruleset, ensure_ascii=False, indent=2), encoding='utf-8')
print('synced:', sum(len(v) for v in groups.values()), 'rules ->', len(groups), 'rulesets')
