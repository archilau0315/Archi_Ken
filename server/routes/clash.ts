// 碰撞状态端点（L3）：冲突矩阵结果的审查状态（new / 已确认 / 已忽略）持久化。

import type { Context } from 'koa'

import { getStatuses, setStatuses } from '../clash/store'
import { readJsonBody, type Handler } from '../router'

/** GET /clash/status/list?path= → {path, statuses} */
export const clashStatusList: Handler = async (ctx: Context) => {
  const path = String(ctx.query.path ?? '')
  if (!path) {
    ctx.status = 400
    ctx.body = { error: 'bad_request', detail: '缺少 path 参数' }
    return
  }
  ctx.body = { path, statuses: await getStatuses(path) }
}

interface StatusSetBody {
  path?: string
  entries?: { key?: string; status?: string }[]
}

/** POST /clash/status/set {path, entries:[{key, status}]} → {saved}；status 空串删除该键。 */
export const clashStatusSet: Handler = async (ctx: Context) => {
  const body = (await readJsonBody(ctx)) as StatusSetBody | null
  const path = String(body?.path ?? '')
  const entries = Array.isArray(body?.entries) ? body!.entries! : []
  if (!path) {
    ctx.status = 400
    ctx.body = { error: 'bad_request', detail: '缺少 path' }
    return
  }
  const saved = await setStatuses(
    path,
    entries.map((entry) => ({ key: String(entry.key ?? ''), status: (entry.status ?? '') as never }))
  )
  ctx.body = { saved }
}
