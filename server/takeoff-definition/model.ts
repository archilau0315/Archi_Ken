// 信息提取用户模板数据模型与结构校验（L3）。
// 模板本体与内核 /takeoff/run 请求参数对齐；此处只做结构级校验，
// 表达式语法合法性由内核在运行时报告。

import { tr, type Lang } from '../i18n'

// 与内核 extract.py 的 _GROUP_KEYS 保持一致。
export const GROUP_KEYS = ['container', 'ifc_type', 'layer_role', 'layer_material'] as const
export type GroupKey = (typeof GROUP_KEYS)[number]

/** 自定义计算列（与内核 columns 规格一致）。 */
export interface TakeoffColumn {
  key: string
  name: string
  /** 计量单位，表头展示为「面积 (m²)」；缺省则不显示括号。 */
  unit?: string
  expr: string
}

/** 用户模板：完整持久化形态。 */
export interface TakeoffDefinition {
  id: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns: TakeoffColumn[]
  group_by: GroupKey | ''
  updated_at: string
}

/** 列表摘要（不含 columns 本体）。 */
export interface TakeoffDefinitionSummary {
  id: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns_count: number
  group_by: GroupKey | ''
  updated_at: string
}

/** 保存请求体（id 缺省 = 新建）。 */
export interface TakeoffDefinitionInput {
  id?: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns: TakeoffColumn[]
  group_by: GroupKey | ''
}

export class TakeoffDefinitionError extends Error {
  status = 400
}

function fail(message: string): never {
  throw new TakeoffDefinitionError(message)
}

function checkColumn(raw: unknown, index: number, lang: Lang | undefined): TakeoffColumn {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(tr(lang, `第 ${index + 1} 列必须是对象`, `Column #${index + 1} must be an object`))
  const col = raw as Record<string, unknown>
  const key = typeof col.key === 'string' ? col.key.trim() : ''
  const expr = typeof col.expr === 'string' ? col.expr.trim() : ''
  if (!key) fail(tr(lang, `第 ${index + 1} 列缺少 key`, `Column #${index + 1} is missing key`))
  if (!expr) fail(tr(lang, `列「${key}」缺少表达式 expr`, `Column "${key}" is missing expr`))
  const name = typeof col.name === 'string' && col.name.trim() ? col.name.trim() : key
  const unit = typeof col.unit === 'string' ? col.unit.trim() : ''
  return unit ? { key, name, unit, expr } : { key, name, expr }
}

/** 校验并规范化保存请求体，返回可直接入库的输入。 */
export function normalizeTakeoffDefinition(raw: unknown, lang?: Lang): TakeoffDefinitionInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(tr(lang, '请求体必须是对象', 'Request body must be an object'))
  const body = raw as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) fail(tr(lang, '缺少模板名称 name', 'Missing definition name'))
  const columns = body.columns
  if (!Array.isArray(columns) || columns.length === 0) fail(tr(lang, 'columns 必须是非空数组', 'columns must be a non-empty array'))
  const parsedCols = columns.map((col, index) => checkColumn(col, index, lang))
  const keys = parsedCols.map((col) => col.key)
  if (new Set(keys).size !== keys.length) fail(tr(lang, '列 key 不能重复', 'Column keys must be unique'))
  let groupBy: GroupKey | '' = ''
  if (typeof body.group_by === 'string' && body.group_by) {
    if (!GROUP_KEYS.includes(body.group_by as GroupKey)) {
      fail(tr(lang, `group_by 不合法：${body.group_by}（可选 ${GROUP_KEYS.join('/')}）`, `Invalid group_by: ${body.group_by} (allowed: ${GROUP_KEYS.join('/')})`))
    }
    groupBy = body.group_by as GroupKey
  }
  const ifcTypes = Array.isArray(body.ifc_types)
    ? body.ifc_types.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim())
    : []
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'mine'
  return { id, name, description, category, ifc_types: ifcTypes, columns: parsedCols, group_by: groupBy }
}
