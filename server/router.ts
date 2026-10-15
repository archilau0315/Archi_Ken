import type { Context, Middleware } from 'koa'

// 极简路由：路径支持 :param 段，附带 JSON body 读取工具。
// 仅依赖 koa 自身（ctx.query 已内置），不引入 koa-router / koa-bodyparser。

export type Handler = (ctx: Context, params: Record<string, string>) => Promise<void> | void

interface Route {
  method: string
  segments: string[]
  handler: Handler
}

/** 读取请求体原始二进制（用于文件上传）。 */
export async function readRawBody(ctx: Context): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of ctx.req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

/** 读取请求体并解析 JSON；空体返回 null，非法 JSON 返回 undefined。 */
export async function readJsonBody(ctx: Context): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of ctx.req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function createRouter(): {
  get: (path: string, handler: Handler) => void
  post: (path: string, handler: Handler) => void
  middleware: () => Middleware
} {
  const routes: Route[] = []

  const add = (method: string, path: string, handler: Handler): void => {
    routes.push({ method, segments: path.split('/').filter(Boolean), handler })
  }

  const match = (method: string, path: string): { handler: Handler; params: Record<string, string> } | null => {
    const parts = path.split('/').filter(Boolean)
    for (const route of routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue
      const params: Record<string, string> = {}
      let ok = true
      for (let i = 0; i < route.segments.length; i += 1) {
        const seg = route.segments[i]
        if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i])
        else if (seg !== parts[i]) {
          ok = false
          break
        }
      }
      if (ok) return { handler: route.handler, params }
    }
    return null
  }

  const middleware = (): Middleware => async (ctx, next) => {
    const hit = match(ctx.method.toUpperCase(), ctx.path)
    if (!hit) {
      ctx.status = 404
      ctx.body = { error: 'not_found', path: ctx.path }
      return
    }
    try {
      await hit.handler(ctx, hit.params)
    } catch (err) {
      const status = (err as { status?: number }).status ?? 502
      ctx.status = status
      ctx.body = { error: 'server_error', detail: String((err as Error).message ?? err) }
    }
    await next()
  }

  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    middleware
  }
}
