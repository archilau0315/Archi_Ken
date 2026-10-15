import type { Context } from 'koa'

import { runClash, runRules } from '../kernel-client'
import { langOf } from '../i18n'
import { buildReport } from '../report/aggregate'
import { readJsonBody, type Handler } from '../router'
import { normalizeRuleset } from '../ruleset/model'
import { deleteRuleset, getRuleset, listRulesets, saveRuleset } from '../ruleset/store'

// 规则集管理端点（L3）：保存/复用规则集，并用规则集运行检查。
// 路由：GET /ruleset/list、GET /ruleset/get、POST /ruleset/save、
//       POST /ruleset/delete、POST /ruleset/run。

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

function queryId(ctx: Context): string {
  const id = (ctx.query as Record<string, unknown>).id
  return typeof id === 'string' ? id.trim() : ''
}

export const rulesetList: Handler = async (ctx) => {
  const items = await listRulesets()
  ctx.body = { total: items.length, items }
}

export const rulesetGet: Handler = async (ctx) => {
  const id = queryId(ctx)
  if (!id) throw httpError(400, '缺少参数 id')
  const ruleset = await getRuleset(id)
  if (!ruleset) throw httpError(404, `规则集不存在：${id}`)
  ctx.body = ruleset
}

export const rulesetSave: Handler = async (ctx) => {
  const body = await readJsonBody(ctx)
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  const input = normalizeRuleset(body, langOf(body))
  const saved = await saveRuleset(input)
  ctx.status = input.id ? 200 : 201
  ctx.body = saved
}

export const rulesetDelete: Handler = async (ctx) => {
  const body = (await readJsonBody(ctx)) as Record<string, unknown> | null
  const id = (typeof body?.id === 'string' && body.id.trim()) || queryId(ctx)
  if (!id) throw httpError(400, '缺少参数 id')
  ctx.body = { id, deleted: await deleteRuleset(id) }
}

export const rulesetRun: Handler = async (ctx) => {
  const body = await readJsonBody(ctx)
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  const payload = (body ?? {}) as Record<string, unknown>
  const id = typeof payload.id === 'string' ? payload.id.trim() : ''
  const path = typeof payload.path === 'string' ? payload.path.trim() : ''
  if (!id) throw httpError(400, '缺少参数 id（规则集）')
  if (!path) throw httpError(400, '缺少参数 path（IFC 文件绝对路径）')
  const includeClash = payload.include_clash !== false
  const lang = payload.lang === 'en' ? 'en' : 'zh'

  const ruleset = await getRuleset(id)
  if (!ruleset) throw httpError(404, `规则集不存在：${id}`)

  const rules = await runRules(path, undefined, ruleset.rules, lang)
  const clash = includeClash ? await runClash(path) : null
  ctx.body = buildReport(path, rules, clash)
}
