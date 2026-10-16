import type { Issue, Report } from './aggregate'

// 报告渲染 v1：把问题清单渲染为自包含 HTML（内联 CSS，无外部依赖）。

const I18N = {
  zh: {
    severity: { error: '错误', warning: '警告', info: '提示' } as Record<string, string>,
    title: 'ArchiKen 模型检查报告',
    model: '模型',
    generatedAt: '生成时间',
    total: '问题总数',
    error: '错误',
    warning: '警告',
    info: '提示',
    clash: '硬碰撞',
    failed: '未通过规则',
    headers: ['级别', '分类 / 规则', '构件', '关联构件', '原因（含判定链）', '位置'],
    reference: '依据',
    empty: '未发现问题：所有检查均通过。'
  },
  en: {
    severity: { error: 'Error', warning: 'Warning', info: 'Info' } as Record<string, string>,
    title: 'ArchiKen Model Check Report',
    model: 'Model',
    generatedAt: 'Generated at',
    total: 'Total Issues',
    error: 'Errors',
    warning: 'Warnings',
    info: 'Infos',
    clash: 'Hard Clashes',
    failed: 'Failed Rules',
    headers: ['Severity', 'Category / Rule', 'Element', 'Related Element', 'Reason (with decision chain)', 'Location'],
    reference: 'Reference',
    empty: 'No issues found: all checks passed.'
  }
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v)).join(', ')
  if (typeof value === 'number') return String(Number(value.toFixed(3)))
  return esc(value)
}

function issueRow(issue: Issue, txt: typeof I18N.zh): string {
  const related = issue.related
    ? `${issue.related.name ?? issue.related.guid}<span class="muted">（${esc(issue.related.ifc_type)}）</span>`
    : '—'
  const location = issue.location ? issue.location.map((v) => Number(v.toFixed(3))).join(', ') : '—'
  const steps = issue.steps.map((step) => `<li>${esc(step)}</li>`).join('')
  return `<tr>
    <td><span class="badge ${esc(issue.severity)}">${esc(txt.severity[issue.severity] ?? issue.severity)}</span></td>
    <td>${esc(issue.category)}<div class="muted">${esc(issue.title)}</div>${issue.reference ? `<div class="muted">${esc(txt.reference)}：${esc(issue.reference)}</div>` : ''}</td>
    <td>${esc(issue.element.name ?? issue.element.guid)}<span class="muted">（${esc(issue.element.ifc_type)}）</span></td>
    <td>${related}</td>
    <td>${esc(issue.reason)}<ul class="steps">${steps}</ul></td>
    <td class="mono">${esc(location)}</td>
  </tr>`
}

function stat(label: string, value: number): string {
  return `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${esc(label)}</div></div>`
}

export function renderReportHtml(report: Report, lang: string = 'zh'): string {
  const txt = I18N[lang === 'en' ? 'en' : 'zh']
  const severity = report.summary.by_severity
  const rows = report.issues.map((i) => issueRow(i, txt)).join('\n')
  return `<!DOCTYPE html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}">
<head>
<meta charset="utf-8" />
<title>${esc(txt.title)}</title>
<style>
  :root { --line: #e4e7ec; --muted: #6b7280; --error: #d92d20; --warning: #dc6803; --info: #1570ef; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 32px 16px; color: #1f2937; background: #f3f4f6; }
  .page { max-width: 1200px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(16,24,40,.08); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .stats { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; }
  .stat-value { font-size: 24px; font-weight: 600; }
  .stat-label { color: var(--muted); font-size: 12px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  .muted { color: var(--muted); font-size: 12px; }
  .mono { font-family: Consolas, monospace; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 12px; }
  .badge.error { background: var(--error); } .badge.warning { background: var(--warning); } .badge.info { background: var(--info); }
  .steps { margin: 6px 0 0; padding-left: 16px; color: var(--muted); }
</style>
</head>
<body>
  <div class="page">
  <h1>${esc(txt.title)}</h1>
  <div class="meta">${esc(txt.model)}：${esc(report.model_path)}<br />${esc(txt.generatedAt)}：${esc(report.generated_at)}</div>
  <div class="stats">
    ${stat(txt.total, report.summary.total)}
    ${stat(txt.error, severity.error ?? 0)}
    ${stat(txt.warning, severity.warning ?? 0)}
    ${stat(txt.info, severity.info ?? 0)}
    ${stat(txt.clash, report.summary.clashes)}
    ${stat(txt.failed, report.summary.rules_failed)}
  </div>
  <table>
    <thead><tr>${txt.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  </div>
</body>
</html>`
}
