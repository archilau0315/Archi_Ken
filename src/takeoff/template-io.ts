// 信息提取模板 JSON 导入导出（L4 本地文件交互）。
// 导入兼容三种形态：包裹 {definition} / 裸对象 / 数组（与规则集导入约定一致）；
// id 一律丢弃——导入即新建，避免意外覆盖已有模板。

import type { TakeoffColumn } from '../services/kernel'
import type { MyTakeoffDefinitionInput, TakeoffGroupKey } from '../services/takeoff-definitions'

/** 把模板序列化为下载用的 JSON 文本（不含 id / updated_at）。 */
export function serializeTemplate(input: MyTakeoffDefinitionInput): string {
  return JSON.stringify(
    {
      name: input.name,
      description: input.description,
      category: input.category,
      ifc_types: input.ifc_types,
      columns: input.columns,
      group_by: input.group_by
    },
    null,
    2
  )
}

/** 触发浏览器下载 JSON 文本。 */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 解析导入文件文本为模板输入列表；结构与 L3 校验对齐（name 非空 + columns 非空才收）。 */
export function parseTemplateFile(text: string): MyTakeoffDefinitionInput[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const inputs: MyTakeoffDefinitionInput[] = []
  for (const item of collect(parsed)) {
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const columns = Array.isArray(item.columns) ? (item.columns as TakeoffColumn[]) : []
    if (!name || !columns.length) continue
    inputs.push({
      name,
      description: typeof item.description === 'string' ? item.description : '',
      category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'mine',
      ifc_types: Array.isArray(item.ifc_types)
        ? item.ifc_types.filter((s): s is string => typeof s === 'string')
        : [],
      columns,
      group_by: typeof item.group_by === 'string' ? (item.group_by as TakeoffGroupKey) : ''
    })
  }
  return inputs
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function collect(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed.filter(isPlainObject)
  if (!isPlainObject(parsed)) return []
  if (isPlainObject(parsed.definition)) return [parsed.definition]
  if (Array.isArray(parsed.definitions)) return parsed.definitions.filter(isPlainObject)
  return [parsed]
}
