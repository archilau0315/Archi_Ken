// 碰撞状态类型（L3）：与冲突矩阵检测解耦的审查生命周期标记。

export type ClashStatus = 'new' | 'acknowledged' | 'ignored'

export const CLASH_STATUSES: ClashStatus[] = ['new', 'acknowledged', 'ignored']

/** 单条碰撞的持久化状态（键为 mode|guid_a|guid_b）。 */
export interface ClashStatusEntry {
  status: ClashStatus
  updated_at: string
}

/** 一个模型的碰撞状态表（文件内容）。 */
export interface ClashStatusFile {
  path: string
  statuses: Record<string, ClashStatusEntry>
}
