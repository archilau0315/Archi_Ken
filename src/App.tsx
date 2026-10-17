import { useEffect, useMemo, useRef, useState } from 'react'

import ClashMatrix from './clash/ClashMatrix'
import CommunicationPanel from './communication/CommunicationPanel'
import HelpPanel from './help/HelpPanel'
import { useT } from './i18n'
import IdsEditor from './ids/IdsEditor'
import FederationTree from './model-tree/FederationTree'
import ModelSourcePanel from './model-tree/ModelSourcePanel'
import {
  federationMerge,
  federationToBboxItems,
  geometryMeshes,
  ifcElementDetail
} from './services/kernel'
import type { BboxItem, ElementDetail, ElementMesh, FederationResponse } from './services/kernel'
import { reportRun } from './services/report'
import type { Report } from './services/report'
import ReportPanel from './report/ReportPanel'
import RulesetEditor from './ruleset-editor/RulesetEditor'
import TakeoffPanel from './takeoff/TakeoffPanel'
import Viewer from './viewer/Viewer'
import type { ViewerHandle } from './viewer/Viewer'
import type { ColorMode } from './viewer/model'
import ViewPanel from './views/ViewPanel'
import ViewToolbar from './views/ViewToolbar'
import './communication/communication.css'
import './report/report.css'
import './takeoff/takeoff.css'
import './views/view.css'

