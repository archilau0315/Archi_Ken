import { useT } from '../i18n'
import type { RuleSpec } from '../services/kernel'

// 单条规则编辑表单（L4）：按检查类型展示对应参数字段。
// 编辑结果通过 onChange 回传，父组件负责保存。

const CHECK_TYPES = ['property', 'intersection', 'clearance', 'headroom', 'dimension', 'duplicate']

const SEVERITIES = ['error', 'warning', 'info']

const OPS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'contains', 'startswith', 'endswith', 'matches', 'exists', 'not_exists']
const UNITS = ['model', 'm', 'cm', 'mm']
const MISSING = ['violation', 'pass', 'skip']
const AXES = ['x', 'y', 'z', 'all']
const DIM_AXES = ['x', 'y', 'z', 'min']

/** 把 ifc_type 字段（数组或字符串）转成逗号分隔文本。 */
export function typesToText(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') return value
  return '*'
}

/** 把逗号/空格分隔文本解析为 IFC 类型数组；空则回退为 ['*']。 */
export function parseTypes(text: string): string[] {
  const parts = text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : ['*']
}

/** 解析属性值：true/false→布尔，数字→数值，其余为字符串。 */
function parseValue(text: string): unknown {
  const t = text.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t)
  return t
}

function valueToText(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value)
}

function defaultCheck(type: string): { type: string; [key: string]: unknown } {
  if (type === 'intersection') return { type, other: { ifc_type: ['IfcWall'] } }
  if (type === 'clearance') return { type, other: { ifc_type: ['IfcSlab'] }, axis: 'z', value: 200, unit: 'mm' }
  if (type === 'headroom') return { type, other: { ifc_type: ['IfcSlab'] }, value: 2400, unit: 'mm' }
  if (type === 'dimension') return { type, axis: 'min', value: 1200, unit: 'mm' }
  if (type === 'duplicate') return { type, size_tolerance: 0.02, center_tolerance: 0.05 }
  return { type: 'property', pset: 'Pset_WallCommon', prop: 'IsExternal', op: '==', value: true }
}

interface Props {
  rule: RuleSpec
  onChange: (rule: RuleSpec) => void
  onRemove: () => void
}

