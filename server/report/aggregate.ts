import type { ClashResponse, ElementRef, RulesResponse } from '../kernel-client'

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

/** 碰撞问题的双语文案。 */
const CLASH_I18N = {
  zh: {
    category: '碰撞检查',
    title: '硬碰撞',
    reason: (a: string, b: string) => `${a} 与 ${b} 发生几何相交`,
    stepPairs: (n: number) => `三角形相交对数 = ${n}`,
    stepVerdict: '构件表面存在交集 → 判定为硬碰撞'
  },
  en: {
    category: 'Clash Detection',
    title: 'Hard Clash',
    reason: (a: string, b: string) => `${a} geometrically intersects with ${b}`,
    stepPairs: (n: number) => `Intersecting triangle pairs = ${n}`,
    stepVerdict: 'Element surfaces overlap → classified as hard clash'
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

function fromClash(clash: ClashResponse, lang: string): Issue[] {
  const txt = CLASH_I18N[lang === 'en' ? 'en' : 'zh']
  return clash.items.map((item) => {
    const pair = [item.a.guid, item.b.guid].sort()
    return {
      id: `clash|${pair[0]}|${pair[1]}`,
      source: 'clash',
      severity: 'error',
      category: txt.category,
      title: txt.title,
      reference: null,
      element: item.a,
      related: item.b,
      location: item.contact_point,
      actual: item.triangle_pairs,
      expected: 0,
      reason: txt.reason(item.a.name ?? item.a.guid, item.b.name ?? item.b.guid),
      steps: [txt.stepPairs(item.triangle_pairs), txt.stepVerdict]
    }
  })
}

export function buildReport(
  modelPath: string,
  rules: RulesResponse,
  clash: ClashResponse | null,
  lang: string = 'zh'
): Report {
  const locale = lang === 'en' ? 'en' : 'zh'
  const issues = [...fromRules(rules), ...(clash ? fromClash(clash, locale) : [])]
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
      clashes: clash?.total ?? 0
    },
    issues
  }
}
