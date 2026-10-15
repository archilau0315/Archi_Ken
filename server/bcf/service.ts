// 沟通问题业务逻辑（L3）：创建 / 更新 / 评论 / 快照 / 从报告导入 / BCF 导出编排。

import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { join } from 'path'

import { buildBcf } from './bcf'
import {
  normalizeCreate,
  normalizePatch,
  type CommIssue,
  type IssueComment,
  type IssueElement,
  type IssueSeverity
} from './model'
import { DATA_DIR, deleteIssue, getIssue, listIssues, readSnapshot, saveIssue, saveSnapshotFile } from './store'
import { buildReport } from '../report/aggregate'
import { tr, type Lang } from '../i18n'
import { runClash, runRules } from '../kernel-client'

const EXPORT_DIR = join(DATA_DIR, 'exports')

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

function makeIssueId(): string {
  return `iss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 创建沟通问题。 */
export async function createIssue(raw: unknown): Promise<CommIssue> {
  const input = normalizeCreate(raw)
  const now = new Date().toISOString()
  const issue: CommIssue = { ...input, id: makeIssueId(), guid: randomUUID(), has_snapshot: false, comments: [], created_at: now, updated_at: now }
  return saveIssue(issue)
}

/** 更新问题（状态生命周期 / 严重度 / 描述等）。 */
export async function updateIssue(id: string, raw: unknown): Promise<CommIssue> {
  const patch = normalizePatch(raw)
  const issue = await getIssue(id)
  if (!issue) throw httpError(404, `问题不存在：${id}`)
  return saveIssue({ ...issue, ...patch, updated_at: new Date().toISOString() })
}

/** 添加评论。 */
export async function addComment(id: string, author: string, text: string, lang?: Lang): Promise<CommIssue> {
  if (!text.trim()) throw httpError(400, tr(lang, '缺少评论文本 text', 'Missing comment text'))
  const issue = await getIssue(id)
  if (!issue) throw httpError(404, `问题不存在：${id}`)
  const comment: IssueComment = {
    id: randomUUID(),
    author: author.trim() || tr(lang, 'ArchiKen 用户', 'ArchiKen User'),
    text: text.trim(),
    created_at: new Date().toISOString()
  }
  issue.comments.push(comment)
  issue.updated_at = new Date().toISOString()
  return saveIssue(issue)
}

/** 删除问题（含快照）。 */
export async function removeIssue(id: string): Promise<boolean> {
  return deleteIssue(id)
}

const DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)\s*$/

/** 保存视图快照（PNG dataURL），写入文件并标记 has_snapshot。 */
export async function setSnapshot(id: string, dataUrl: string, lang?: Lang): Promise<CommIssue> {
  const match = DATA_URL_RE.exec(dataUrl.trim())
  if (!match) throw httpError(400, tr(lang, 'data_url 必须是 image/png 的 base64 dataURL', 'data_url must be a base64 PNG dataURL'))
  const buffer = Buffer.from(match[1], 'base64')
  if (!buffer.length) throw httpError(400, tr(lang, '快照数据为空', 'Snapshot data is empty'))
  const issue = await getIssue(id)
  if (!issue) throw httpError(404, `问题不存在：${id}`)
  await saveSnapshotFile(id, buffer)
  issue.has_snapshot = true
  issue.updated_at = new Date().toISOString()
  return saveIssue(issue)
}

/** 导入汇总结果。 */
export interface ImportSummary {
  total: number
  created: number
  skipped: number
}

/** 把一次检查报告导入为沟通问题；按「标题+构件 guid」去重，已存在的跳过。 */
export async function importFromModel(
  path: string,
  ruleIds?: string[],
  includeClash = true,
  lang?: string
): Promise<ImportSummary> {
  const rules = await runRules(path, ruleIds, undefined, lang)
  const clash = includeClash ? await runClash(path) : null
  const report = buildReport(path, rules, clash, lang)

  const existing = await listIssues()
  const seen = new Set(existing.map((item) => `${item.title}|${item.element?.guid ?? ''}`))
  let created = 0
  for (const item of report.issues) {
    const key = `${item.title}|${item.element?.guid ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const description = [item.reason, ...item.steps].filter(Boolean).join('\n')
    await createIssue({
      title: item.title,
      description,
      severity: item.severity as IssueSeverity,
      status: 'open',
      category: item.category,
      source: item.source,
      model_path: report.model_path,
      element: item.element as IssueElement | null,
      related: item.related as IssueElement | null,
      location: item.location
    })
    created += 1
  }
  return { total: report.summary.total, created, skipped: report.summary.total - created }
}

/** 导出 BCF 2.1；不传 ids 时导出全部问题。 */
export async function exportBcf(ids?: string[], lang?: Lang): Promise<{ path: string; topics: number }> {
  const all = await listIssues()
  const picked = ids && ids.length ? all.filter((item) => ids.includes(item.id)) : all
  if (!picked.length) throw httpError(400, tr(lang, '没有可导出的沟通问题', 'No communication issues to export'))

  const snapshots = new Map<string, Buffer>()
  for (const issue of picked) {
    const png = await readSnapshot(issue.id, issue.has_snapshot)
    if (png) snapshots.set(issue.id, png)
  }

  const zip = await buildBcf(picked, snapshots)
  await fs.mkdir(EXPORT_DIR, { recursive: true })
  const path = join(EXPORT_DIR, `issues-${Date.now().toString(36)}.bcf`)
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, zip)
  await fs.rename(tmp, path)
  return { path, topics: picked.length }
}
