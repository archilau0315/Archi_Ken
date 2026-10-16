// 信息提取结果表的树形行渲染（拆分子模块）：父子层级展开 / 分组小计行 / 数值格式化。
// 行可点击 → onSelect 回调（App 用于选中并在 3D 高亮构件）。
import { useMemo } from 'react'

import type { TakeoffRow } from '../services/kernel'

interface GroupProps {
  group: { key: string; rows: TakeoffRow[]; subtotals: Record<string, number> }
  valueKeys: string[]
  t: (key: string) => string
  expanded: Set<string>
  onToggle: (guid: string) => void
  onSelect?: (guid: string) => void
}

export function GroupRows({ group, valueKeys, t, expanded, onToggle, onSelect }: GroupProps) {
  // 全为子构件的组不显示小计行（子构件不计入合计，避免出现空小计）
  const hasSubtotal = Object.keys(group.subtotals).length > 0
  return (
    <>
      <tr className="takeoff-group-header">
        <td colSpan={3 + valueKeys.length}>▼ {group.key || t('takeoff.ungrouped')}</td>
      </tr>
      <TreeRows rows={group.rows} valueKeys={valueKeys} t={t} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
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
  onSelect?: (guid: string) => void
}

/** 按 parent_guid 把平铺行组成父子层级：父行默认折叠只显示汇总，点 ▸ 展开子构件明细。 */
export function TreeRows({ rows, valueKeys, t, expanded, onToggle, onSelect }: TreeProps) {
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
          onSelect={onSelect}
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
  onSelect?: (guid: string) => void
}

function RowNode({ row, depth, childrenOf, valueKeys, t, expanded, onToggle, onSelect }: NodeProps) {
  const kids = childrenOf.get(row.guid) ?? []
  const open = expanded.has(row.guid)
  return (
    <>
      <tr
        className={depth > 0 ? 'takeoff-row-child takeoff-row-click' : 'takeoff-row-click'}
        onClick={() => onSelect?.(row.guid)}
        title={t('takeoff.locateHint')}
      >
        <td>
          <span className="takeoff-name-cell" style={{ paddingLeft: depth * 18 }}>
            {kids.length > 0 ? (
              <button
                className="takeoff-expander"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(row.guid)
                }}
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
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

/** 数值单元格格式化：空值占位、数字最多 6 位小数、布尔转是 / 否。 */
export function formatCell(value: unknown, t: (key: string) => string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6)
  if (typeof value === 'boolean') return value ? t('takeoff.yes') : t('takeoff.no')
  return String(value)
}
