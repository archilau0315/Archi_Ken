// 业务服务客户端（L4 → L3）：碰撞审查状态的类型化封装。
// 状态存服务端（按模型路径），重跑碰撞后按状态键回填标记。

import { apiRequest } from './transport'

export type ClashStatus = 'new' | 'acknowledged' | 'ignored'

export interface ClashStatusEntry {
  status: ClashStatus
  updated_at: string
}

/** 碰撞状态键口径：mode|guid_a|guid_b（与检测结果顺序无关，重跑稳定）。 */
export function clashStatusKey(mode: string, guidA: string, guidB: string): string {
  return `${mode}|${guidA}|${guidB}`
}

/** 读取一个模型的全部碰撞状态。 */
export function clashStatusList(path: string): Promise<Record<string, ClashStatusEntry>> {
  return apiRequest({
    target: 'server',
    method: 'GET',
    path: '/clash/status/list',
    query: { path }
  })
}

/** 批量写入碰撞状态（status 传空串删除该键标记）。 */
export function clashStatusSet(
  path: string,
  entries: { key: string; status: ClashStatus | '' }[]
): Promise<{ saved: number }> {
  return apiRequest({
    target: 'server',
    method: 'POST',
    path: '/clash/status/set',
    body: { path, entries }
  })
}