// 应用主界面（L4）：模型源与融合树 | 3D 视图 | 属性与问题 三栏布局。
// M1：支持多模型源融合、专业分类自动映射、融合模型树。
// M3：规则集管理与编辑器（保存/复用规则集、从模板编辑规则、用规则集运行检查）。
// M4：冲突矩阵与碰撞分类（按专业两两对检，硬/间隙/净空，忽略规则）。
// M7：IDS 校验与编辑器（buildingSMART IDS：编辑/导入/导出/校验报告）。
// M6：ITO/QTO 信息提取（自定义计算列 + 逐构件结果 + Excel 导出）。
// M8：沟通与 BCF（问题清单、生命周期、评论、视图快照、BCF 2.1 导出）。
// M9：报告生成（摘要统计 + 问题清单 + HTML / PDF / Excel 导出）。
// M10：视图系统（透视/平面切换、标准视角、剖切、3D 标记、演示视角播放）。

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 品牌 logo：建筑轮廓 + 对勾，体现「模型质量审查通过」。 */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 21V8l6-4v17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 10h10v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M2.5 21h19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M13.5 15.4l2 2.2 3.7-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function App() {
  const { t, lang, setLang } = useT()
  const [sources, setSources] = useState<string[]>([])
  const [fed, setFed] = useState<FederationResponse | null>(null)
  const [items, setItems] = useState<BboxItem[] | ElementMesh[]>([])
  const [useMesh, setUseMesh] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('discipline')
  // 模型源显示开关：被关闭（3D 中隐藏）的源索引集合；仅影响 3D 显示，不影响计算。
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set())

  /** 切换某个模型源的 3D 显示开关。 */
  function toggleSourceVisible(index: number): void {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // 源增删后清掉越界的隐藏索引（索引随列表变化）。
  useEffect(() => {
    setHidden((prev) => {
      const next = new Set([...prev].filter((i) => i < sources.length))
      return next.size === prev.size ? prev : next
    })
  }, [sources.length])

  // 按显示开关过滤 3D 渲染项：bbox 模式按 item.model（源索引），mesh 模式按 guid 前缀 "index:"。
  const visibleItems = useMemo(() => {
    if (!hidden.size) return items
    return (items as Array<BboxItem & { model?: number }>).filter((item) => {
      const modelIndex = useMesh
        ? Number(String(item.guid).split(':')[0])
        : item.model ?? 0
      return !hidden.has(modelIndex)
    }) as BboxItem[] | ElementMesh[]
  }, [items, hidden, useMesh])

  // 包围盒模式没有原生颜色概念：回到融合模式时显色自动回到「专业分类」。
  useEffect(() => {
    if (!useMesh) setColorMode('discipline')
  }, [useMesh])

  // 原始颜色图例：按 IFC 原生色聚合构件数（仅真实网格模式有数据），取数量前 8 的色。
  const ifcLegend = useMemo(() => {
    if (!useMesh) return [] as Array<[string, number]>
    const counts = new Map<string, number>()
    for (const item of items as ElementMesh[]) {
      if (item.ifc_color) counts.set(item.ifc_color, (counts.get(item.ifc_color) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [items, useMesh])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  // 碰撞对高亮（视图 uid，带源序号前缀）：非空时 3D 视图同时框选碰撞双方。
  const [pairGuids, setPairGuids] = useState<string[] | null>(null)
  const [detail, setDetail] = useState<ElementDetail | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState<'' | 'fed' | 'mesh' | 'check' | 'report'>('')
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [clashOpen, setClashOpen] = useState(false)
  const [idsOpen, setIdsOpen] = useState(false)
  const [takeoffOpen, setTakeoffOpen] = useState(false)
  const [commOpen, setCommOpen] = useState(false)
  // 首次启动自动弹出帮助面板（localStorage 标记已读，之后不再自动弹）。
  const [helpOpen, setHelpOpen] = useState(() => {
    try {
      return !localStorage.getItem('archiken.help.seen')
    } catch {
      return false
    }
  })

  // F1 快捷键打开帮助（桌面软件惯例）。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function closeHelp() {
    setHelpOpen(false)
    try {
      localStorage.setItem('archiken.help.seen', '1')
    } catch {
      /* 隐私模式下忽略 */
    }
  }
  const [reportOpen, setReportOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [markerPick, setMarkerPick] = useState<{ id: string; nonce: number } | null>(null)
  const viewerRef = useRef<ViewerHandle>(null)

  const primaryPath = sources[0] ?? ''

  async function loadFederation(): Promise<void> {
    if (!sources.length) {
      setError(t('app.error.noSource'))
      return
    }
    setBusy('fed')
    setError('')
    try {
      const result = await federationMerge(sources, { lang })
      setFed(result)
      setItems(federationToBboxItems(result.elements.items))
      setUseMesh(false)
      setSelectedUid(null)
      setDetail(null)
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  /** 拉取各模型源的真实三角网格并切换 3D 视图为网格模式（多源按地理参考偏移叠加到同一空间）。 */
  async function loadMeshes(): Promise<void> {
    if (!sources.length) {
      setError(t('app.error.noSource'))
      return
    }
    setBusy('mesh')
    setError('')
    try {
      // 并发拉取全部模型源；每个源带 model_offset（地理参考平移），按源平移网格对齐到同一空间。
      const batches = await Promise.all(sources.map((path) => geometryMeshes(path, 5000)))
      const merged: ElementMesh[] = []
      batches.forEach((batch, index) => {
        const offset = batch.model_offset ?? [0, 0, 0]
        for (const item of batch.items) {
          merged.push({
            ...item,
            // guid 加源序号前缀：不同模型可能有相同 guid，避免 mesh 选中定位互相冲突。
            guid: `${index}:${item.guid}`,
            position_offset: offset
          })
        }
      })
      setItems(merged)
      setUseMesh(true)
      setSelectedUid(null)
      setDetail(null)
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function runCheck(): Promise<void> {
    if (!primaryPath) return
    setBusy('check')
    setError('')
    try {
      setReport(await reportRun(primaryPath, { lang }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)

  async function selectElement(uid: string | null): Promise<void> {
    setSelectedUid(uid)
    setDetail(null)
    setSelectedMaterial(null)
    setPairGuids(null)
    if (!uid || !fed) return
    const element = fed.elements.items.find((item) => item.uid === uid)
    const model = element ? fed.models[element.model] : undefined
    if (!element || !model) return
    setSelectedMaterial(element.material ?? null)
    try {
      setDetail(await ifcElementDetail(model.path, element.guid))
    } catch {
      // 空间节点（如楼层）没有构件属性，忽略即可
      setDetail(null)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <strong>{t('app.brand')}</strong>
          <span className="tagline">{t('app.tagline')}</span>
        </div>
        <button onClick={loadFederation} disabled={busy !== ''}>
          {busy === 'fed' ? t('app.loading') : t('app.load')}
        </button>
        <button className="ghost" onClick={loadMeshes} disabled={busy !== '' || !sources.length}>
          {busy === 'mesh' ? t('app.meshLoading') : t('app.mesh')}
        </button>
        <button className="ghost" onClick={runCheck} disabled={busy !== '' || !primaryPath}>
          {busy === 'check' ? t('app.checking') : t('app.runCheck')}
        </button>
        <button className="ghost" onClick={() => setReportOpen(true)} disabled={busy !== '' || !primaryPath}>
          {t('app.report')}
        </button>
        <button
          className={viewOpen ? 'ghost toggle-on' : 'ghost'}
          onClick={() => setViewOpen((value) => !value)}
          disabled={!items.length}
        >
          {t('app.view')}
        </button>
        <button className="ghost" onClick={() => setEditorOpen(true)}>
          {t('app.rulesets')}
        </button>
        <button className="ghost" onClick={() => setClashOpen(true)} disabled={!primaryPath}>
          {t('app.clashMatrix')}
        </button>
        <button className="ghost" onClick={() => setIdsOpen(true)} disabled={!primaryPath}>
          {t('app.ids')}
        </button>
        <button className="ghost" onClick={() => setTakeoffOpen(true)} disabled={!primaryPath}>
          {t('app.takeoff')}
        </button>
        <button className="ghost" onClick={() => setCommOpen(true)}>
          {t('app.comm')}
        </button>
        <button className="ghost" onClick={() => setHelpOpen(true)}>
          {t('help.title')}
        </button>
        <button
          className="ghost lang-switch"
          title={t('app.lang.hint')}
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          {t('app.lang.label')}
        </button>
      </header>

      {error && <div className="error-bar">{error}</div>}

      <main className="workspace">
        <aside className="panel left">
          <h2>{t('app.sources')}</h2>
          <ModelSourcePanel
            sources={sources}
            busy={busy !== ''}
            suggestions={[]}
            onChange={setSources}
            hidden={hidden}
            onToggleVisible={toggleSourceVisible}
          />

          {/* 显色书签：两个页签共用一个区块，点哪个哪个在上，3D 显色同步切换。 */}
          <div className="color-tabs" role="tablist">
            <button
              className={colorMode === 'discipline' ? 'color-tab on' : 'color-tab'}
              onClick={() => setColorMode('discipline')}
            >
              {t('app.disciplines')}
            </button>
            <button
              className={colorMode === 'ifc' ? 'color-tab on' : 'color-tab'}
              onClick={() => setColorMode('ifc')}
              disabled={!useMesh}
              title={!useMesh ? t('app.colorMode.ifcDisabled') : undefined}
            >
              {t('app.colorMode.ifc')}
            </button>
          </div>
          {colorMode === 'discipline' ? (
            fed ? (
              <ul className="legend">
                {fed.disciplines.map((item) => (
                  <li key={item.key} className="legend-item">
                    <span className="legend-dot" style={{ background: item.color }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-count">
                      {t('app.discipline.count', { n: item.element_count, geo: item.geo_count })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">{t('app.discipline.hint')}</p>
            )
          ) : (
            <>
              <p className="hint">{t('app.colorMode.ifcHint')}</p>
              {ifcLegend.length > 0 && (
                <ul className="legend">
                  {ifcLegend.map(([color, count]) => (
                    <li key={color} className="legend-item">
                      <span className="legend-dot" style={{ background: color }} />
                      <span className="legend-name">{color}</span>
                      <span className="legend-count">
                        {t('app.colorMode.count', { n: count })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <h2 className="section">{t('app.fedTree')}</h2>
          <FederationTree roots={fed?.tree.roots ?? []} disciplines={fed?.disciplines ?? []} />

          {fed && (
            <dl className="stats">
              <div>
                <dt>{t('app.stats.models')}</dt>
                <dd>{fed.totals.models}</dd>
              </div>
              <div>
                <dt>{t('app.stats.elements')}</dt>
                <dd>{fed.totals.products}</dd>
              </div>
              <div>
                <dt>{t('app.stats.geo')}</dt>
                <dd>{fed.totals.geo_elements}</dd>
              </div>
              <div>
                <dt>{t('app.stats.guidConflicts')}</dt>
                <dd>{fed.totals.guid_conflicts}</dd>
              </div>
            </dl>
          )}
        </aside>

        <section className="panel center">
          {/* 高频视角 / 剖切操作固定占位在画布上方，不再以浮层压住 3D 画面。 */}
          {items.length > 0 && <ViewToolbar viewerRef={viewerRef} />}
          <Viewer
        ref={viewerRef}
        items={visibleItems}
        selectedGuid={selectedUid}
        selectedGuids={pairGuids}
        onSelect={selectElement}
        onMarkerPick={(id) => id && setMarkerPick({ id, nonce: Date.now() })}
        useMesh={useMesh}
        colorMode={colorMode}
      />
          <div className="viewer-hint">
            {items.length
              ? t('app.viewer.hint.loaded', { models: fed?.totals.models ?? 0, count: items.length })
              : t('app.viewer.hint.empty')}
          </div>
        </section>

        <aside className="panel right">
          <h2>{t('app.props')}</h2>
          {detail ? (
            <>
              <div className="detail-head">
                <span className="type-badge">{detail.ifc_type}</span>
                {selectedMaterial && <span className="type-badge material">{selectedMaterial}</span>}
                <span>{detail.name || t('app.unnamed')}</span>
              </div>
              <p className="guid">{detail.guid}</p>
              <div className="psets">
                {Object.entries(detail.psets).map(([psetName, props]) => (
                  <div key={psetName} className="pset">
                    <h3>{psetName}</h3>
                    <ul>
                      {Object.entries(props).map(([key, value]) => (
                        <li key={key}>
                          <span>{key}</span>
                          <span className="value">{String(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="hint">{selectedUid ? t('app.props.none') : t('app.props.pick')}</p>
          )}

          <h2 className="section">{t('app.issues')}</h2>
          <p className="hint small">{t('app.issues.inputHint', { name: primaryPath.split(/[\\/]/).pop() || '—' })}</p>
          {report ? (
            <>
              <div className="chips">
                <span className="chip">{t('app.issues.total', { n: report.summary.total })}</span>
                <span className="chip error">{t('app.issues.error', { n: report.summary.by_severity.error ?? 0 })}</span>
                <span className="chip warning">{t('app.issues.warning', { n: report.summary.by_severity.warning ?? 0 })}</span>
                <span className="chip info">{t('app.issues.info', { n: report.summary.by_severity.info ?? 0 })}</span>
              </div>
              <ul className="issues">
                {report.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`issue ${issue.severity}`}
                    onClick={() => selectElement(`0:${issue.element.guid}`)}
                  >
                    <div className="issue-head">
                      <span className={`dot ${issue.severity}`} />
                      <span className="issue-title">{issue.title}</span>
                      <span className="issue-cat">{issue.category}</span>
                    </div>
                    <p className="issue-reason">{issue.reason}</p>
                    <p className="issue-elem">{issue.element.name || issue.element.guid}</p>
                  </li>
                ))}
                {!report.issues.length && <p className="hint">{t('app.issues.none')}</p>}
              </ul>
            </>
          ) : (
            <p className="hint">{t('app.issues.empty')}</p>
          )}
        </aside>
      </main>

      {editorOpen && (
        <RulesetEditor modelPath={primaryPath} onReport={setReport} onClose={() => setEditorOpen(false)} />
      )}
      {clashOpen && (
        <ClashMatrix
          modelPath={primaryPath}
          viewerRef={viewerRef}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
          onPairSelect={setPairGuids}
          onClose={() => {
            setPairGuids(null)
            setClashOpen(false)
          }}
        />
      )}
      {idsOpen && (
        <IdsEditor
          modelPath={primaryPath}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
          onClose={() => setIdsOpen(false)}
        />
      )}
      {takeoffOpen && (
        <TakeoffPanel
          modelPath={primaryPath}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
          onClose={() => setTakeoffOpen(false)}
        />
      )}
      {reportOpen && (
        <ReportPanel
          modelPath={primaryPath}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
          onClose={() => setReportOpen(false)}
        />
      )}
      {viewOpen && (
        <ViewPanel
          modelPath={primaryPath}
          viewerRef={viewerRef}
          selectedGuid={detail?.guid ?? null}
          pickedMarker={markerPick}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
        />
      )}
      {commOpen && (
        <CommunicationPanel
          modelPath={primaryPath}
          selected={detail ? { guid: detail.guid, name: detail.name, ifc_type: detail.ifc_type } : null}
          captureView={() => viewerRef.current?.capture() ?? null}
          onSelect={(guid) => void selectElement(`0:${guid}`)}
          onClose={() => setCommOpen(false)}
        />
      )}
      {helpOpen && <HelpPanel onClose={closeHelp} />}
    </div>
  )
}
