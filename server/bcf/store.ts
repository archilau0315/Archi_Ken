// 沟通问题持久化（L3）：<数据目录>/issues/<id>.json，快照 <数据目录>/issues/snapshots/<id>.png。
// 原子写入（先写临时文件再 rename），与规则集存储保持一致。

import { promises as fs } from 'fs'
import { join } from 'path'

import type { CommIssue } from './model'

// 数据目录：默认进程工作目录下 .data，可用环境变量覆盖（供 BCF 导出复用）。
export const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? join(process.cwd(), '.data')
const ISSUE_DIR = join(DATA_DIR, 'issues')
const SNAPSHOT_DIR = join(ISSUE_DIR, 'snapshots')

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/

function fileOf(id: string): string {
  return join(ISSUE_DIR, `${id}.json`)
}

function snapshotOf(id: string): string {
  return join(SNAPSHOT_DIR, `${id}.png`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(ISSUE_DIR, { recursive: true })
}

async function readIssue(id: string): Promise<CommIssue | null> {
  try {
    const text = await fs.readFile(fileOf(id), 'utf8')
    return JSON.parse(text) as CommIssue
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** 列出全部问题（按创建时间倒序）。 */
export async function listIssues(): Promise<CommIssue[]> {
  await ensureDir()
  const names = await fs.readdir(ISSUE_DIR)
  const items: CommIssue[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const issue = await readIssue(name.slice(0, -5))
    if (issue) items.push(issue)
  }
  return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

/** 读取单个问题；不存在返回 null。 */
export async function getIssue(id: string): Promise<CommIssue | null> {
  if (!ID_RE.test(id)) return null
  return readIssue(id)
}

/** 保存（新建或覆盖）问题；返回落库后的完整对象。 */
export async function saveIssue(issue: CommIssue): Promise<CommIssue> {
  await ensureDir()
  const tmp = `${fileOf(issue.id)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(issue, null, 2), 'utf8')
  await fs.rename(tmp, fileOf(issue.id))
  return issue
}

/** 删除问题及其快照；返回是否确实删除了问题文件。 */
export async function deleteIssue(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false
  let deleted = false
  try {
    await fs.unlink(fileOf(id))
    deleted = true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  try {
    await fs.unlink(snapshotOf(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  return deleted
}

/** 写入快照 PNG；返回文件路径。 */
export async function saveSnapshotFile(id: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true })
  await fs.writeFile(snapshotOf(id), buffer)
  return snapshotOf(id)
}

/** 读取快照 PNG；不存在或问题无快照返回 null。 */
export async function readSnapshot(id: string, hasSnapshot: boolean): Promise<Buffer | null> {
  if (!hasSnapshot || !ID_RE.test(id)) return null
  try {
    return await fs.readFile(snapshotOf(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}
