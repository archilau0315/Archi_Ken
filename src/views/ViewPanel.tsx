import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { useT } from '../i18n'
import { reportRun } from '../services/report'
import type { Issue } from '../services/report'
import type { ViewerHandle } from '../viewer/Viewer'
import type { MarkerSpec } from '../viewer/views/markers'
import { createSavedView, loadViews, saveViews, type SavedView } from '../viewer/views/viewpoints'

// 视图面板（L4，M10）：只放低频功能（3D 标记 / 演示视角），分区可折叠、面板可拖拽移动。
// 高频的视角与剖切已移入 3D 视图顶部工具条（ViewToolbar），此处不重复摆放。

interface Props {
  modelPath: string
  viewerRef: RefObject<ViewerHandle>
  selectedGuid: string | null
  pickedMarker: { id: string; nonce: number } | null
  onSelect: (guid: string) => void
}

type SectionKey = 'markers' | 'views'

const SEVERITY_COLOR: Record<string, string> = { error: '#d92d20', warning: '#dc6803', info: '#1570ef' }

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function shortName(name: string | null | undefined, guid: string): string {
  const text = name?.trim() || guid
  return text.length > 14 ? `${text.slice(0, 14)}…` : text
}

/** 可折叠分区：标题行点击即展开 / 折叠，右侧显示条目数。 */
function Section({
  title,
  count,
  open,
  onToggle,
  children
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="view-sec">
      <button className="view-sec-head" onClick={onToggle}>
        <span className="view-caret">{open ? '▾' : '▸'}</span>
        <span>{title}</span>
        {count > 0 && <span className="view-sec-count">{count}</span>}
      </button>
      {open && <div className="view-sec-body">{children}</div>}
    </section>
  )
}

