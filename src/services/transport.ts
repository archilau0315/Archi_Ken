// 渲染进程统一传输层（L4）：桌面端走 Electron IPC 桥，浏览器开发期走 vite 代理，
// 云端生产 Web 版走同源 /api/* 前缀（由 Nginx 反代到后端容器）。
// 只负责「发请求 + 解析响应/错误」，不含任何业务语义。

/** 构建模式：VITE_APP_MODE 环境变量注入，区分 electron / web / cloud */
export const APP_MODE: 'electron' | 'web' | 'cloud' =
  (import.meta.env.VITE_APP_MODE as 'electron' | 'web' | 'cloud' | undefined) ?? 'electron'

/** 生产 Web 版 API Key（Nginx 层或 L3 层鉴权时用）。 */
const API_KEY = import.meta.env.VITE_ARCHIKEN_API_KEY as string | undefined

/** 云端部署的子路径前缀（如 /aitools/aichiken），本地开发/单机版为空串。 */
const API_PREFIX = (import.meta.env.VITE_ARCHIKEN_API_PREFIX as string | undefined) ?? ''

export type ServiceTarget = 'kernel' | 'server'

export interface ServiceRequest {
  target: ServiceTarget
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

/** 主进程/浏览器统一返回的原始响应（由调用方按 content-type 解析）。 */
export interface RawResponse {
  status: number
  contentType: string
  text: string
}

/** 浏览器开发期使用的 vite 代理前缀，与 vite.config.ts 中保持一致；
 *  云端子路径部署时由 API_PREFIX 拼出完整前缀（如 /aitools/aichiken/api/kernel）。 */
const PROXY_PREFIX: Record<ServiceTarget, string> = {
  kernel: `${API_PREFIX}/api/kernel`,
  server: `${API_PREFIX}/api/server`
}

function buildQuery(query: ServiceRequest['query']): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** 从错误响应体中提取可读信息（兼容内核的 detail 字段）。 */
function errorDetail(raw: string, status: number): string {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { detail?: string; error?: string }
      return parsed.detail ?? parsed.error ?? raw
    } catch {
      return raw
    }
  }
  return `请求失败（HTTP ${status}）`
}

/** 发送请求并取回原始响应：Electron 走 IPC，浏览器/云端走 fetch（经 vite 代理或 Nginx 反代）。 */
async function raw(spec: ServiceRequest): Promise<RawResponse> {
  const bridge = window.archiken
  if (bridge?.forward) {
    return bridge.forward(spec)
  }

  const url = `${PROXY_PREFIX[spec.target]}${spec.path}${buildQuery(spec.query)}`
  const init: RequestInit = { method: spec.method }
  const headers: Record<string, string> = {}
  if (spec.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }
  if (Object.keys(headers).length > 0) init.headers = headers
  init.body = spec.body !== undefined ? JSON.stringify(spec.body) : undefined
  const res = await fetch(url, init)
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text: await res.text() }
}

/** 统一请求：按 content-type 解析 JSON 或返回文本；非 2xx 抛出可读错误。 */
export async function apiRequest<T>(spec: ServiceRequest): Promise<T> {
  const res = await raw(spec)
  if (res.status < 200 || res.status >= 300) throw new Error(errorDetail(res.text, res.status))
  if (res.contentType.includes('json')) return (res.text ? JSON.parse(res.text) : null) as T
  return res.text as T
}
