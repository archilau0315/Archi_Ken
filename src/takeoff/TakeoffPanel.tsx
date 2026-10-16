import { useCallback, useEffect, useMemo, useState } from 'react'

import { useT } from '../i18n'
import { takeoffDefinitions, takeoffExport, takeoffRun } from '../services/kernel'
import type { TakeoffColumn, TakeoffDefinition, TakeoffRow, TakeoffRunResponse } from '../services/kernel'
import {
  deleteMyDefinition,
  getMyDefinition,
  listMyDefinitions,
  saveMyDefinition
} from '../services/takeoff-definitions'
import type { MyTakeoffDefinitionSummary, TakeoffGroupKey } from '../services/takeoff-definitions'

// 信息提取面板（L4，M6）：Solibri 风格 Definition 模板库 + 左树右表 + 分组小计。
// 内置模板由内核提供，用户模板由 L3 持久化。

interface Props {
  modelPath: string
  onClose: () => void
}

interface Draft {
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns: TakeoffColumn[]
  group_by: TakeoffGroupKey
}

interface Selected {
  source: 'builtin' | 'mine'
  id: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  category: 'mine',
  ifc_types: [],
  columns: [],
  group_by: 'container'
}

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export default function TakeoffPanel({ modelPath, onClose }: Props) {
  const { t, lang } = useT()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [builtin, setBuiltin] = useState<TakeoffDefinition[]>([])
  const [mine, setMine] = useState<MyTakeoffDefinitionSummary[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editMode, setEditMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState<TakeoffRunResponse | null>(null)
  const [busy, setBusy] = useState<'' | 'run' | 'export' | 'save'>('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draftCol, setDraftCol] = useState({ key: '', name: '', unit: '', expr: '' })
  // 层级展开状态：默认折叠，只显示父构件汇总行（避免父子重复计量）
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 初次加载：并行拉内置 + 我的模板，默认选中「全部构件」
  useEffect(() => {
    let cancelled = false
    Promise.all([takeoffDefinitions(lang), listMyDefinitions()])
      .then(([defs, my]) => {
        if (cancelled) return
        setCategories(defs.categories)
        setBuiltin(defs.items)
        setMine(my.items)
        const all = defs.items.find((item) => item.id === 'all') ?? defs.items[0]
        if (all) {
          setSelected({ source: 'builtin', id: all.id })
          setDraft(toDraft(all))
        }
      })
      .catch((err) => !cancelled && setError(makeError(err)))
    return () => {
      cancelled = true
    }
  }, [lang])

  // 选中变化时自动运行
  useEffect(() => {
    if (!selected || !modelPath) return
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, modelPath])

  const refreshMine = useCallback(async (): Promise<void> => {
    const list = await listMyDefinitions()
    setMine(list.items)
  }, [])

  async function selectBuiltin(def: TakeoffDefinition): Promise<void> {
    setSelected({ source: 'builtin', id: def.id })
    setDraft(toDraft(def))
    setDirty(false)
    setEditMode(false)
    setError('')
    setMessage('')
  }

  async function selectMine(item: MyTakeoffDefinitionSummary): Promise<void> {
    setError('')
    setMessage('')
    try {
      const full = await getMyDefinition(item.id)
      setSelected({ source: 'mine', id: full.id })
      setDraft({
        name: full.name,
        description: full.description,
        category: full.category,
        ifc_types: full.ifc_types,
        columns: full.columns,
        group_by: full.group_by
      })
      setDirty(false)
      setEditMode(false)
    } catch (err) {
      setError(makeError(err))
    }
  }

  function startNew(): void {
    setSelected(null)
    setDraft(EMPTY_DRAFT)
    setDirty(false)
    setEditMode(true)
    setResult(null)
    setError('')
    setMessage('')
  }

  function updateDraft(patch: Partial<Draft>): void {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function run(): Promise<void> {
    if (!modelPath || !draft.columns.length) {
      if (!draft.columns.length) setError(t('takeoff.keyExprRequired'))
      return
    }
    setBusy('run')
    setError('')
    try {
      const res = await takeoffRun(modelPath, draft.columns, {
        lang,
        ifcTypes: draft.ifc_types.length ? draft.ifc_types : undefined,
        groupBy: draft.group_by
      })
      setResult(res)
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function exportXlsx(): Promise<void> {
    if (!modelPath || !draft.columns.length) return
    setBusy('export')
    setError('')
    setMessage('')
    try {
      const res = await takeoffExport(modelPath, draft.columns, {
        lang,
        ifcTypes: draft.ifc_types.length ? draft.ifc_types : undefined,
        groupBy: draft.group_by
      })
      setMessage(t('takeoff.exported', { file: res.file }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function saveMine(): Promise<void> {
    if (!draft.name.trim() || !draft.columns.length) {
      setError(t('takeoff.keyExprRequired'))
      return
    }
    setBusy('save')
    setError('')
    setMessage('')
    try {
      // 从内置克隆的 draft 没带 id，后端会生成新 id；已加载的我的模板带 id = 覆盖
      const input = {
        id: selected?.source === 'mine' ? selected.id : undefined,
        name: draft.name,
        description: draft.description,
        category: draft.category || 'mine',
        ifc_types: draft.ifc_types,
        columns: draft.columns,
        group_by: draft.group_by
      }
      const saved = await saveMyDefinition(input, lang)
      await refreshMine()
      setSelected({ source: 'mine', id: saved.id })
      setDirty(false)
      setMessage(t('takeoff.saved', { name: saved.name }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function removeMine(item: MyTakeoffDefinitionSummary): Promise<void> {
    if (!window.confirm(t('takeoff.confirmDelete', { name: item.name }))) return
    setError('')
    setMessage('')
    try {
      await deleteMyDefinition(item.id)
      await refreshMine()
      if (selected?.source === 'mine' && selected.id === item.id) {
        setSelected(null)
        setDraft(EMPTY_DRAFT)
        setResult(null)
      }
      setMessage(t('takeoff.deleted', { name: item.name }))
    } catch (err) {
      setError(makeError(err))
    }
  }

  async function renameMine(item: MyTakeoffDefinitionSummary): Promise<void> {
    const name = window.prompt(t('takeoff.renamePrompt'), item.name)
    if (!name || !name.trim() || name.trim() === item.name) return
    setError('')
    setMessage('')
    try {
      const full = await getMyDefinition(item.id)
      await saveMyDefinition(
        {
          id: full.id,
          name: name.trim(),
          description: full.description,
          category: full.category,
          ifc_types: full.ifc_types,
          columns: full.columns,
          group_by: full.group_by
        },
        lang
      )
      await refreshMine()
      if (selected?.source === 'mine' && selected.id === item.id) {
        setDraft((prev) => ({ ...prev, name: name.trim() }))
      }
      setMessage(t('takeoff.renamed', { name: name.trim() }))
    } catch (err) {
      setError(makeError(err))
    }
  }

  function addDraftColumn(): void {
    const key = draftCol.key.trim()
    const expr = draftCol.expr.trim()
    if (!key || !expr) {
      setError(t('takeoff.keyExprRequired'))
      return
    }
    if (draft.columns.some((col) => col.key === key)) {
      setError(t('takeoff.keyExists', { key }))
      return
    }
    const unit = draftCol.unit.trim()
    const label = draftCol.name.trim() || key
    updateDraft({
      columns: [...draft.columns, unit ? { key, name: label, unit, expr } : { key, name: label, expr }]
    })
    setDraftCol({ key: '', name: '', unit: '', expr: '' })
    setError('')
  }

  function removeColumn(key: string): void {
    updateDraft({ columns: draft.columns.filter((col) => col.key !== key) })
  }

  const builtinByCat = useMemo(() => {
    const map = new Map<string, TakeoffDefinition[]>()
    for (const def of builtin) {
      const list = map.get(def.category) ?? []
      list.push(def)
      map.set(def.category, list)
    }
    return map
  }, [builtin])

  const valueKeys = result?.columns.map((col) => col.key) ?? []
  const hasGroups = Boolean(result?.groups?.length)
  const parentGuids = useMemo(
    () =>
      new Set(
        (result?.rows ?? []).map((row) => row.parent_guid).filter((guid): guid is string => Boolean(guid))
      ),
    [result]
  )

  const toggleExpand = useCallback((guid: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(guid)) next.delete(guid)
      else next.add(guid)
      return next
    })
  }, [])

  function toggleAllRows(): void {
    setExpanded((prev) => (prev.size ? new Set() : new Set(parentGuids)))
  }

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

        <div className="takeoff-body">
          <aside className="takeoff-tree">
            <div className="takeoff-tree-section">
              <div className="takeoff-tree-title">{t('takeoff.builtin')}</div>
              {categories.map((cat) => {
                const items = builtinByCat.get(cat.id) ?? []
                if (!items.length) return null
                return (
                  <div key={cat.id} className="takeoff-tree-cat">
                    <div className="takeoff-tree-cat-name">{cat.name}</div>
                    <ul>
                      {items.map((def) => (
                        <li
                          key={def.id}
                          className={`takeoff-tree-item ${selected?.source === 'builtin' && selected.id === def.id ? 'active' : ''}`}
                          onClick={() => void selectBuiltin(def)}
                        >
                          <span className="takeoff-tree-item-name">{def.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="takeoff-tree-section">
              <div className="takeoff-tree-title">
                {t('takeoff.mine')}
                <button className="ghost tiny" onClick={startNew} title={t('takeoff.newTemplate')}>
                  +
                </button>
              </div>
              {!mine.length && <p className="hint small">{t('takeoff.emptyMine')}</p>}
              <ul>
                {mine.map((item) => (
                  <li
                    key={item.id}
                    className={`takeoff-tree-item mine ${selected?.source === 'mine' && selected.id === item.id ? 'active' : ''}`}
                    onClick={() => void selectMine(item)}
                  >
                    <span className="takeoff-tree-item-name">{item.name}</span>
                    <span className="takeoff-tree-item-actions">
                      <button
                        className="ghost tiny"
                        onClick={(e) => {
                          e.stopPropagation()
                          void renameMine(item)
                        }}
                        title={t('takeoff.rename')}
                      >
                        ✎
                      </button>
                      <button
                        className="ghost tiny danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          void removeMine(item)
                        }}
                        title={t('takeoff.delete')}
                      >
                        🗑
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="takeoff-main">
            {!selected && !editMode && <p className="hint">{t('takeoff.selectHint')}</p>}

            {(selected || editMode) && (
              <>
                <div className="takeoff-fields">
                  <label>
                    {t('takeoff.fieldName')}
                    <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
                  </label>
                  <label className="takeoff-field-desc">
                    {t('takeoff.fieldDesc')}
                    <input
                      placeholder={t('takeoff.fieldDescPh')}
                      value={draft.description}
                      onChange={(e) => updateDraft({ description: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('takeoff.fieldGroup')}
                    <select value={draft.group_by} onChange={(e) => updateDraft({ group_by: e.target.value as TakeoffGroupKey })}>
                      <option value="">{t('takeoff.group.none')}</option>
                      <option value="container">{t('takeoff.group.container')}</option>
                      <option value="ifc_type">{t('takeoff.group.ifc_type')}</option>
                    </select>
                  </label>
                </div>

                <div className="takeoff-fields">
                  <label className="takeoff-field-types">
                    {t('takeoff.fieldTypes')}
                    <input
                      placeholder={t('takeoff.fieldTypesPh')}
                      value={draft.ifc_types.join(', ')}
                      onChange={(e) =>
                        updateDraft({
                          ifc_types: e.target.value
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </label>
                </div>

                <div className="takeoff-toolbar">
                  <button onClick={() => void run()} disabled={busy !== '' || !modelPath || !draft.columns.length}>
                    {busy === 'run' ? t('takeoff.running') : t('takeoff.run')}
                  </button>
                  <button className="ghost" onClick={() => void exportXlsx()} disabled={busy !== '' || !modelPath || !draft.columns.length}>
                    {busy === 'export' ? t('takeoff.exporting') : t('takeoff.export')}
                  </button>
                  <button className="ghost" onClick={() => setEditMode(!editMode)}>
                    {editMode ? t('takeoff.applyColumns') : t('takeoff.editColumns')}
                  </button>
                  <button className="ghost" onClick={() => void saveMine()} disabled={busy !== '' || !draft.name.trim() || !draft.columns.length}>
                    {busy === 'save' ? t('takeoff.saving') : t('takeoff.saveAsMine')}
                  </button>
                  {dirty && <span className="hint small">{t('takeoff.dirty')}</span>}
                  {selected?.source === 'builtin' && <span className="badge">{t('takeoff.builtinBadge')}</span>}
                </div>

                {message && <p className="takeoff-message">{message}</p>}

                {editMode && (
                  <div className="takeoff-columns-editor">
                    <ul className="takeoff-columns">
                      {draft.columns.map((col) => (
                        <li key={col.key}>
                          <span className="col-name">
                            {col.name}
                            {col.unit ? ` (${col.unit})` : ''}
                          </span>
                          <code>{col.expr}</code>
                          <button className="ghost small" onClick={() => removeColumn(col.key)}>
                            {t('takeoff.remove')}
                          </button>
                        </li>
                      ))}
                      {!draft.columns.length && <li className="hint small">{t('takeoff.noCustomColumns')}</li>}
                    </ul>
                    <div className="takeoff-add">
                      <input placeholder={t('takeoff.phKey')} value={draftCol.key} onChange={(e) => setDraftCol({ ...draftCol, key: e.target.value })} />
                      <input placeholder={t('takeoff.phName')} value={draftCol.name} onChange={(e) => setDraftCol({ ...draftCol, name: e.target.value })} />
                      <input className="unit" placeholder={t('takeoff.phUnit')} value={draftCol.unit} onChange={(e) => setDraftCol({ ...draftCol, unit: e.target.value })} />
                      <input className="expr" placeholder={t('takeoff.phExpr')} value={draftCol.expr} onChange={(e) => setDraftCol({ ...draftCol, expr: e.target.value })} />
                      <button className="ghost" onClick={addDraftColumn}>
                        {t('takeoff.add')}
                      </button>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="takeoff-result">
                    <div className="takeoff-result-meta">
                      <span>
                        {t('takeoff.resultMeta', {
                          total: result.total,
                          truncated: result.truncated ? t('takeoff.truncated') : '',
                          errors: result.expression_errors,
                          cache: result.cache_hit ? t('takeoff.cacheHit') : t('takeoff.cacheMiss')
                        })}
                      </span>
                      {parentGuids.size > 0 && (
                        <button className="ghost small" onClick={toggleAllRows}>
                          {expanded.size ? t('takeoff.collapseAll') : t('takeoff.expandAll')}
                        </button>
                      )}
                    </div>
                    {!result.rows.length && <p className="hint">{t('takeoff.empty')}</p>}
                    {result.rows.length > 0 && (
                      <div className="takeoff-table-wrap">
                        <table className="takeoff-table">
                          <thead>
                            <tr>
                              <th>{t('takeoff.thName')}</th>
                              <th>{t('takeoff.thIfcType')}</th>
                              <th>{t('takeoff.thContainer')}</th>
                              {result.columns.map((col) => (
                                <th key={col.key}>{col.unit ? `${col.name} (${col.unit})` : col.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {hasGroups ? (
                              result.groups!.map((group) => (
                                <GroupRows
                                  key={group.key || '__ungrouped'}
                                  group={group}
                                  valueKeys={valueKeys}
                                  t={t}
                                  expanded={expanded}
                                  onToggle={toggleExpand}
                                />
                              ))
                            ) : (
                              <TreeRows
                                rows={result.rows}
                                valueKeys={valueKeys}
                                t={t}
                                expanded={expanded}
                                onToggle={toggleExpand}
                              />
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="takeoff-total-row">
                              <td>{t('takeoff.grandTotal')}</td>
                              <td />
                              <td />
                              {valueKeys.map((key) => (
                                <td key={key}>{formatCell(result.totals[key], t)}</td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function toDraft(def: TakeoffDefinition): Draft {
  return {
    name: def.name,
    description: def.description,
    category: def.category,
    ifc_types: def.ifc_types,
    columns: def.columns,
    group_by: def.group_by
  }
}

interface GroupProps {
  group: { key: string; rows: TakeoffRow[]; subtotals: Record<string, number> }
  valueKeys: string[]
  t: (key: string) => string
  expanded: Set<string>
  onToggle: (guid: string) => void
}

function GroupRows({ group, valueKeys, t, expanded, onToggle }: GroupProps) {
  // 全为子构件的组不显示小计行（子构件不计入合计，避免出现空小计）
  const hasSubtotal = Object.keys(group.subtotals).length > 0
  return (
    <>
      <tr className="takeoff-group-header">
        <td colSpan={3 + valueKeys.length}>▼ {group.key || t('takeoff.ungrouped')}</td>
      </tr>
      <TreeRows rows={group.rows} valueKeys={valueKeys} t={t} expanded={expanded} onToggle={onToggle} />
      {hasSubtotal && (
        <tr className="takeoff-subtotal-row">
          <td>{t('takeoff.subtotal')}</td>
          <td />
          <td />
          {valueKeys.map((key) => (
            <td key={key}>{formatCell(group.subtotals[key], t)}</td>
          ))}
        </tr>
      )}
    </>
  )
}

interface TreeProps {
  rows: TakeoffRow[]
  valueKeys: string[]
  t: (key: string) => string
  expanded: Set<string>
  onToggle: (guid: string) => void
}

/** 按 parent_guid 把平铺行组成父子层级：父行默认折叠只显示汇总，点 ▸ 展开子构件明细。 */
function TreeRows({ rows, valueKeys, t, expanded, onToggle }: TreeProps) {
  const { roots, childrenOf } = useMemo(() => {
    const guids = new Set(rows.map((row) => row.guid))
    const map = new Map<string, TakeoffRow[]>()
    const top: TakeoffRow[] = []
    for (const row of rows) {
      const parent = row.parent_guid
      // 父不在本组行内（被过滤或截断）时按顶层处理，避免子行丢失
      if (parent && parent !== row.guid && guids.has(parent)) {
        const list = map.get(parent)
        if (list) list.push(row)
        else map.set(parent, [row])
      } else {
        top.push(row)
      }
    }
    return { roots: top, childrenOf: map }
  }, [rows])

  return (
    <>
      {roots.map((row) => (
        <RowNode
          key={row.guid}
          row={row}
          depth={0}
          childrenOf={childrenOf}
          valueKeys={valueKeys}
          t={t}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

interface NodeProps {
  row: TakeoffRow
  depth: number
  childrenOf: Map<string, TakeoffRow[]>
  valueKeys: string[]
  t: (key: string) => string
  expanded: Set<string>
  onToggle: (guid: string) => void
}

function RowNode({ row, depth, childrenOf, valueKeys, t, expanded, onToggle }: NodeProps) {
  const kids = childrenOf.get(row.guid) ?? []
  const open = expanded.has(row.guid)
  return (
    <>
      <tr className={depth > 0 ? 'takeoff-row-child' : undefined}>
        <td>
          <span className="takeoff-name-cell" style={{ paddingLeft: depth * 18 }}>
            {kids.length > 0 ? (
              <button
                className="takeoff-expander"
                onClick={() => onToggle(row.guid)}
                title={open ? t('takeoff.collapse') : t('takeoff.expand')}
              >
                {open ? '▾' : '▸'}
              </button>
            ) : (
              depth > 0 && <span className="takeoff-expander-holder" />
            )}
            {row.name || t('takeoff.unnamed')}
            {kids.length > 0 && <span className="takeoff-child-count">{kids.length}</span>}
          </span>
        </td>
        <td>{row.ifc_type}</td>
        <td>{row.container || '—'}</td>
        {valueKeys.map((key) => (
          <td key={key}>{formatCell(row.values[key], t)}</td>
        ))}
      </tr>
      {open &&
        kids.map((kid) => (
          <RowNode
            key={kid.guid}
            row={kid}
            depth={depth + 1}
            childrenOf={childrenOf}
            valueKeys={valueKeys}
            t={t}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

function formatCell(value: unknown, t: (key: string) => string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6)
  if (typeof value === 'boolean') return value ? t('takeoff.yes') : t('takeoff.no')
  return String(value)
}
