import { clashKeyOf } from '../clash/store'
import type { ClashMatrixItem, ClashMatrixResponse, ElementRef, RulesResponse } from '../kernel-client'

// 结果汇总（L3）：把内核的规则违规与碰撞结果统一成「问题清单（issues）」，
// 附带严重度、分类、原因链与统计，供报告渲染与 BCF 导出复用。

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  source: 'rule' | 'clash'
  severity: Severity
  category: string
  title: string
  reference: string | null
  element: ElementRef
  related: ElementRef | null
  location: number[] | null
  actual: unknown
  expected: unknown
  reason: string
  steps: string[]
}

export interface ReportSummary {
  total: number
  by_severity: Record<string, number>
  by_category: Record<string, number>
  by_source: Record<string, number>
  rules_run: number
  rules_failed: number
  clashes: number
}

export interface Report {
  model_path: string
  generated_at: string
  summary: ReportSummary
  issues: Issue[]
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 }

/** 碰撞问题的双语文案（按碰撞模式分标题）。 */
const CLASH_I18N = {
  zh: {
    category: '碰撞检查',
    titles: { hard: '硬碰撞', gap: '间隙不足', clearance: '净空不足', duplicate: '重复构件' } as Record<string, string>,
    reason: {
      hard: (a: string, b: string) => `${a} 与 ${b} 发生几何相交`,
      gap: (a: string, b: string) => `${a} 与 ${b} 间距小于间隙容差`,
      clearance: (a: string, b: string) => `${a} 与 ${b} 净距不满足净空要求`,
      duplicate: (a: string, b: string) => `${a} 与 ${b} 为同类型重复放置`
    } as Record<string, (a: string, b: string) => string>,
    stepPairs: (n: number) => `三角形相交对数 = ${n}`,
    stepDistance: (d: number) => `实测间距 = ${Number(d.toFixed(3))}`,
    stepOverlap: (d: number) => `包围盒重合度 = ${Math.round(d * 100)}%`,
    stepVerdict: '构件表面存在交集 → 判定为硬碰撞',
    elementId: '构件 ID'
  },
  en: {
    category: 'Clash Detection',
    titles: { hard: 'Hard Clash', gap: 'Insufficient Gap', clearance: 'Clearance Violation', duplicate: 'Duplicate Element' } as Record<string, string>,
    reason: {
      hard: (a: string, b: string) => `${a} geometrically intersects with ${b}`,
      gap: (a: string, b: string) => `Gap between ${a} and ${b} is below tolerance`,
      clearance: (a: string, b: string) => `Clearance between ${a} and ${b} is not satisfied`,
      duplicate: (a: string, b: string) => `${a} and ${b} are duplicated elements of the same type`
    } as Record<string, (a: string, b: string) => string>,
    stepPairs: (n: number) => `Intersecting triangle pairs = ${n}`,
    stepDistance: (d: number) => `Measured distance = ${Number(d.toFixed(3))}`,
    stepOverlap: (d: number) => `BBox overlap = ${Math.round(d * 100)}%`,
    stepVerdict: 'Element surfaces overlap → classified as hard clash',
    elementId: 'Element ID'
  }
}

function asSeverity(value: string): Severity {
  return value === 'warning' || value === 'info' ? value : 'error'
}

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1
}

function fromRules(rules: RulesResponse): Issue[] {
  const issues: Issue[] = []
  for (const rule of rules.rules) {
    for (const item of rule.items) {
      issues.push({
        id: `rule|${rule.rule_id}|${item.guid}|${item.related?.guid ?? '-'}`,
        source: 'rule',
        severity: asSeverity(rule.severity),
        category: rule.category,
        title: rule.name,
        reference: rule.reference ?? null,
        element: { guid: item.guid, name: item.name, ifc_type: item.ifc_type },
        related: item.related,
        location: item.location ?? null,
        actual: item.actual,
        expected: item.expected,
        reason: item.reason,
        steps: item.steps ?? []
      })
    }
  }
  return issues
}

function fromClash(clash: ClashMatrixResponse, statuses: Record<string, { status: string }>, lang: string): Issue[] {
  const txt = CLASH_I18N[lang === 'en' ? 'en' : 'zh']
  const issues: Issue[] = []
  for (const item of clash.items) {
    // 用户已忽略的碰撞（已知可接受）不进入报告。
    const statusKey = clashKeyOf(item.mode, item.a.guid, item.b.guid)
    if (statuses[statusKey]?.status === 'ignored') continue
    issues.push(fromClashItem(item, txt))
  }
  return issues
}

function fromClashItem(item: ClashMatrixItem, txt: (typeof CLASH_I18N)['zh']): Issue {
  const pair = [item.a.guid, item.b.guid].sort()
  const reasonFn = txt.reason[item.mode] ?? txt.reason.hard
  const steps: string[] = []
  if (item.mode === 'hard') steps.push(txt.stepPairs(item.triangle_pairs), txt.stepVerdict)
  if (item.distance !== null && item.mode !== 'hard') steps.push(txt.stepDistance(item.distance))
  if (item.overlap !== null) steps.push(txt.stepOverlap(item.overlap))
  return {
    id: `clash|${item.mode}|${pair[0]}|${pair[1]}`,
    source: 'clash',
    severity: item.mode === 'hard' ? 'error' : 'warning',
    category: txt.category,
    title: txt.titles[item.mode] ?? txt.titles.hard,
    reference: null,
    element: item.a,
    related: item.b,
    location: item.contact_point,
    actual: item.mode === 'duplicate' ? item.overlap : (item.distance ?? item.triangle_pairs),
    expected: item.mode === 'duplicate' ? null : 0,
    reason: reasonFn(item.a.name ?? item.a.guid, item.b.name ?? item.b.guid),
    steps
  }
}

export function buildReport(
  modelPath: string,
  rules: RulesResponse,
  clash: ClashMatrixResponse | null,
  statuses: Record<string, { status: string }> = {},
  lang: string = 'zh'
): Report {
  const locale = lang === 'en' ? 'en' : 'zh'
  const clashIssues = clash ? fromClash(clash, statuses, locale) : []
  const issues = [...fromRules(rules), ...clashIssues]
  issues.sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    return rank !== 0 ? rank : a.title.localeCompare(b.title, locale)
  })

  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  for (const issue of issues) {
    bump(bySeverity, issue.severity)
    bump(byCategory, issue.category)
    bump(bySource, issue.source)
  }

  return {
    model_path: modelPath,
    generated_at: new Date().toISOString(),
    summary: {
      total: issues.length,
      by_severity: bySeverity,
      by_category: byCategory,
      by_source: bySource,
      rules_run: rules.rules_run,
      rules_failed: rules.rules_failed,
      clashes: clashIssues.length
    },
    issues
  }
}
