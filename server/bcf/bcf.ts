// BCF 2.1 导出（L3）：把沟通问题打包为 openBIM BCF 2.1 zip。
// 结构：bcf.version + <topic-guid>/markup.bcf + 可选 <topic-guid>/snapshot.png。
// Topic 的 Guid/Title/Description 等为属性，评论为 <Comment> 元素（buildingSMART BCF 2.1）。

import { randomUUID } from 'crypto'
import { basename } from 'path'

import JSZip from 'jszip'

import type { CommIssue } from './model'

const BCF_VERSION_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1" DetailedVersion="2.1"/>'

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 内部状态映射为 BCF 常用 TopicStatus 文本。 */
function bcfStatus(issue: CommIssue): string {
  if (issue.status === 'acknowledged') return 'IN PROGRESS'
  return issue.status === 'resolved' ? 'CLOSED' : 'OPEN'
}

function markupXml(issue: CommIssue): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<Markup>']
  if (issue.model_path) {
    lines.push(`  <Header><File Filename="${esc(basename(issue.model_path))}"/></Header>`)
  }
  lines.push(
    `  <Topic Guid="${issue.guid}" TopicType="${esc(issue.category)}" TopicStatus="${bcfStatus(issue)}"` +
      ` Priority="${issue.severity}" Title="${esc(issue.title)}"` +
      ` CreationDate="${issue.created_at}" CreationAuthor="ArchiKen"` +
      ` Description="${esc(issue.description)}"/>`
  )
  for (const comment of issue.comments) {
    lines.push(
      `  <Comment Guid="${comment.id || randomUUID()}" Author="${esc(comment.author)}"` +
        ` Date="${comment.created_at}" Topic="${issue.guid}">${esc(comment.text)}</Comment>`
    )
  }
  lines.push('</Markup>', '')
  return lines.join('\n')
}

/** 打包 BCF 2.1 zip（内存中构建）。 */
export async function buildBcf(issues: CommIssue[], snapshots: Map<string, Buffer>): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('bcf.version', BCF_VERSION_XML)
  for (const issue of issues) {
    const folder = zip.folder(issue.guid) ?? zip
    folder.file('markup.bcf', markupXml(issue))
    const png = snapshots.get(issue.id)
    if (png) folder.file('snapshot.png', png)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
