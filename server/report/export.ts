import { exportReport, runClashMatrix, runRules } from '../kernel-client'
import { getStatuses } from '../clash/store'
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
  if (!includeClash) {
    const reportOnly = buildReport(path, rules, null, {}, lang)
    return exportReport(reportOnly, format, title, lang)
  }
  // 碰撞采用冲突矩阵口径（与碰撞面板一致），用户标记「已忽略」的碰撞不进报告。
  const [clash, statuses] = await Promise.all([runClashMatrix(path), getStatuses(path)])
  const report = buildReport(path, rules, clash, statuses, lang)
  return exportReport(report, format, title, lang)
}
