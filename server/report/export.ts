import { exportReport, runClash, runRules } from '../kernel-client'
import { buildReport } from './aggregate'

// 报告导出编排（M9）：汇总「规则 + 碰撞」问题清单 → 内核渲染为 PDF / Excel 文件。

export type ExportFormat = 'pdf' | 'xlsx'

export interface ReportExportResult {
  file: string
  name: string
  size: number
  format: string
  issues: number
}

/** 生成报告并导出为指定格式文件。 */
export async function exportReportFile(
  path: string,
  format: ExportFormat,
  ruleIds?: string[],
  includeClash = true,
  title?: string,
  lang?: string
): Promise<ReportExportResult> {
  const rules = await runRules(path, ruleIds, undefined, lang)
  const clash = includeClash ? await runClash(path) : null
  const report = buildReport(path, rules, clash, lang)
  return exportReport(report, format, title, lang)
}
