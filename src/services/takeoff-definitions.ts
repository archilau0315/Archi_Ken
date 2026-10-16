// 信息提取用户模板客户端（L4 → L3）：模板的保存/复用。

import type { TakeoffColumn } from './kernel'
import { apiRequest } from './transport'

export type TakeoffGroupKey = 'container' | 'ifc_type' | 'layer_role' | 'layer_material' | ''

export interface MyTakeoffDefinitionSummary {
  id: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns_count: number
  group_by: TakeoffGroupKey
  updated_at: string
}

export interface MyTakeoffDefinition {
  id: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns: TakeoffColumn[]
  group_by: TakeoffGroupKey
  updated_at: string
}

export interface MyTakeoffDefinitionInput {
  id?: string
  name: string
  description: string
  category: string
  ifc_types: string[]
  columns: TakeoffColumn[]
  group_by: TakeoffGroupKey
}

/** 我的模板摘要列表（按更新时间倒序）。 */
export function listMyDefinitions(): Promise<{ total: number; items: MyTakeoffDefinitionSummary[] }> {
  return apiRequest({ target: 'server', method: 'GET', path: '/takeoff-definitions/list' })
}

/** 读取单个我的模板（含 columns 本体）。 */
export function getMyDefinition(id: string): Promise<MyTakeoffDefinition> {
  return apiRequest({ target: 'server', method: 'GET', path: '/takeoff-definitions/get', query: { id } })
}

/** 保存（新建或覆盖）我的模板。 */
export function saveMyDefinition(input: MyTakeoffDefinitionInput, lang?: 'zh' | 'en'): Promise<MyTakeoffDefinition> {
  return apiRequest({ target: 'server', method: 'POST', path: '/takeoff-definitions/save', body: { ...input, lang } })
}

/** 删除我的模板。 */
export function deleteMyDefinition(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiRequest({ target: 'server', method: 'POST', path: '/takeoff-definitions/delete', body: { id } })
}
