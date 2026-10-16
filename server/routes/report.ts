import type { Context } from 'koa'

import { getStatuses } from '../clash/store'
import { runClashMatrix, runRules } from '../kernel-client'
import { buildReport, type Report } from '../report/aggregate'
import { exportReportFile, type ExportFormat } from '../report/export'
import { renderReportHtml } from '../report/html'
import { readJsonBody, type Handler } from '../router'

// 报告服务端点（L3）：编排内核「规则 + 碰撞」结果 → 统一问题清单 / HTML 报告。

interface RunOptions {
  path: string
  ruleIds?: string[]
  includeClash: boolean
  lang?: string
}

function parseRuleIds(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean)
  return undefined
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return value === true || value === 'true' || value === '1'
}

/** 从查询参数与（可选的）请求体合并运行参数；缺少 path 抛 400。 */
async function parseOptions(ctx: Context): Promise<RunOptions> {
  const query = ctx.query as Record<string, unknown>
  let body: Record<string, unknown> = {}
  if (ctx.method.toUpperCase() === 'POST') {
    const parsed = await readJsonBody(ctx)
    if (parsed === undefined) {
      const err = new Error('请求体不是合法 JSON') as Error & { status: number }
      err.status = 400
      throw err
    }
    body = (parsed as Record<string, unknown>) ?? {}
  }

  const path = (body.path as string) ?? (query.path as string)
  if (!path) {
    const err = new Error('缺少参数 path（IFC 文件绝对路径）') as Error & { status: number }
    err.status = 400
    throw err
  }
  const rawLang = (body.lang ?? query.lang) as unknown
  return {
    path,
    ruleIds: parseRuleIds(body.rule_ids ?? query.rule_ids),
    includeClash: parseBool(body.include_clash ?? query.include_clash, true),
    lang: rawLang === 'en' ? 'en' : 'zh'
  }
}

async function build(ctx: Context): Promise<Report> {
  const options = await parseOptions(ctx)
  const rules = await runRules(options.path, options.ruleIds, undefined, options.lang)
  if (!options.includeClash) {
    return buildReport(options.path, rules, null, {}, options.lang)
  }
  // 碰撞采用冲突矩阵口径（与碰撞面板一致），用户标记「已忽略」的碰撞不进报告。
  const [clash, statuses] = await Promise.all([runClashMatrix(options.path), getStatuses(options.path)])
  return buildReport(options.path, rules, clash, statuses, options.lang)
}

export const reportRunGet: Handler = async (ctx) => {
  ctx.body = await build(ctx)
}

export const reportRunPost: Handler = async (ctx) => {
  ctx.body = await build(ctx)
}

export const reportHtmlGet: Handler = async (ctx) => {
  const report = await build(ctx)
  const options = await parseOptions(ctx)
  ctx.type = 'text/html; charset=utf-8'
  ctx.body = renderReportHtml(report, options.lang)
}

/** 报告导出（M9）：body { path, format: pdf|xlsx, rule_ids?, include_clash?, title? } → 文件信息。 */
export const reportExportPost: Handler = async (ctx) => {
  const parsed = await readJsonBody(ctx)
  if (parsed === undefined) {
    const err = new Error('请求体不是合法 JSON') as Error & { status: number }
    err.status = 400
    throw err
  }
  const body = (parsed ?? {}) as Record<string, unknown>
  const path = typeof body.path === 'string' ? body.path.trim() : ''
  if (!path) {
    const err = new Error('缺少参数 path（IFC 文件绝对路径）') as Error & { status: number }
    err.status = 400
    throw err
  }
  const format: ExportFormat = body.format === 'xlsx' ? 'xlsx' : 'pdf'
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined
  ctx.body = await exportReportFile(
    path,
    format,
    parseRuleIds(body.rule_ids),
    parseBool(body.include_clash, true),
    title,
    body.lang === 'en' ? 'en' : 'zh'
  )
}
