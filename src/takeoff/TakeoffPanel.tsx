import { useEffect, useState } from 'react'

import { useT } from '../i18n'
import { takeoffColumns, takeoffExport, takeoffRun } from '../services/kernel'
import type { TakeoffColumn, TakeoffColumnsResponse, TakeoffRunResponse } from '../services/kernel'

// 信息提取面板（L4，M6）：编辑自定义计算列（受控表达式），运行 ITO 提取查看
// 逐构件结果与合计，并可导出 Excel。提取与求值由 L2 内核完成。

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface Props {
  modelPath: string
  onClose: () => void
}

let nextDraftId = 1

export default function TakeoffPanel({ modelPath, onClose }: Props) {
  const { t, lang } = useT()
  const [info, setInfo] = useState<TakeoffColumnsResponse | null>(null)
  const [columns, setColumns] = useState<TakeoffColumn[]>([])
  const [draft, setDraft] = useState({ key: '', name: '', expr: '' })
  const [result, setResult] = useState<TakeoffRunResponse | null>(null)
  const [exportedFile, setExportedFile] = useState('')
  const [busy, setBusy] = useState<'' | 'run' | 'export'>('')
  const [error, setError] = useState('')

  useEffect(() => {
    takeoffColumns(lang)
      .then(setInfo)
      .catch((err) => setError(makeError(err)))
  }, [lang])

  function addColumn(column: TakeoffColumn): void {
    if (columns.some((item) => item.key === column.key)) {
      setError(t('takeoff.keyExists', { key: column.key }))
      return
    }
    setColumns([...columns, column])
    setError('')
  }

  function removeColumn(key: string): void {
    setColumns(columns.filter((item) => item.key !== key))
  }

  function addDraft(): void {
    const key = draft.key.trim()
    const expr = draft.expr.trim()
    if (!key || !expr) {
      setError(t('takeoff.keyExprRequired'))
      return
    }
    addColumn({ key, name: draft.name.trim() || key, expr })
    setDraft({ key: '', name: '', expr: '' })
  }

  async function run(): Promise<void> {
    setBusy('run')
    setError('')
    setExportedFile('')
    try {
      setResult(await takeoffRun(modelPath, columns.length ? columns : undefined, 500, lang))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function exportXlsx(): Promise<void> {
    setBusy('export')
    setError('')
    try {
      const data = await takeoffExport(modelPath, columns.length ? columns : undefined, lang)
      setExportedFile(data.file)
      if (result === null) setResult(await takeoffRun(modelPath, columns.length ? columns : undefined, 500, lang))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  const valueKeys = result?.columns.map((item) => item.key) ?? []

  return (
    <div className="editor-overlay">
      <div className="editor-dialog takeoff-dialog">
        <header className="editor-top">
          <strong>{t('takeoff.title')}</strong>
          <span className="tagline">{t('takeoff.tagline')}</span>
          <button className="ghost" onClick={onClose}>
            {t('takeoff.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}

        <section className="takeoff-section">
          <h3>{t('takeoff.fixedFields')}</h3>
          <p className="hint small">
            {(info?.fixed ?? []).map((item) => `${item.name}(${item.key})`).join(' · ') || '—'}
          </p>

          <h3>{t('takeoff.customColumns')}</h3>
          <ul className="takeoff-columns">
            {columns.map((item) => (
              <li key={item.key}>
                <span className="col-name">{item.name}</span>
                <code>{item.expr}</code>
                <button className="ghost small" onClick={() => removeColumn(item.key)}>
                  {t('takeoff.remove')}
                </button>
              </li>
            ))}
            {!columns.length && <li className="hint small">{t('takeoff.noCustomColumns')}</li>}
          </ul>

          <div className="takeoff-add">
            <input
              placeholder={t('takeoff.phKey')}
              value={draft.key}
              onChange={(event) => setDraft({ ...draft, key: event.target.value })}
            />
            <input
              placeholder={t('takeoff.phName')}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <input
              className="expr"
              placeholder={t('takeoff.phExpr')}
              value={draft.expr}
              onChange={(event) => setDraft({ ...draft, expr: event.target.value })}
            />
            <button className="ghost" onClick={addDraft}>
              {t('takeoff.add')}
            </button>
          </div>

          <div className="takeoff-suggested">
            {(info?.suggested ?? []).map((item) => (
              <button key={item.key} className="chip-btn" onClick={() => addColumn(item)}>
                + {item.name}
              </button>
            ))}
          </div>

          <details className="takeoff-functions">
            <summary>{t('takeoff.functionsSyntax')}</summary>
            <ul>
              {(info?.functions ?? []).map((item) => (
                <li key={item.name}>
                  <code>{item.name}</code>
                  <span>{item.desc}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <div className="editor-actions">
          <button onClick={run} disabled={busy !== '' || !modelPath}>
            {busy === 'run' ? t('takeoff.running') : t('takeoff.run')}
          </button>
          <button className="ghost" onClick={exportXlsx} disabled={busy !== '' || !modelPath}>
            {busy === 'export' ? t('takeoff.exporting') : t('takeoff.export')}
          </button>
          {exportedFile && <span className="hint small">{t('takeoff.exported', { file: exportedFile })}</span>}
        </div>

        {result && (
          <section className="takeoff-section">
            <h3>
              {t('takeoff.results')}
              <span className="hint small">
                {t('takeoff.resultMeta', {
                  total: result.total,
                  truncated: result.truncated ? t('takeoff.truncated') : '',
                  errors: result.expression_errors,
                  cache: result.cache_hit ? t('takeoff.cacheHit') : t('takeoff.cacheMiss'),
                })}
              </span>
            </h3>
            <div className="takeoff-table-wrap">
              <table className="takeoff-table">
                <thead>
                  <tr>
                    <th>{t('takeoff.thName')}</th>
                    <th>{t('takeoff.thIfcType')}</th>
                    <th>{t('takeoff.thContainer')}</th>
                    {result.columns.map((item) => (
                      <th key={item.key}>{item.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.guid}>
                      <td>{row.name || t('takeoff.unnamed')}</td>
                      <td>{row.ifc_type}</td>
                      <td>{row.container || '—'}</td>
                      {valueKeys.map((key) => (
                        <td key={key}>{formatCell(row.values[key], t)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('takeoff.total')}</td>
                    <td />
                    <td />
                    {valueKeys.map((key) => (
                      <td key={key}>{formatCell(result.totals[key], t)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function formatCell(value: unknown, t: (key: string) => string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6)
  if (typeof value === 'boolean') return value ? t('takeoff.yes') : t('takeoff.no')
  return String(value)
}
