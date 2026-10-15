// 业务服务客户端（L4 → L3）：结果与报告服务的类型化封装。

import type { ElementRef } from './kernel'
import { apiRequest } from './transport'

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  source: 'rule' | 'clash'
  severity: Severity
  category: string
  title: string
  element: ElementRef
  related: ElementRef | null
  location: number[] | null
  actual: unknown
  expected: unknown
  reason: string
  steps: string[]
}

export interface ReportSummary {
  total: number
  by_severity: Record<string, number>
  by_category: Record<string, number>
  by_source: Record<string, number>
  rules_run: number
  rules_failed: number
  clashes: number
}

export interface Report {
  model_path: string
  generated_at: string
  summary: ReportSummary
  issues: Issue[]
}

export interface ReportRunOptions {
  ruleIds?: string[]
  includeClash?: boolean
  /** 界面语言：zh（默认）/ en，用于服务端返回文案的语言。 */
  lang?: 'zh' | 'en'
}

/** 生成问题清单（规则 + 碰撞汇总）。 */
export function reportRun(path: string, options: ReportRunOptions = {}): Promise<Report> {
  return apiRequest<Report>({
    target: 'server',
    method: 'POST',
    path: '/report/run',
    body: { path, rule_ids: options.ruleIds, include_clash: options.includeClash ?? true, lang: options.lang }
  })
}

/** 生成 HTML 报告（返回 HTML 文本，供新窗口预览）。 */
export function reportHtml(path: string, options: ReportRunOptions = {}): Promise<string> {
  return apiRequest<string>({
    target: 'server',
    method: 'GET',
    path: '/report/html',
    query: {
      path,
      rule_ids: options.ruleIds?.join(','),
      include_clash: options.includeClash ?? true,
      lang: options.lang
    }
  })
}

export interface ReportExportResult {
  file: string
  name: string
  size: number
  format: string
  issues: number
}

/** 生成报告并导出为 PDF / Excel 文件（M9），返回导出文件信息。 */
export function reportExport(
  path: string,
  format: 'pdf' | 'xlsx',
  options: ReportRunOptions = {}
): Promise<ReportExportResult> {
  return apiRequest<ReportExportResult>({
    target: 'server',
    method: 'POST',
    path: '/report/export',
    body: { path, format, rule_ids: options.ruleIds, include_clash: options.includeClash ?? true, lang: options.lang }
  })
}
