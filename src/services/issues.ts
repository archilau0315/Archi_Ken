// 业务服务客户端（L4 → L3）：沟通问题与 BCF 导出的类型化封装。

import type { ElementRef } from './kernel'
import { apiRequest } from './transport'

export type IssueSeverity = 'error' | 'warning' | 'info'
export type IssueStatus = 'open' | 'acknowledged' | 'resolved'

export interface IssueComment {
  id: string
  author: string
  text: string
  created_at: string
}

export interface CommIssue {
  id: string
  guid: string
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  category: string
  source: string
  model_path: string
  element: ElementRef | null
  related: ElementRef | null
  location: number[] | null
  has_snapshot: boolean
  comments: IssueComment[]
  created_at: string
  updated_at: string
}

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

export interface CommIssueFilter {
  status?: IssueStatus
  severity?: IssueSeverity
  source?: string
}

/** 列出沟通问题（可按状态 / 级别过滤）。 */
export function issuesList(filter: CommIssueFilter = {}): Promise<{ total: number; items: CommIssueSummary[] }> {
  return apiRequest({
    target: 'server',
    method: 'GET',
    path: '/issues/list',
    query: { status: filter.status ?? '', severity: filter.severity ?? '', source: filter.source ?? '' }
  })
}

/** 读取单个问题（含评论）。 */
export function issuesGet(id: string): Promise<CommIssue> {
  return apiRequest({ target: 'server', method: 'GET', path: '/issues/get', query: { id } })
}

/** 创建沟通问题。 */
export function issueCreate(
  input: {
    title: string
    description?: string
    severity?: IssueSeverity
    category?: string
    source?: string
    model_path?: string
    element?: ElementRef | null
  },
  lang?: 'zh' | 'en'
): Promise<CommIssue> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/create', body: { ...input, lang } })
}

/** 更新问题（状态生命周期 / 严重度等）。 */
export function issueUpdate(
  id: string,
  patch: Partial<Pick<CommIssue, 'title' | 'description' | 'severity' | 'status' | 'category'>>
): Promise<CommIssue> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/update', body: { id, ...patch } })
}

/** 删除问题。 */
export function issueDelete(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/delete', body: { id } })
}

/** 添加评论。 */
export function issueComment(id: string, text: string, author?: string, lang?: 'zh' | 'en'): Promise<CommIssue> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/comment', body: { id, text, author, lang } })
}

/** 附加视图快照（PNG dataURL）。 */
export function issueSnapshot(id: string, dataUrl: string): Promise<CommIssue> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/snapshot', body: { id, data_url: dataUrl } })
}

/** 把检查结果导入为沟通问题（按标题+构件去重）。 */
export function issuesImport(path: string): Promise<{ total: number; created: number; skipped: number }> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/import', body: { path } })
}

/** 导出 BCF 2.1（不传 ids 导出全部）。 */
export function issueBcfExport(ids?: string[], lang?: 'zh' | 'en'): Promise<{ path: string; topics: number }> {
  return apiRequest({ target: 'server', method: 'POST', path: '/issues/bcf/export', body: ids?.length ? { ids, lang } : { lang } })
}
