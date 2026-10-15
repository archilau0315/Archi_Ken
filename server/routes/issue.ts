import type { Context } from 'koa'

import { toSummary } from '../bcf/model'
import {
  addComment,
  createIssue,
  exportBcf,
  importFromModel,
  removeIssue,
  setSnapshot,
  updateIssue
} from '../bcf/service'
import { getIssue, listIssues } from '../bcf/store'
import { langOf } from '../i18n'
import { readJsonBody, type Handler } from '../router'

// 沟通问题端点（L3，模块 M8）：列表 / 详情 / 创建 / 更新 / 删除 / 评论 / 快照 / 报告导入 / BCF 导出。
// 路由：GET /issues/list、GET /issues/get、
//       POST /issues/create|update|delete|comment|snapshot|import|bcf/export。

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

function queryStr(ctx: Context, key: string): string {
  const value = (ctx.query as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function bodyOf(ctx: Context): Promise<Record<string, unknown>> {
  const body = await readJsonBody(ctx)
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  return (body ?? {}) as Record<string, unknown>
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const issueList: Handler = async (ctx) => {
  let items = (await listIssues()).map(toSummary)
  const status = queryStr(ctx, 'status')
  const severity = queryStr(ctx, 'severity')
  const source = queryStr(ctx, 'source')
  if (status) items = items.filter((item) => item.status === status)
  if (severity) items = items.filter((item) => item.severity === severity)
  if (source) items = items.filter((item) => item.source === source)
  ctx.body = { total: items.length, items }
}

export const issueGet: Handler = async (ctx) => {
  const id = queryStr(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  const issue = await getIssue(id)
  if (!issue) throw httpError(404, `问题不存在：${id}`)
  ctx.body = issue
}

export const issueCreate: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  ctx.status = 201
  ctx.body = await createIssue(body)
}

export const issueUpdate: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const id = str(body, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  delete body.id
  ctx.body = await updateIssue(id, body)
}

export const issueDelete: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const id = str(body, 'id') || queryStr(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  ctx.body = { id, deleted: await removeIssue(id) }
}

export const issueComment: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const id = str(body, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  ctx.body = await addComment(id, str(body, 'author'), str(body, 'text'), langOf(body))
}

export const issueSnapshot: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const id = str(body, 'id')
  const dataUrl = str(body, 'data_url')
  if (!id) throw httpError(400, '缺少参数 id')
  if (!dataUrl) throw httpError(400, '缺少参数 data_url（PNG dataURL）')
  ctx.body = await setSnapshot(id, dataUrl, langOf(body))
}

export const issueImport: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const path = str(body, 'path')
  if (!path) throw httpError(400, '缺少参数 path（IFC 文件绝对路径）')
  const ruleIds = Array.isArray(body.rule_ids) ? (body.rule_ids as unknown[]).filter((v): v is string => typeof v === 'string') : undefined
  const includeClash = body.include_clash !== false
  const lang = body.lang === 'en' ? 'en' : undefined
  ctx.body = await importFromModel(path, ruleIds, includeClash, lang)
}

export const issueBcfExport: Handler = async (ctx) => {
  const body = await bodyOf(ctx)
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string') : undefined
  ctx.body = await exportBcf(ids, langOf(body))
}
