// 融合模型树（L4 / M1）：渲染「模型 → 空间层级」，节点附带专业分布标签。

import { useState } from 'react'

import { useT } from '../i18n'
import type { DisciplineDef, FederatedTreeNode } from '../services/kernel'

export interface FederationTreeProps {
  roots: FederatedTreeNode[]
  disciplines: DisciplineDef[]
}

/** 专业分布小标签（按专业色描边）。 */
function DisciplineChips({ counts, defs }: { counts: Record<string, number>; defs: DisciplineDef[] }) {
  const byKey = new Map(defs.map((def) => [def.key, def]))
  return (
    <div className="disc-chips">
      {Object.entries(counts).map(([key, count]) => {
        const def = byKey.get(key)
        return (
          <span key={key} className="disc-chip" style={{ borderColor: def?.color ?? '#9b7ff2' }}>
            <span className="disc-dot" style={{ background: def?.color ?? '#9b7ff2' }} />
            {def?.name ?? key} {count}
          </span>
        )
      })}
    </div>
  )
}

function NodeView({ node, defs }: { node: FederatedTreeNode; defs: DisciplineDef[] }) {
  const { t } = useT()
  const [open, setOpen] = useState(node.kind === 'model' || (node.depth ?? 0) < 2)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className={`tree-row${hasChildren ? ' clickable' : ''}`}
        onClick={() => hasChildren && setOpen((value) => !value)}
      >
        <span className="tree-caret">{hasChildren ? (open ? '▾' : '▸') : '·'}</span>
        <span className={`tree-kind ${node.kind}`}>{node.kind === 'model' ? t('tree.kind.model') : node.ifc_type}</span>
        <span className="tree-name">{node.name || t('tree.unnamed')}</span>
        <span className="tree-meta">{node.element_total}</span>
      </div>
      {node.kind === 'model' && node.discipline_hint && (
        <div className="tree-sub">{t('tree.disciplineHint', { reason: node.discipline_hint.reason })}</div>
      )}
      {open && node.elements_by_discipline && Object.keys(node.elements_by_discipline).length > 0 && (
        <DisciplineChips counts={node.elements_by_discipline} defs={defs} />
      )}
      {open && hasChildren && (
        <ul className="tree-children">
          {node.children.map((child, index) => (
            <NodeView key={child.key ?? child.guid ?? `${node.key ?? 'n'}-${index}`} node={child} defs={defs} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function FederationTree({ roots, disciplines }: FederationTreeProps) {
  const { t } = useT()
  if (!roots.length) return <p className="hint">{t('tree.notLoaded')}</p>
  return (
    <ul className="tree">
      {roots.map((root, index) => (
        <NodeView key={root.key ?? root.name ?? `root-${index}`} node={root} defs={disciplines} />
      ))}
    </ul>
  )
}
