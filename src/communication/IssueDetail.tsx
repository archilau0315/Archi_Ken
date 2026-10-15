import { useState } from 'react'

import type { CommIssue, IssueSeverity, IssueStatus } from '../services/issues'
import { useT } from '../i18n'

// 沟通问题详情（L4，M8）：状态/级别调整、评论、视图快照、构件定位与删除。

interface Props {
  issue: CommIssue
  onPatch: (patch: Partial<Pick<CommIssue, 'status' | 'severity'>>) => Promise<void>
  onComment: (text: string) => Promise<void>
  onSnapshot: () => Promise<void>
  onSelectElement: (guid: string) => void
  onDelete: () => Promise<void>
}

export default function IssueDetail({ issue, onPatch, onComment, onSnapshot, onSelectElement, onDelete }: Props) {
  const { t } = useT()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitComment(): Promise<void> {
    const text = comment.trim()
    if (!text) return
    setBusy(true)
    try {
      await onComment(text)
      setComment('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="comm-detail">
      <header className="comm-detail-head">
        <strong>{issue.title}</strong>
        <div className="comm-detail-actions">
          <button className="ghost small" onClick={() => void onSnapshot()}>
            {t('comm.snapshot.attach')}
          </button>
          {issue.element && (
            <button className="ghost small" onClick={() => onSelectElement(issue.element!.guid)}>
              {t('comm.locate')}
            </button>
          )}
          <button className="ghost small danger" onClick={() => void onDelete()}>
            {t('comm.delete')}
          </button>
        </div>
      </header>

      <div className="comm-meta-grid">
        <label>
          {t('comm.status')}
          <select value={issue.status} onChange={(event) => void onPatch({ status: event.target.value as IssueStatus })}>
            <option value="open">{t('comm.status.open')}</option>
            <option value="acknowledged">{t('comm.status.acknowledged')}</option>
            <option value="resolved">{t('comm.status.resolved')}</option>
          </select>
        </label>
        <label>
          {t('comm.severity')}
          <select value={issue.severity} onChange={(event) => void onPatch({ severity: event.target.value as IssueSeverity })}>
            <option value="error">{t('comm.severity.error')}</option>
            <option value="warning">{t('comm.severity.warning')}</option>
            <option value="info">{t('comm.severity.info')}</option>
          </select>
        </label>
        <span>{t('comm.meta.sourceLine', { category: issue.category, source: issue.source })}</span>
        <span>{t('comm.created')} {new Date(issue.created_at).toLocaleString()}</span>
        {issue.has_snapshot && <span className="badge ok">{t('comm.snapshot.badge')}</span>}
      </div>

      {issue.element && (
        <p className="comm-elem">
          {t('comm.element.line', {
            name: issue.element.name || t('comm.unnamed'),
            type: issue.element.ifc_type,
            guid: issue.element.guid
          })}
          {issue.related ? ` ↔ ${t('comm.related', { name: issue.related.name || issue.related.guid })}` : ''}
        </p>
      )}

      {issue.description && <p className="comm-desc">{issue.description}</p>}

      <h4>{t('comm.comments.title', { n: issue.comments.length })}</h4>
      <ul className="comm-comments">
        {issue.comments.map((item) => (
          <li key={item.id} className="comm-comment">
            <div className="comm-comment-head">
              <strong>{item.author}</strong>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <p>{item.text}</p>
          </li>
        ))}
        {!issue.comments.length && <li className="hint small">{t('comm.comments.empty')}</li>}
      </ul>

      <div className="comm-comment-form">
        <input
          className="text"
          placeholder={t('comm.comments.placeholder')}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitComment()
          }}
        />
        <button disabled={busy || !comment.trim()}>{t('comm.comments.send')}</button>
      </div>
    </section>
  )
}
