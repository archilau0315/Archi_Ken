// 沟通问题（CommIssue）数据模型与结构校验（L3）。
// 问题生命周期 / 评论 / 快照 / BCF 导出共用的类型与规范化。

import { tr } from '../i18n'

export type IssueSeverity = 'error' | 'warning' | 'info'
export type IssueStatus = 'open' | 'acknowledged' | 'resolved'

export const SEVERITIES: IssueSeverity[] = ['error', 'warning', 'info']
export const STATUSES: IssueStatus[] = ['open', 'acknowledged', 'resolved']

/** 元素引用（与内核 ElementRef 对齐）。 */
export interface IssueElement {
  guid: string
  name: string | null
  ifc_type: string
}

/** 一条评论。 */
export interface IssueComment {
  id: string
  author: string
  text: string
  created_at: string
}

/** 沟通问题完整对象（落库形态）。 */
export interface CommIssue {
  id: string
  guid: string // BCF topic GUID
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  category: string
  source: string // rule | clash | manual
  model_path: string
  element: IssueElement | null
  related: IssueElement | null
  location: number[] | null
  has_snapshot: boolean
  comments: IssueComment[]
  created_at: string
  updated_at: string
}

/** 列表用轻量摘要。 */
export interface CommIssueSummary {
  id: string
  guid: string
  title: string
  severity: IssueSeverity
  status: IssueStatus
  category: string
  source: string
  has_snapshot: boolean
  comments_count: number
  created_at: string
  updated_at: string
}

/** 创建输入（POST /issues/create 请求体）。 */
export interface CommIssueInput {
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  category: string
  source: string
  model_path: string
  element: IssueElement | null
  related: IssueElement | null
  location: number[] | null
}

/** 更新补丁（POST /issues/update 请求体，出现的字段才会更新）。 */
export interface CommIssuePatch {
  title?: string
  description?: string
  severity?: IssueSeverity
  status?: IssueStatus
  category?: string
  element?: IssueElement | null
  related?: IssueElement | null
  location?: number[] | null
}

/** 沟通问题相关错误（携带 HTTP 状态码）。 */
export class IssueError extends Error {
  status = 400
}

function fail(message: string): never {
  throw new IssueError(message)
}

function parseElement(raw: unknown, field: string): IssueElement | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) fail(`${field} 必须是对象或 null`)
  const el = raw as Record<string, unknown>
  if (typeof el.guid !== 'string' || !el.guid.trim()) fail(`${field}.guid 缺失`)
  return {
    guid: el.guid.trim(),
    name: typeof el.name === 'string' ? el.name : null,
    ifc_type: typeof el.ifc_type === 'string' ? el.ifc_type : ''
  }
}

function parseLocation(raw: unknown): number[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw) || raw.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    fail('location 必须是数值数组或 null')
  }
  return raw as number[]
}

/** 校验并规范化创建请求体。 */
export function normalizeCreate(raw: unknown): CommIssueInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(tr(undefined, '请求体必须是对象', 'Request body must be an object'))
  const body = raw as Record<string, unknown>
  const lang = body.lang === 'en' ? 'en' : undefined
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) fail(tr(lang, '缺少标题 title', 'Missing title'))
  const severity = SEVERITIES.includes(body.severity as IssueSeverity) ? (body.severity as IssueSeverity) : 'warning'
  const status = STATUSES.includes(body.status as IssueStatus) ? (body.status as IssueStatus) : 'open'
  const defaultCategory = tr(lang, '沟通问题', 'Communication Issue')
  return {
    title,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    severity,
    status,
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : defaultCategory,
    source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'manual',
    model_path: typeof body.model_path === 'string' ? body.model_path.trim() : '',
    element: parseElement(body.element, 'element'),
    related: parseElement(body.related, 'related'),
    location: parseLocation(body.location)
  }
}

/** 校验并规范化更新补丁。 */
export function normalizePatch(raw: unknown): CommIssuePatch {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('请求体必须是对象')
  const body = raw as Record<string, unknown>
  const patch: CommIssuePatch = {}
  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) fail('标题 title 不能为空')
    patch.title = title
  }
  if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.trim() : ''
  if (body.severity !== undefined) {
    if (!SEVERITIES.includes(body.severity as IssueSeverity)) {
      fail(`severity 不合法：${String(body.severity)}（可选 ${SEVERITIES.join('/')}）`)
    }
    patch.severity = body.severity as IssueSeverity
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as IssueStatus)) {
      fail(`status 不合法：${String(body.status)}（可选 ${STATUSES.join('/')}）`)
    }
    patch.status = body.status as IssueStatus
  }
  if (body.category !== undefined) {
    patch.category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : '沟通问题'
  }
  if (body.element !== undefined) patch.element = parseElement(body.element, 'element')
  if (body.related !== undefined) patch.related = parseElement(body.related, 'related')
  if (body.location !== undefined) patch.location = parseLocation(body.location)
  return patch
}

/** 转列表摘要。 */
export function toSummary(issue: CommIssue): CommIssueSummary {
  return {
    id: issue.id,
    guid: issue.guid,
    title: issue.title,
    severity: issue.severity,
    status: issue.status,
    category: issue.category,
    source: issue.source,
    has_snapshot: issue.has_snapshot,
    comments_count: issue.comments.length,
    created_at: issue.created_at,
    updated_at: issue.updated_at
  }
}