export default function ViewPanel({ modelPath, viewerRef, selectedGuid, pickedMarker, onSelect }: Props) {
  const { t, lang } = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({ markers: false, views: false })
  const [markers, setMarkers] = useState<MarkerSpec[]>([])
  const [views, setViews] = useState<SavedView[]>([])
  const [viewName, setViewName] = useState('')
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setViews(loadViews(modelPath))
    return () => stopPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath])

  // 3D 视图中点中标记：飞行定位并联动构件（nonce 保证同一标记可重复触发）。
  useEffect(() => {
    if (!pickedMarker) return
    const marker = markers.find((item) => item.id === pickedMarker.id)
    if (!marker) return
    viewerRef.current?.focusMarker(pickedMarker.id)
    if (marker.guid) onSelect(marker.guid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedMarker])

  function toggleSection(key: SectionKey): void {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  /** 头部拖动：按下时把卡片从右侧定位切换为左上角定位，之后按指针位移移动并夹在视口内。 */
  function onHeaderDown(event: React.PointerEvent<HTMLElement>): void {
    if (event.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, w: rect.width, h: rect.height }
    setPos({ left: rect.left, top: rect.top })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 指针已失效时（含合成事件）忽略，后续 move 事件仍可继续移动。
    }
    event.preventDefault()
  }

  function onHeaderMove(event: React.PointerEvent<HTMLElement>): void {
    const drag = dragRef.current
    // 仅左键按住时才拖动：pointer capture 失败后在面板外松开时，
    // 不会因 dragRef 残留而「悬停即拖走」。
    if (!drag || (event.buttons & 1) === 0) {
      dragRef.current = null
      return
    }
    const left = Math.min(Math.max(event.clientX - drag.dx, 4), window.innerWidth - drag.w - 4)
    const top = Math.min(Math.max(event.clientY - drag.dy, 4), window.innerHeight - drag.h - 4)
    setPos({ left, top })
  }

  function onHeaderUp(): void {
    dragRef.current = null
  }

  async function loadIssueMarkers(): Promise<void> {
    if (!modelPath) return
    setBusy('markers')
    setError('')
    try {
      const report = await reportRun(modelPath, { lang })
      const specs: MarkerSpec[] = []
      report.issues.forEach((issue: Issue, index: number) => {
        const pos = issue.location && issue.location.length >= 3
          ? ([issue.location[0], issue.location[1], issue.location[2]] as [number, number, number])
          : viewerRef.current?.getElementCenter(issue.element.guid) ?? null
        if (!pos) return
        specs.push({
          id: issue.id,
          label: `${index + 1}. ${shortName(issue.element.name, issue.element.guid)}`,
          position: pos,
          color: SEVERITY_COLOR[issue.severity] ?? '#7c3aed',
          guid: issue.element.guid
        })
      })
      viewerRef.current?.clearMarkers()
      for (const spec of specs) viewerRef.current?.addMarker(spec)
      setMarkers(specs)
      setMessage(t('views.markersLoaded', { loaded: specs.length, total: report.issues.length }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  function markSelected(): void {
    if (!selectedGuid) {
      setError(t('views.errSelectFirst'))
      return
    }
    const pos = viewerRef.current?.getElementCenter(selectedGuid)
    if (!pos) {
      setError(t('views.errNoGeometry'))
      return
    }
    const spec: MarkerSpec = {
      id: `manual|${selectedGuid}`,
      label: shortName(selectedGuid, selectedGuid),
      position: pos,
      color: '#7c3aed',
      guid: selectedGuid
    }
    viewerRef.current?.addMarker(spec)
    setMarkers((prev) => {
      const rest = prev.filter((item) => item.id !== spec.id)
      return [...rest, spec]
    })
    viewerRef.current?.focusMarker(spec.id)
    setError('')
    setMessage(t('views.markerAdded'))
  }

  function removeMarker(id: string): void {
    viewerRef.current?.removeMarker(id)
    setMarkers((prev) => prev.filter((item) => item.id !== id))
  }

  function clearMarkers(): void {
    viewerRef.current?.clearMarkers()
    setMarkers([])
  }

  function focusMarker(spec: MarkerSpec): void {
    viewerRef.current?.focusMarker(spec.id)
    if (spec.guid) onSelect(spec.guid)
  }

  function saveCurrentView(): void {
    const name = viewName.trim()
    if (!name) {
      setError(t('views.errNameRequired'))
      return
    }
    const state = viewerRef.current?.getViewState()
    if (!state) return
    const next = [...views, createSavedView(name, state)]
    setViews(next)
    saveViews(modelPath, next)
    setViewName('')
    setError('')
    setMessage(t('views.viewSaved', { name, count: next.length }))
  }

  function deleteView(id: string): void {
    const next = views.filter((item) => item.id !== id)
    setViews(next)
    saveViews(modelPath, next)
  }

  function stopPlay(): void {
    if (playTimer.current) {
      clearTimeout(playTimer.current)
      playTimer.current = null
    }
    setPlaying(false)
  }

  function playStep(index: number): void {
    const list = loadViews(modelPath)
    if (!list.length) {
      stopPlay()
      return
    }
    const view = list[index % list.length]
    viewerRef.current?.flyToState(view.state, 900)
    setMessage(t('views.playing', { index: (index % list.length) + 1, total: list.length, name: view.name }))
    playTimer.current = setTimeout(() => playStep(index + 1), 3200)
  }

  function startPlay(): void {
    if (!views.length) {
      setError(t('views.errNoViews'))
      return
    }
    setPlaying(true)
    setError('')
    playStep(0)
  }

  return (
    <div
      ref={panelRef}
      className="view-float"
      style={pos ? { left: pos.left, top: pos.top, right: 'auto' } : undefined}
    >
      <header
        className="view-float-top"
        title={t('views.dragPanel')}
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
      >
        <strong>{t('views.title')}</strong>
        <span className="tagline">{t('views.tagline')}</span>
      </header>

      <div className="view-float-body">
        {(error || message) && (
          <div className="view-float-alert">
            {error && <div className="error-bar">{error}</div>}
            {message && <p className="view-message">{message}</p>}
          </div>
        )}

        <Section
          title={t('views.sectionMarkers')}
          count={markers.length}
          open={openSections.markers}
          onToggle={() => toggleSection('markers')}
        >
          <div className="view-row">
            <button onClick={loadIssueMarkers} disabled={busy !== '' || !modelPath}>
              {busy === 'markers' ? t('views.loadingMarkers') : t('views.loadIssueMarkers')}
            </button>
            <button className="ghost" onClick={markSelected} disabled={!selectedGuid}>
              {t('views.markSelected')}
            </button>
            <button className="ghost" onClick={clearMarkers} disabled={!markers.length}>
              {t('views.clearMarkers')}
            </button>
          </div>
          <ul className="view-marker-list">
            {markers.map((spec) => (
              <li key={spec.id} className={pickedMarker?.id === spec.id ? 'active' : ''}>
                <span className="view-dot" style={{ background: spec.color }} />
                <a className="view-link" onClick={() => focusMarker(spec)}>
                  {spec.label}
                </a>
                <button className="ghost view-del" onClick={() => removeMarker(spec.id)}>
                  {t('views.delete')}
                </button>
              </li>
            ))}
            {!markers.length && <li className="view-muted">{t('views.markersEmpty')}</li>}
          </ul>
        </Section>

        <Section
          title={t('views.sectionViews')}
          count={views.length}
          open={openSections.views}
          onToggle={() => toggleSection('views')}
        >
          <div className="view-row">
            <input
              placeholder={t('views.namePlaceholder')}
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <button className="ghost" onClick={saveCurrentView}>
              {t('views.saveCurrent')}
            </button>
            {playing ? (
              <button className="ghost" onClick={stopPlay}>
                {t('views.stopPlay')}
              </button>
            ) : (
              <button className="ghost" onClick={startPlay} disabled={!views.length}>
                {t('views.playAll')}
              </button>
            )}
          </div>
          <ul className="view-marker-list">
            {views.map((view, index) => (
              <li key={view.id}>
                <span className="view-index">{index + 1}</span>
                <a className="view-link" onClick={() => viewerRef.current?.flyToState(view.state)}>
                  {view.name}
                </a>
                <span className="view-muted">
                  {view.state.mode === 'orthographic' ? t('views.orthographicShort') : t('views.perspective')}
                </span>
                <button className="ghost view-del" onClick={() => deleteView(view.id)}>
                  {t('views.delete')}
                </button>
              </li>
            ))}
            {!views.length && <li className="view-muted">{t('views.viewsEmpty')}</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}
