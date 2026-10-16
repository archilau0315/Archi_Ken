import type { Context } from 'koa'

import { langOf } from '../i18n'
import { readJsonBody, type Handler } from '../router'
import { normalizeTakeoffDefinition } from '../takeoff-definition/model'
import { deleteDefinition, getDefinition, listDefinitions, saveDefinition } from '../takeoff-definition/store'

// 信息提取用户模板端点（L3）：保存/复用自定义 ITO 模板。
// 路由：GET /takeoff-definitions/list、GET /takeoff-definitions/get、
//       POST /takeoff-definitions/save、POST /takeoff-definitions/delete。

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

function queryId(ctx: Context): string {
  const id = (ctx.query as Record<string, unknown>).id
  return typeof id === 'string' ? id.trim() : ''
}

export const takeoffDefinitionList: Handler = async (ctx) => {
  const items = await listDefinitions()
  ctx.body = { total: items.length, items }
}

export const takeoffDefinitionGet: Handler = async (ctx) => {
  const id = queryId(ctx)
  if (!id) throw httpError(400, '缺少参数 id')
  const definition = await getDefinition(id)
  if (!definition) throw httpError(404, `模板不存在：${id}`)
  ctx.body = definition
}

export const takeoffDefinitionSave: Handler = async (ctx) => {
  const body = await readJsonBody(ctx)
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  const input = normalizeTakeoffDefinition(body, langOf(body))
  const saved = await saveDefinition(input)
  ctx.status = input.id ? 200 : 201
  ctx.body = saved
}

export const takeoffDefinitionDelete: Handler = async (ctx) => {
  const body = (await readJsonBody(ctx)) as Record<string, unknown> | null
  const id = (typeof body?.id === 'string' && body.id.trim()) || queryId(ctx)
  if (!id) throw httpError(400, '缺少参数 id')
  ctx.body = { id, deleted: await deleteDefinition(id) }
}
