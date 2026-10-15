import { useState } from 'react'

import { useT } from '../i18n'
import { clashMatrix } from '../services/kernel'
import type { ClashMatrixResponse, ClashMode } from '../services/kernel'

// 冲突矩阵与碰撞分类（L4，M4）：按专业两两对检，支持硬 / 间隙 / 净空三类，
// 可配置容差与「忽略同专业」，运行后展示专业矩阵与问题清单。

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface Props {
  modelPath: string
  onSelect?: (guid: string) => void
  onClose: () => void
}

export default function ClashMatrix({ modelPath, onSelect, onClose }: Props) {
  const { t, lang } = useT()
  const [hard, setHard] = useState(true)
  const [gapOn, setGapOn] = useState(false)
  const [gapMm, setGapMm] = useState(50)
  const [clearanceOn, setClearanceOn] = useState(false)
  const [clearanceMm, setClearanceMm] = useState(100)
  const [ignoreSame, setIgnoreSame] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClashMatrixResponse | null>(null)

  async function run(): Promise<void> {
    if (!modelPath) {
      setError(t('clash.errorNoModel'))
      return
    }
    if (!hard && !gapOn && !clearanceOn) {
      setError(t('clash.errorNoCategory'))
      return
    }
    setBusy(true)
    setError('')
    try {
      setResult(
        await clashMatrix(modelPath, {
          hard,
          gapMm: gapOn ? gapMm : null,
          clearanceMm: clearanceOn ? clearanceMm : null,
          ignoreSameDiscipline: ignoreSame,
          maxClashes: 300,
          lang
        })
      )
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy(false)
    }
  }

  const disciplines = result?.disciplines ?? []
  const cellMap = new Map((result?.cells ?? []).map((cell) => [cell.key, cell]))
  const cellKey = (i: number, j: number): string =>
    i <= j ? `${disciplines[i].key}|${disciplines[j].key}` : `${disciplines[j].key}|${disciplines[i].key}`
  const modeLabel = (mode: ClashMode): string => t(`clash.mode.${mode}`)

  return (
    <div className="editor-overlay">
      <div className="editor-dialog">
        <header className="editor-top">
          <strong>{t('clash.title')}</strong>
          <span className="tagline">{t('clash.tagline')}</span>
          <button className="ghost tiny" onClick={onClose}>
            {t('clash.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}

        <div className="clash-tools">
          <label className="clash-toggle">
            <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} />
            {t('clash.hardToggle')}
          </label>
          <label className="clash-toggle">
            <input type="checkbox" checked={gapOn} onChange={(e) => setGapOn(e.target.checked)} />
            {t('clash.gapTolerance')}
            <input
              type="number"
              className="clash-num"
              value={gapMm}
              min={0}
              disabled={!gapOn}
              onChange={(e) => setGapMm(Number(e.target.value))}
            />
            mm
          </label>
          <label className="clash-toggle">
            <input type="checkbox" checked={clearanceOn} onChange={(e) => setClearanceOn(e.target.checked)} />
            {t('clash.clearanceRequirement')}
            <input
              type="number"
              className="clash-num"
              value={clearanceMm}
              min={0}
              disabled={!clearanceOn}
              onChange={(e) => setClearanceMm(Number(e.target.value))}
            />
            mm
          </label>
          <label className="clash-toggle">
            <input type="checkbox" checked={ignoreSame} onChange={(e) => setIgnoreSame(e.target.checked)} />
            {t('clash.ignoreSame')}
          </label>
          <button onClick={() => void run()} disabled={busy}>
            {busy ? t('clash.running') : t('clash.run')}
          </button>
        </div>

        <div className="clash-body">
          {!result ? (
            <p className="hint">{t('clash.hintSetup')}</p>
          ) : (
            <>
              <div className="chips">
                <span className="chip">{t('clash.totalItems', { n: result.totals.total })}</span>
                <span className="chip error">{t('clash.chipHard', { n: result.totals.hard })}</span>
                <span className="chip warning">{t('clash.chipGap', { n: result.totals.gap })}</span>
                <span className="chip info">{t('clash.chipClearance', { n: result.totals.clearance })}</span>
                <span className="chip">{t('clash.chipPairs', { n: result.candidate_pairs })}</span>
                <span className="chip">{t('clash.chipIgnored', { n: result.ignored })}</span>
              </div>

              {disciplines.length ? (
                <table className="clash-matrix">
                  <thead>
                    <tr>
                      <th />
                      {disciplines.map((disc) => (
                        <th key={disc.key} style={{ color: disc.color }}>
                          {disc.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {disciplines.map((row, i) => (
                      <tr key={row.key}>
                        <th style={{ color: row.color }}>{row.name}</th>
                        {disciplines.map((_, j) => {
                          const cell = cellMap.get(cellKey(i, j))
                          return (
                            <td key={j} className={cell ? 'hit' : ''} title={cell ? cell.key : ''}>
                              {cell ? (
                                <>
                                  <span className="cell-total">{cell.total}</span>
                                  <span className="cell-detail">
                                    {cell.hard ? `${t('clash.cellHard', { n: cell.hard })} ` : ''}
                                    {cell.gap ? `${t('clash.cellGap', { n: cell.gap })} ` : ''}
                                    {cell.clearance ? t('clash.cellClearance', { n: cell.clearance }) : ''}
                                  </span>
                                </>
                              ) : (
                                <span className="cell-empty">·</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">{t('clash.hintNoDisciplines')}</p>
              )}

              <h3 className="clash-sub">{t('clash.issueList', { n: result.items.length })}</h3>
              <ul className="issues">
                {result.items.map((item, index) => {
                  const metric =
                    item.mode === 'hard'
                      ? t('clash.metricHard', { n: item.triangle_pairs })
                      : t('clash.metricDistance', { d: item.distance ?? '' })
                  return (
                    <li
                      key={`${item.cell}-${item.a.guid}-${item.b.guid}-${index}`}
                      className={`issue clash-${item.mode}`}
                      onClick={() => onSelect?.(item.a.guid)}
                    >
                      <div className="issue-head">
                        <span className={`dot ${item.mode}`} />
                        <span className="issue-title">{modeLabel(item.mode)}</span>
                        <span className="issue-cat">
                          {item.a.discipline_name} × {item.b.discipline_name}
                        </span>
                      </div>
                      <p className="issue-reason">
                        {item.a.name || item.a.guid} ↔ {item.b.name || item.b.guid}
                      </p>
                      <p className="issue-elem">{metric}</p>
                    </li>
                  )
                })}
                {!result.items.length && <p className="hint">{t('clash.noClashes')}</p>}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
