// 规则集数据模型与结构校验（L3）。
// 规则本体与内核规则 DSL v1 对齐；此处只做结构级校验，
// 完整语义校验由内核 POST /rules/validate 完成。

import { tr, type Lang } from '../i18n'

export type Severity = 'error' | 'warning' | 'info'

// 与内核 DSL v1 的 CHECK_TYPES 保持一致（kernel/app/rules/dsl.py）。
export const CHECK_TYPES = ['property', 'intersection', 'clearance', 'duplicate', 'headroom', 'dimension', 'count', 'containment'] as const
export const SEVERITIES: Severity[] = ['error', 'warning', 'info']

export interface RuleTarget {
  ifc_type?: string[] | string
  where?: unknown[]
}

export interface RuleCheck {
  type?: string
  [key: string]: unknown
}

/** 单条规则（与内核 DSL 对齐）。 */
export interface RuleLike {
  id: string
  name?: string
  category?: string
  severity?: Severity
  target: RuleTarget
  check: RuleCheck
  message?: string
}

/** 一个规则集：命名的一组规则，可保存与复用。 */
export interface Ruleset {
  id: string
  name: string
  description: string
  rules: RuleLike[]
  updated_at: string
}

/** 列表用的轻量摘要（不含规则本体）。 */
export interface RulesetSummary {
  id: string
  name: string
  description: string
  rules_count: number
  updated_at: string
}

/** 规则集输入（保存请求体解析后的形态）。 */
export interface RulesetInput {
  id?: string
  name: string
  description: string
  rules: RuleLike[]
}

/** 规则集相关错误（携带 HTTP 状态码）。 */
export class RulesetError extends Error {
  status = 400
}

function fail(message: string): never {
  throw new RulesetError(message)
}

function checkRule(raw: unknown, index: number, lang: Lang | undefined): RuleLike {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(tr(lang, `第 ${index + 1} 条规则必须是对象`, `Rule #${index + 1} must be an object`))
  const rule = raw as Record<string, unknown>
  if (typeof rule.id !== 'string' || !rule.id.trim()) fail(tr(lang, `第 ${index + 1} 条规则缺少 id`, `Rule #${index + 1} is missing id`))
  if (!rule.target || typeof rule.target !== 'object') fail(tr(lang, `规则 ${rule.id} 缺少 target`, `Rule ${rule.id} is missing target`))
  if (!rule.check || typeof rule.check !== 'object') fail(tr(lang, `规则 ${rule.id} 缺少 check`, `Rule ${rule.id} is missing check`))
  const type = (rule.check as Record<string, unknown>).type
  if (!CHECK_TYPES.includes(type as (typeof CHECK_TYPES)[number])) {
    fail(tr(
      lang,
      `规则 ${rule.id} 的 check.type 不合法：${String(type)}（可选 ${CHECK_TYPES.join('/')}）`,
      `Invalid check.type for rule ${rule.id}: ${String(type)} (allowed: ${CHECK_TYPES.join('/')})`
    ))
  }
  if (rule.severity !== undefined && !SEVERITIES.includes(rule.severity as Severity)) {
    fail(tr(
      lang,
      `规则 ${rule.id} 的 severity 不合法：${String(rule.severity)}（可选 ${SEVERITIES.join('/')}）`,
      `Invalid severity for rule ${rule.id}: ${String(rule.severity)} (allowed: ${SEVERITIES.join('/')})`
    ))
  }
  return rule as unknown as RuleLike
}

/** 校验并规范化保存请求体，返回可直接入库的输入。 */
export function normalizeRuleset(raw: unknown, lang?: Lang): RulesetInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(tr(lang, '请求体必须是对象', 'Request body must be an object'))
  const body = raw as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) fail(tr(lang, '缺少规则集名称 name', 'Missing ruleset name'))
  const rules = body.rules
  if (!Array.isArray(rules) || rules.length === 0) fail(tr(lang, 'rules 必须是非空数组', 'rules must be a non-empty array'))
  const parsed = rules.map((rule, index) => checkRule(rule, index, lang))
  const ids = parsed.map((rule) => rule.id)
  if (new Set(ids).size !== ids.length) fail(tr(lang, '规则 id 不能重复', 'Rule ids must be unique'))
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  return { id, name, description, rules: parsed }
}
