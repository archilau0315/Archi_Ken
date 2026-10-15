import { useState } from 'react'

import { useT } from '../i18n'
import { idsExample, idsParse, idsValidate } from '../services/kernel'
import type { IdsDocumentPreview, IdsEntityRef, IdsValidateResponse } from '../services/kernel'

// IDS 校验与编辑器（L4，M7）：编辑 / 载入 IDS XML，预览结构，对模型执行校验并查看报告。
// 校验由 L2 内核基于 buildingSMART IDS 标准（ifctester）完成。

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function percentText(value: number | string | undefined): string {
  if (value === undefined || value === null) return '—'
  return typeof value === 'number' ? `${value}%` : String(value)
}

interface Props {
  modelPath: string
  onSelect?: (guid: string) => void
  onClose: () => void
}

export default function IdsEditor({ modelPath, onSelect, onClose }: Props) {
  const { t } = useT()
  const [xml, setXml] = useState('')
  const [preview, setPreview] = useState<IdsDocumentPreview | null>(null)
  const [result, setResult] = useState<IdsValidateResponse | null>(null)
  const [hideSkipped, setHideSkipped] = useState(false)
  const [busy, setBusy] = useState<'' | 'example' | 'parse' | 'validate'>('')
  const [error, setError] = useState('')

  async function loadExample(): Promise<void> {
    setBusy('example')
    setError('')
    try {
      const data = await idsExample()
      setXml(data.xml)
      setPreview(data.spec)
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function parse(): Promise<void> {
    if (!xml.trim()) {
      setError(t('ids.errNoXml'))
      return
    }
    setBusy('parse')
    setError('')
    try {
      const data = await idsParse(xml)
      setXml(data.xml)
      setPreview(data.spec)
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function validate(): Promise<void> {
    if (!modelPath) {
      setError(t('ids.errNoModel'))
      return
    }
    if (!xml.trim()) {
      setError(t('ids.errNoXml'))
      return
    }
    setBusy('validate')
    setError('')
    try {
      setResult(await idsValidate(modelPath, xml, { hideSkipped }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  function exportXml(): void {
    if (!xml.trim()) return
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'archiken.ids'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="editor-overlay">
      <div className="editor-dialog">
        <header className="editor-top">
          <strong>{t('ids.title')}</strong>
          <span className="tagline">{t('ids.tagline')}</span>
          <button className="ghost tiny" onClick={onClose}>
            {t('ids.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}

        <div className="ids-tools">
          <button className="ghost" onClick={() => void loadExample()} disabled={busy !== ''}>
            {busy === 'example' ? t('ids.loadingExample') : t('ids.loadExample')}
          </button>
          <button className="ghost" onClick={() => void parse()} disabled={busy !== ''}>
            {busy === 'parse' ? t('ids.parsing') : t('ids.parsePreview')}
          </button>
          <button className="ghost" onClick={exportXml} disabled={!xml.trim()}>
            {t('ids.exportXml')}
          </button>
          <label className="clash-toggle">
            <input type="checkbox" checked={hideSkipped} onChange={(e) => setHideSkipped(e.target.checked)} />
            {t('ids.hideSkipped')}
          </label>
          <button onClick={() => void validate()} disabled={busy !== ''}>
            {busy === 'validate' ? t('ids.validating') : t('ids.runValidate')}
          </button>
        </div>

        <div className="ids-body">
          <div className="ids-editor">
            <h3 className="clash-sub">{t('ids.definition')}</h3>
            <textarea
              className="ids-xml"
              value={xml}
              spellCheck={false}
              placeholder={t('ids.placeholder')}
              onChange={(e) => setXml(e.target.value)}
            />
          </div>

          <div className="ids-side">
            <h3 className="clash-sub">{t('ids.previewTitle')}</h3>
            {preview ? (
              <div className="ids-preview">
                <p className="hint small">
                  {String(preview.info.title ?? t('ids.untitledIds'))} · {t('ids.specCount', { n: preview.specification_count })}
                </p>
                <ul className="ids-specs">
                  {preview.specifications.map((spec, index) => (
                    <li key={`${spec.name}-${index}`}>
                      <div className="ids-spec-head">
                        <span className="issue-title">{spec.name || t('ids.specFallback', { n: index + 1 })}</span>
                        <span className="issue-cat">{spec.cardinality}</span>
                      </div>
                      {spec.description && <p className="ids-desc">{spec.description}</p>}
                      <p className="ids-facet">
                        {t('ids.applicability', { list: spec.applicability.map((facet) => facet.description).join('；') || '—' })}
                      </p>
                      <ul className="ids-reqs">
                        {spec.requirements.map((facet, reqIndex) => (
                          <li key={reqIndex}>
                            <span className="ids-req-type">{facet.facet_type}</span>
                            {facet.description}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="hint">{t('ids.previewHint')}</p>
            )}
          </div>
        </div>

        <div className="ids-result">
          <h3 className="clash-sub">
            {t('ids.reportTitle')}
            {result && (
              <span className={`ids-status ${result.status ? 'pass' : 'fail'}`}>
                {result.status ? t('ids.allPass') : t('ids.hasFail')}
              </span>
            )}
          </h3>
          {!result ? (
            <p className="hint">{t('ids.reportHint')}</p>
          ) : (
            <>
              <div className="chips">
                <span className="chip">{t('ids.chipSpecs', { n: result.totals.total_specifications })}</span>
                <span className="chip error">{t('ids.chipSpecsFail', { n: result.totals.total_specifications_fail })}</span>
                <span className="chip warning">{t('ids.chipReqsFail', { n: result.totals.total_requirements_fail })}</span>
                <span className="chip">{t('ids.chipChecks', { n: result.totals.total_checks })}</span>
                <span className="chip info">{t('ids.chipPassRate', { rate: percentText(result.totals.percent_checks_pass) })}</span>
              </div>

              <ul className="ids-results">
                {result.specifications.map((spec, index) => (
                  <li key={`${spec.name}-${index}`} className={`ids-result-spec ${spec.status ? 'pass' : 'fail'}`}>
                    <div className="issue-head">
                      <span className={`dot ${spec.status ? 'info' : 'error'}`} />
                      <span className="issue-title">{spec.name || t('ids.specFallback', { n: index + 1 })}</span>
                      <span className="issue-cat">
                        {t('ids.specSummary', { n: spec.applicable_total, pass: spec.total_checks_pass, total: spec.total_checks })}
                      </span>
                    </div>
                    {spec.requirements.map((req, reqIndex) => (
                      <div key={reqIndex} className={`ids-req ${req.status ? 'pass' : 'fail'}`}>
                        <span className={`dot ${req.status ? 'info' : 'error'}`} />
                        <span className="ids-req-type">{req.facet_type}</span>
                        <span className="ids-req-desc">{req.description}</span>
                        <span className="ids-req-count">
                          {t('ids.reqPass', { pass: req.total_pass, total: req.total_applicable })}
                        </span>
                        {req.failed_entities.length > 0 && (
                          <ul className="ids-entities">
                            {req.failed_entities.map((entity: IdsEntityRef, entityIndex) => (
                              <li
                                key={`${entity.guid}-${entityIndex}`}
                                onClick={() => entity.guid && onSelect?.(entity.guid)}
                                title={entity.reason || ''}
                              >
                                {entity.name || entity.guid || t('ids.noGuid')}
                                <span className="ids-entity-type">{entity.ifc_type}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
                {!result.specifications.length && <p className="hint">{t('ids.noSpecs')}</p>}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
