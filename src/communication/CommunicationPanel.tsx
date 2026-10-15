import { useCallback, useEffect, useState } from 'react'

import {
  issueBcfExport,
  issueComment,
  issueCreate,
  issueDelete,
  issuesGet,
  issuesImport,
  issuesList,
  issueSnapshot,
  issueUpdate
} from '../services/issues'
import type { CommIssue, CommIssueSummary, IssueSeverity, IssueStatus } from '../services/issues'
import { useT } from '../i18n'
import IssueDetail from './IssueDetail'

// 沟通面板（L4，M8）：问题清单、生命周期、评论、视图快照与 BCF 2.1 导出。
// 数据由 L3 业务服务提供（/issues/*），快照取自 3D 视图当前视角。

interface SelectedElement {
  guid: string
  name: string | null
  ifc_type: string
}

interface Props {
  modelPath: string
  selected: SelectedElement | null
  captureView: () => string | null
  onSelect: (guid: string) => void
  onClose: () => void
}

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export default function CommunicationPanel({ modelPath, selected, captureView, onSelect, onClose }: Props) {
  const { t, lang } = useT()
  const [list, setList] = useState<CommIssueSummary[]>([])
  const [filterStatus, setFilterStatus] = useState<'' | IssueStatus>('')
  const [filterSeverity, setFilterSeverity] = useState<'' | IssueSeverity>('')
  const [detail, setDetail] = useState<CommIssue | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    severity: 'warning' as IssueSeverity,
    category: t('comm.defaultCategory'),
    linkSelected: true
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await issuesList({
        status: filterStatus || undefined,
        severity: filterSeverity || undefined
      })
      setList(res.items)
    } catch (err) {
      setError(makeError(err))
    }
  }, [filterStatus, filterSeverity])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** 操作后同步：刷新列表并重取详情。 */
  async function afterChange(id: string): Promise<void> {
    await refresh()
    try {
      setDetail(await issuesGet(id))
    } catch {
      setDetail(null)
    }
  }

  async function openDetail(id: string): Promise<void> {
    setError('')
    try {
      setDetail(await issuesGet(id))
    } catch (err) {
      setError(makeError(err))
    }
  }

  async function runImport(): Promise<void> {
    setBusy('import')
    setError('')
    setMessage('')
    try {
      const res = await issuesImport(modelPath)
      setMessage(t('comm.msg.imported', { created: res.created, skipped: res.skipped, total: res.total }))
      await refresh()
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function exportBcf(): Promise<void> {
    setBusy('export')
    setError('')
    setMessage('')
    try {
      const res = await issueBcfExport(undefined, lang)
      setMessage(t('comm.msg.exported', { topics: res.topics, path: res.path }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function createIssue(): Promise<void> {
    if (!draft.title.trim()) {
      setError(t('comm.error.noTitle'))
      return
    }
    setBusy('create')
    setError('')
    setMessage('')
    try {
      const created = await issueCreate({
        title: draft.title.trim(),
        description: draft.description.trim(),
        severity: draft.severity,
        category: draft.category.trim() || t('comm.defaultCategory'),
        source: 'manual',
        model_path: modelPath,
        element: draft.linkSelected && selected ? selected : null
      }, lang)
      setDraft({ ...draft, title: '', description: '' })
      setCreating(false)
      setMessage(t('comm.msg.created', { title: created.title }))
      await refresh()
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function attachSnapshot(id: string): Promise<void> {
    const dataUrl = captureView()
    if (!dataUrl) {
      setError(t('comm.error.noSnapshot'))
      return
    }
    setError('')
    try {
      await issueSnapshot(id, dataUrl)
      setMessage(t('comm.msg.snapshot'))
      await afterChange(id)
    } catch (err) {
      setError(makeError(err))
    }
  }

  async function patchIssue(id: string, patch: Partial<Pick<CommIssue, 'status' | 'severity'>>): Promise<void> {
    setError('')
    try {
      await issueUpdate(id, patch)
      await afterChange(id)
    } catch (err) {
      setError(makeError(err))
    }
  }

  async function commentOn(id: string, text: string): Promise<void> {
    setError('')
    try {
      await issueComment(id, text, undefined, lang)
      await afterChange(id)
    } catch (err) {
      setError(makeError(err))
    }
  }

  async function removeIssue(id: string): Promise<void> {
    setError('')
    try {
      await issueDelete(id)
      if (detail?.id === id) setDetail(null)
      await refresh()
    } catch (err) {
      setError(makeError(err))
    }
  }

  return (
    <div className="editor-overlay">
      <div className="editor-dialog comm-dialog">
        <header className="editor-top">
          <strong>{t('comm.title')}</strong>
          <span className="tagline">{t('comm.tagline')}</span>
          <button className="ghost" onClick={onClose}>
            {t('comm.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}

        <div className="comm-toolbar">
          <button onClick={runImport} disabled={busy !== '' || !modelPath}>
            {busy === 'import' ? t('comm.import.busy') : t('comm.import')}
          </button>
          <button className="ghost" onClick={exportBcf} disabled={busy !== ''}>
            {busy === 'export' ? t('comm.export.busy') : t('comm.export')}
          </button>
          <button className="ghost" onClick={() => setCreating(!creating)}>
            {creating ? t('comm.collapseForm') : t('comm.newIssue')}
          </button>
          <div className="comm-filters">
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as '' | IssueStatus)}>
              <option value="">{t('comm.filter.allStatus')}</option>
              <option value="open">{t('comm.status.open')}</option>
              <option value="acknowledged">{t('comm.status.acknowledged')}</option>
              <option value="resolved">{t('comm.status.resolved')}</option>
            </select>
            <select value={filterSeverity} onChange={(event) => setFilterSeverity(event.target.value as '' | IssueSeverity)}>
              <option value="">{t('comm.filter.allSeverity')}</option>
              <option value="error">{t('comm.severity.error')}</option>
              <option value="warning">{t('comm.severity.warning')}</option>
              <option value="info">{t('comm.severity.info')}</option>
            </select>
          </div>
        </div>

        {creating && (
          <div className="comm-form">
            <input
              placeholder={t('comm.form.title')}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
            <textarea
              placeholder={t('comm.form.desc')}
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            <div className="comm-form-row">
              <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as IssueSeverity })}>
                <option value="error">{t('comm.severity.error')}</option>
                <option value="warning">{t('comm.severity.warning')}</option>
                <option value="info">{t('comm.severity.info')}</option>
              </select>
              <input
                className="category"
                placeholder={t('comm.form.category')}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              />
              <label className="comm-link">
                <input
                  type="checkbox"
                  checked={draft.linkSelected}
                  onChange={(event) => setDraft({ ...draft, linkSelected: event.target.checked })}
                />
                {t('comm.form.linkSelected')}
                {selected ? t('comm.form.linkName', { name: selected.name || selected.guid }) : t('comm.form.linkNone')}
              </label>
            </div>
            <div className="editor-actions">
              <button onClick={createIssue} disabled={busy !== ''}>
                {busy === 'create' ? t('comm.create.busy') : t('comm.create')}
              </button>
            </div>
          </div>
        )}

        {message && <p className="comm-message">{message}</p>}

        <ul className="comm-list">
          {list.map((item) => (
            <li
              key={item.id}
              className={`comm-item ${detail?.id === item.id ? 'active' : ''}`}
              onClick={() => void openDetail(item.id)}
            >
              <div className="comm-item-top">
                <span className={`badge sev-${item.severity}`}>{t('comm.severity.' + item.severity)}</span>
                <span className={`badge status-${item.status}`}>{t('comm.status.' + item.status)}</span>
                <span className="comm-title">{item.title}</span>
              </div>
              <p className="comm-meta">
                {t('comm.meta.line', { category: item.category, source: item.source, n: item.comments_count })}
                {item.has_snapshot ? ` · ${t('comm.meta.snapshot')}` : ''} · {new Date(item.updated_at).toLocaleString()}
              </p>
            </li>
          ))}
          {!list.length && <li className="hint">{t('comm.empty')}</li>}
        </ul>

        {detail && (
          <IssueDetail
            issue={detail}
            onPatch={(patch) => patchIssue(detail.id, patch)}
            onComment={(text) => commentOn(detail.id, text)}
            onSnapshot={() => attachSnapshot(detail.id)}
            onSelectElement={onSelect}
            onDelete={() => removeIssue(detail.id)}
          />
        )}
      </div>
    </div>
  )
}
