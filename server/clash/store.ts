// 碰撞状态持久化（L3）：文件型存储，位于 <数据目录>/clash-status/<路径哈希>.json。
// 一个模型一个文件，重跑碰撞后前端按状态键（mode|guid_a|guid_b）回填标记。
// 原子写入（先写临时文件再 rename），避免并发读损坏。

import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'

import { CLASH_STATUSES, type ClashStatus, type ClashStatusEntry, type ClashStatusFile } from './model'

const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? join(process.cwd(), '.data')
const STORE_DIR = join(DATA_DIR, 'clash-status')

/** 状态键：mode|guid_a|guid_b（与检测顺序无关，重跑稳定）。 */
export function clashKeyOf(mode: string, guidA: string, guidB: string): string {
  return `${mode}|${guidA}|${guidB}`
}

function fileOf(modelPath: string): string {
  const hash = createHash('sha1').update(modelPath).digest('hex').slice(0, 16)
  return join(STORE_DIR, `${hash}.json`)
}

async function readFile(modelPath: string): Promise<ClashStatusFile> {
  try {
    const text = await fs.readFile(fileOf(modelPath), 'utf8')
    const parsed = JSON.parse(text) as ClashStatusFile
    return parsed.statuses ? parsed : { path: modelPath, statuses: {} }
  } catch {
    return { path: modelPath, statuses: {} }
  }
}

async function writeFile(file: ClashStatusFile): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true })
  const target = fileOf(file.path)
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, JSON.stringify(file, null, 2), 'utf8')
  await fs.rename(tmp, target)
}

/** 读取一个模型的全部碰撞状态。 */
export async function getStatuses(modelPath: string): Promise<Record<string, ClashStatusEntry>> {
  const file = await readFile(modelPath)
  return file.statuses
}

/** 批量写入碰撞状态（合并进现有表）；返回写入条数。status 传空串表示删除该键。 */
export async function setStatuses(modelPath: string, entries: { key: string; status: ClashStatus | '' }[]): Promise<number> {
  if (!modelPath) {
    const err = new Error('缺少模型路径') as Error & { status: number }
    err.status = 400
    throw err
  }
  const file = await readFile(modelPath)
  let saved = 0
  for (const entry of entries) {
    if (!entry.key) continue
    if (entry.status === '') {
      delete file.statuses[entry.key]
      saved += 1
      continue
    }
    if (!CLASH_STATUSES.includes(entry.status)) continue
    file.statuses[entry.key] = { status: entry.status, updated_at: new Date().toISOString() }
    saved += 1
  }
  await writeFile(file)
  return saved
}