export default function RuleEditor({ rule, onChange, onRemove }: Props) {
  const { t } = useT()
  const check = rule.check as Record<string, unknown>
  const other = (check.other ?? {}) as { ifc_type?: unknown }

  const set = (patch: Partial<RuleSpec>): void => onChange({ ...rule, ...patch })
  const setCheck = (patch: Record<string, unknown>): void => set({ check: { ...check, ...patch } as RuleSpec['check'] })
  const setOtherTypes = (text: string): void => setCheck({ other: { ifc_type: parseTypes(text) } })
  const changeType = (type: string): void => set({ check: defaultCheck(type) })

  return (
    <div className="rule-card">
      <div className="rule-head">
        <input
          className="path-input"
          value={rule.name ?? ''}
          placeholder={t('ruleset.rule.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
        />
        <select value={rule.severity ?? 'error'} onChange={(e) => set({ severity: e.target.value as RuleSpec['severity'] })}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {t('ruleset.severity.' + s)}
            </option>
          ))}
        </select>
        <button className="tiny ghost" onClick={onRemove}>
          {t('ruleset.rule.remove')}
        </button>
      </div>

      <div className="rule-grid">
        <label>
          {t('ruleset.rule.id')}
          <input value={rule.id} onChange={(e) => set({ id: e.target.value })} />
        </label>
        <label>
          {t('ruleset.rule.category')}
          <input value={rule.category ?? ''} onChange={(e) => set({ category: e.target.value })} />
        </label>
        <label>
          {t('ruleset.rule.targetTypes')}
          <input value={typesToText(rule.target.ifc_type)} onChange={(e) => set({ target: { ...rule.target, ifc_type: parseTypes(e.target.value) } })} />
        </label>
        <label>
          {t('ruleset.rule.checkType')}
          <select value={String(check.type)} onChange={(e) => changeType(e.target.value)}>
            {CHECK_TYPES.map((kind) => (
              <option key={kind} value={kind}>
                {t('ruleset.kind.' + kind)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {check.type === 'property' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.prop.pset')}
            <input value={String(check.pset ?? '')} onChange={(e) => setCheck({ pset: e.target.value })} />
          </label>
          <label>
            {t('ruleset.prop.name')}
            <input value={String(check.prop ?? '')} onChange={(e) => setCheck({ prop: e.target.value })} />
          </label>
          <label>
            {t('ruleset.prop.op')}
            <select value={String(check.op ?? '>=')} onChange={(e) => setCheck({ op: e.target.value })}>
              {OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ruleset.prop.value')}
            <input
              value={valueToText(check.value)}
              onChange={(e) => setCheck({ value: parseValue(e.target.value) })}
            />
          </label>
          <label>
            {t('ruleset.prop.unit')}
            <select value={String(check.unit ?? 'model')} onChange={(e) => setCheck({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ruleset.prop.missing')}
            <select value={String(check.missing ?? 'violation')} onChange={(e) => setCheck({ missing: e.target.value })}>
              {MISSING.map((m) => (
                <option key={m} value={m}>
                  {t('ruleset.missing.' + m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {check.type === 'intersection' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.intersection.otherTypes')}
            <input value={typesToText(other.ifc_type)} onChange={(e) => setOtherTypes(e.target.value)} />
          </label>
        </div>
      )}

      {check.type === 'clearance' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.clearance.otherTypes')}
            <input value={typesToText(other.ifc_type)} onChange={(e) => setOtherTypes(e.target.value)} />
          </label>
          <label>
            {t('ruleset.axis')}
            <select value={String(check.axis ?? 'all')} onChange={(e) => setCheck({ axis: e.target.value })}>
              {AXES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ruleset.clearance.min')}
            <input
              value={valueToText(check.value)}
              onChange={(e) => setCheck({ value: parseValue(e.target.value) })}
            />
          </label>
          <label>
            {t('ruleset.prop.unit')}
            <select value={String(check.unit ?? 'mm')} onChange={(e) => setCheck({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {check.type === 'headroom' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.headroom.otherTypes')}
            <input value={typesToText(other.ifc_type)} onChange={(e) => setOtherTypes(e.target.value)} />
          </label>
          <label>
            {t('ruleset.headroom.min')}
            <input
              value={valueToText(check.value)}
              onChange={(e) => setCheck({ value: parseValue(e.target.value) })}
            />
          </label>
          <label>
            {t('ruleset.prop.unit')}
            <select value={String(check.unit ?? 'mm')} onChange={(e) => setCheck({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {check.type === 'dimension' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.dimension.axis')}
            <select value={String(check.axis ?? 'min')} onChange={(e) => setCheck({ axis: e.target.value })}>
              {DIM_AXES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ruleset.dimension.min')}
            <input
              value={valueToText(check.value)}
              onChange={(e) => setCheck({ value: parseValue(e.target.value) })}
            />
          </label>
          <label>
            {t('ruleset.prop.unit')}
            <select value={String(check.unit ?? 'mm')} onChange={(e) => setCheck({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {check.type === 'duplicate' && (
        <div className="rule-grid">
          <label>
            {t('ruleset.duplicate.sizeTol')}
            <input
              value={valueToText(check.size_tolerance ?? 0.02)}
              onChange={(e) => setCheck({ size_tolerance: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            {t('ruleset.duplicate.centerTol')}
            <input
              value={valueToText(check.center_tolerance ?? 0.05)}
              onChange={(e) => setCheck({ center_tolerance: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
      )}

      <label className="rule-message">
        {t('ruleset.rule.messageTemplate')}
        <input value={rule.message ?? ''} onChange={(e) => set({ message: e.target.value })} />
      </label>
    </div>
  )
}
