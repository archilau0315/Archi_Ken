import type { Context } from 'koa'

import { normalizeTask } from '../autorun/model'
import { runTask } from '../autorun/runner'
import { deleteTask, getRun, getTask, listRuns, listTasks, saveTask } from '../autorun/store'
import { readJsonBody, type Handler } from '../router'

// Autorun 批量检查端点（L3，M11）：任务保存/复用，一键批量无人值守运行，结果落盘与分发。
// 路由：GET /autorun/list、GET /autorun/get、POST /autorun/save、POST /autorun/delete、
//       POST /autorun/run、GET /autorun/runs、GET /autorun/run/get。

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  throw err
}

function queryParam(ctx: Context, key: string): string {
  const value = (ctx.query as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function bodyId(ctx: Context, key: string): Promise<string> {
  const body = (await readJsonBody(ctx)) as Record<string, unknown> | null | undefined
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  const value = body?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const autorunList: Handler = async (ctx) => {
  const items = await listTasks()
  ctx.body = { total: items.length, items }
}

export const autorunGet: Handler = async (ctx) => {
  const id = queryParam(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  const task = await getTask(id)
  if (!task) throw httpError(404, `任务不存在：${id}`)
  ctx.body = task
}

export const autorunSave: Handler = async (ctx) => {
  const body = await readJsonBody(ctx)
  if (body === undefined) throw httpError(400, '请求体不是合法 JSON')
  const input = normalizeTask(body)
  const saved = await saveTask(input)
  ctx.status = input.id ? 200 : 201
  ctx.body = saved
}

export const autorunDelete: Handler = async (ctx) => {
  const id = (await bodyId(ctx, 'id')) || queryParam(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id')
  ctx.body = { id, deleted: await deleteTask(id) }
}

/** 触发批量运行（同步执行，完成后返回运行记录含产物清单）。 */
export const autorunRun: Handler = async (ctx) => {
  const id = await bodyId(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id（任务）')
  const task = await getTask(id)
  if (!task) throw httpError(404, `任务不存在：${id}`)
  ctx.body = await runTask(task)
}

export const autorunRuns: Handler = async (ctx) => {
  const taskId = queryParam(ctx, 'task_id')
  const items = await listRuns(taskId || undefined)
  ctx.body = { total: items.length, items }
}

export const autorunRunGet: Handler = async (ctx) => {
  const id = queryParam(ctx, 'id')
  if (!id) throw httpError(400, '缺少参数 id（运行记录）')
  const run = await getRun(id)
  if (!run) throw httpError(404, `运行记录不存在：${id}`)
  ctx.body = run
}
