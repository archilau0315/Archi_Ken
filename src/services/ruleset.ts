// 规则集客户端（L4 → L3）：规则集的保存/复用与「用规则集运行检查」。

import type { RuleSpec } from './kernel'
import type { Report } from './report'
import { apiRequest } from './transport'

export interface RulesetSummary {
  id: string
  name: string
  description: string
  rules_count: number
  updated_at: string
}

export interface Ruleset {
  id: string
  name: string
  description: string
  rules: RuleSpec[]
  updated_at: string
}

export interface RulesetInput {
  id?: string
  name: string
  description: string
  rules: RuleSpec[]
}

/** 规则集摘要列表（按更新时间倒序）。 */
export function listRulesets(): Promise<{ total: number; items: RulesetSummary[] }> {
  return apiRequest({ target: 'server', method: 'GET', path: '/ruleset/list' })
}

/** 读取单个规则集（含规则本体）。 */
export function getRuleset(id: string): Promise<Ruleset> {
  return apiRequest({ target: 'server', method: 'GET', path: '/ruleset/get', query: { id } })
}

/** 保存（新建或覆盖）规则集。 */
export function saveRuleset(input: RulesetInput, lang?: 'zh' | 'en'): Promise<Ruleset> {
  return apiRequest({ target: 'server', method: 'POST', path: '/ruleset/save', body: { ...input, lang } })
}

/** 删除规则集。 */
export function deleteRuleset(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiRequest({ target: 'server', method: 'POST', path: '/ruleset/delete', body: { id } })
}

/** 用指定规则集对模型运行检查，返回统一问题清单（规则 + 碰撞）。 */
export function runRuleset(id: string, path: string, includeClash = true, lang?: 'zh' | 'en'): Promise<Report> {
  return apiRequest({ target: 'server', method: 'POST', path: '/ruleset/run', body: { id, path, include_clash: includeClash, lang } })
}
