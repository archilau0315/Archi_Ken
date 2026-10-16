// 内核客户端（L3 → L2）：封装对 Python 计算内核 HTTP 端点的调用。

const BASE_URL = (process.env.ARCHIKEN_KERNEL_URL ?? 'http://127.0.0.1:4319').replace(/\/$/, '')

export interface ElementRef {
  guid: string
  name: string | null
  ifc_type: string
}

export interface RuleViolation {
  guid: string
  name: string | null
  ifc_type: string
  actual: unknown
  expected: unknown
  related: ElementRef | null
  reason: string
  steps: string[]
  location?: number[] | null
}

export interface RuleResult {
  rule_id: string
  name: string
  category: string
  severity: string
  check_type: string
  reference?: string | null
  target_total: number
  violations: number
  truncated: boolean
  items: RuleViolation[]
}

export interface RulesResponse {
  path: string
  rules_run: number
  rules_passed: number
  rules_failed: number
  violations_total: number
  max_violations: number
  truncated: boolean
  rules: RuleResult[]
}

export interface KernelHealth {
  status: string
  service: string
  version: string
}

/** 统一请求封装：非 2xx 时抛出带内核 detail 的错误。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, init)
  } catch (err) {
    const error = new Error(`无法连接计算内核：${String(err)}`) as Error & { status: number }
    error.status = 503
    throw error
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? text
    } catch {
      /* 保留原始文本 */
    }
    const error = new Error(detail) as Error & { status: number }
    error.status = res.status
    throw error
  }
  return JSON.parse(text) as T
}

export function kernelHealth(): Promise<KernelHealth> {
  return request<KernelHealth>('/health')
}

export function runRules(path: string, ruleIds?: string[], rules?: unknown[], lang?: string): Promise<RulesResponse> {
  const body: Record<string, unknown> = { path }
  if (rules && rules.length) body.rules = rules
  else if (ruleIds && ruleIds.length) body.rule_ids = ruleIds
  if (lang === 'en') body.lang = 'en'
  return request<RulesResponse>('/rules/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export interface ValidateResponse {
  valid: boolean
  total: number
  rules: unknown[]
}

/** 校验规则定义（不需要模型）；不合法时内核返回 400，由 request 抛出可读错误。 */
export function validateRules(rules: unknown[]): Promise<ValidateResponse> {
  return request<ValidateResponse>('/rules/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules })
  })
}

export interface ClashMatrixRef {
  guid: string
  parent_guid?: string | null
  name: string | null
  ifc_type: string
  discipline: string
  discipline_name: string
}

export interface ClashMatrixItem {
  mode: 'hard' | 'gap' | 'clearance' | 'duplicate'
  cell: string
  a: ClashMatrixRef
  b: ClashMatrixRef
  distance: number | null
  contact_point: number[] | null
  triangle_pairs: number
  overlap: number | null
  merged: number
  related_guids: string[] | null
}

export interface ClashMatrixResponse {
  path: string
  totals: { hard: number; gap: number; clearance: number; duplicate: number; total: number }
  items: ClashMatrixItem[]
}

/** 冲突矩阵检测（报告口径：仅硬碰撞、忽略同专业，保持逐条清单）。 */
export function runClashMatrix(path: string, maxClashes = 500): Promise<ClashMatrixResponse> {
  return request<ClashMatrixResponse>('/clash/matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, hard: true, ignore_same_discipline: true, max_clashes: maxClashes })
  })
}

export interface ReportExportResponse {
  file: string
  name: string
  size: number
  format: string
  issues: number
}

/** 把统一问题清单交给内核渲染为 PDF / Excel 文件（M9）。 */
export function exportReport(
  report: unknown,
  format: 'pdf' | 'xlsx',
  title?: string,
  lang?: string
): Promise<ReportExportResponse> {
  const body: Record<string, unknown> = { report, format, title }
  if (lang === 'en') body.lang = 'en'
  return request<ReportExportResponse>('/report/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
