import { useCallback, useEffect, useState } from 'react'

import { useT } from '../i18n'
import { reportExport, reportHtml, reportRun } from '../services/report'
import type { Issue, Report } from '../services/report'

// 报告面板（L4，M9）：摘要统计 + 问题清单预览 + 三种导出（HTML 预览 / PDF / Excel）。
// 数据由 L3 业务服务提供（/report/*），导出文件落在 .data/exports/。

interface Props {
  modelPath: string
  onSelect: (guid: string) => void
  onClose: () => void
}

const PREVIEW_LIMIT = 100

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function fmtLocation(location: number[] | null): string {
  if (!location || !location.length) return '—'
  return location.slice(0, 3).map((v) => Number(v.toFixed(3))).join(', ')
}

function fmtSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export default function ReportPanel({ modelPath, onSelect, onClose }: Props) {
  const { t, lang } = useT()
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const run = useCallback(async (): Promise<void> => {
    if (!modelPath) return
    setBusy('run')
    setError('')
    try {
      setReport(await reportRun(modelPath, { lang }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }, [modelPath, lang])

  useEffect(() => {
    void run()
  }, [run])

  async function previewHtml(): Promise<void> {
    setBusy('html')
    setError('')
    setMessage('')
    try {
      const html = await reportHtml(modelPath, { lang })
      const preview = window.open('', '_blank')
      if (preview) {
        preview.document.write(html)
        preview.document.close()
      }
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function exportFile(format: 'pdf' | 'xlsx'): Promise<void> {
    setBusy(format)
    setError('')
    setMessage('')
    try {
      const res = await reportExport(modelPath, format, { lang })
      setMessage(
        t('report.exported', { format: format.toUpperCase(), n: res.issues, size: fmtSize(res.size), file: res.file })
      )
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  // 枚举值转显示文案：未知值回退原始字符串
  function enumLabel(prefix: string, value: string): string {
    const key = `${prefix}.${value}`
    const text = t(key)
    return text === key ? value : text
  }

  function issueRow(issue: Issue) {
    return (
      <tr key={issue.id}>
        <td>
          <span className={`badge sev-${issue.severity}`}>{enumLabel('report.severity', issue.severity)}</span>
        </td>
        <td>
          {issue.category}
          <div className="report-muted">{issue.title}</div>
          {issue.reference && <div className="report-muted">{issue.reference}</div>}
        </td>
        <td>
          <a className="report-link" onClick={() => onSelect(issue.element.guid)}>
            {issue.element.name ?? issue.element.guid}
          </a>
          <span className="report-muted">（{issue.element.ifc_type}）</span>
        </td>
        <td>{issue.related ? `${issue.related.name ?? issue.related.guid}（${issue.related.ifc_type}）` : '—'}</td>
        <td>
          {issue.reason}
          {issue.steps.length > 0 && (
            <ul className="report-steps">
              {issue.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          )}
        </td>
        <td className="report-mono">{fmtLocation(issue.location)}</td>
        <td>{enumLabel('report.source', issue.source)}</td>
      </tr>
    )
  }

  const summary = report?.summary
  const issues = report?.issues ?? []

  return (
    <div className="editor-overlay">
      <div className="editor-dialog report-dialog">
        <header className="editor-top">
          <strong>{t('report.title')}</strong>
          <span className="tagline">{t('report.tagline')}</span>
          <button className="ghost" onClick={onClose}>
            {t('report.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}

        <div className="report-toolbar">
          <button onClick={() => void run()} disabled={busy !== '' || !modelPath}>
            {busy === 'run' ? t('report.running') : t('report.regenerate')}
          </button>
          <button className="ghost" onClick={previewHtml} disabled={busy !== '' || !modelPath}>
            {busy === 'html' ? t('report.running') : t('report.previewHtml')}
          </button>
          <button className="ghost" onClick={() => void exportFile('pdf')} disabled={busy !== '' || !modelPath}>
            {busy === 'pdf' ? t('report.exporting') : t('report.exportPdf')}
          </button>
          <button className="ghost" onClick={() => void exportFile('xlsx')} disabled={busy !== '' || !modelPath}>
            {busy === 'xlsx' ? t('report.exporting') : t('report.exportExcel')}
          </button>
        </div>

        {message && <p className="report-message">{message}</p>}

        {summary && (
          <div className="report-stats">
            <div className="report-stat">
              <div className="report-stat-value">{summary.total}</div>
              <div className="report-stat-label">{t('report.stat.total')}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-value sev-error-text">{summary.by_severity.error ?? 0}</div>
              <div className="report-stat-label">{t('report.severity.error')}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-value sev-warning-text">{summary.by_severity.warning ?? 0}</div>
              <div className="report-stat-label">{t('report.severity.warning')}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-value sev-info-text">{summary.by_severity.info ?? 0}</div>
              <div className="report-stat-label">{t('report.severity.info')}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-value">{summary.clashes}</div>
              <div className="report-stat-label">{t('report.stat.clashes')}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-value">
                {summary.rules_failed}/{summary.rules_run}
              </div>
              <div className="report-stat-label">{t('report.stat.rules')}</div>
            </div>
          </div>
        )}

        {report && (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>{t('report.col.severity')}</th>
                  <th>{t('report.col.category')}</th>
                  <th>{t('report.col.element')}</th>
                  <th>{t('report.col.related')}</th>
                  <th>{t('report.col.reason')}</th>
                  <th>{t('report.col.location')}</th>
                  <th>{t('report.col.source')}</th>
                </tr>
              </thead>
              <tbody>
                {issues.slice(0, PREVIEW_LIMIT).map(issueRow)}
                {!issues.length && (
                  <tr>
                    <td colSpan={7} className="report-muted">
                      {t('report.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {issues.length > PREVIEW_LIMIT && (
              <p className="report-muted report-more">{t('report.previewMore', { n: PREVIEW_LIMIT })}</p>
            )}
          </div>
        )}
        {!report && busy === 'run' && <p className="report-muted">{t('report.loading')}</p>}
      </div>
    </div>
  )
}
