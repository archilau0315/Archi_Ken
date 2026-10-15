// 文件上传路由（L4 浏览器开发期）：把前端选中的 IFC 等模型文件保存到 .data/uploads，返回服务端路径。
// Electron 桌面端直接用原生对话框拿绝对路径，无需上传。

import type { Context } from 'koa'
import fs from 'node:fs/promises'
import path from 'node:path'

import { tr, type Lang } from '../i18n'
import { readRawBody } from '../router'

function httpError(status: number, message: string): Error {
  const err = new Error(message)
  ;(err as { status?: number }).status = status
  return err
}

const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? path.join(process.cwd(), '.data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

const ALLOWED = new Set(['.ifc', '.ifczip', '.glb', '.gltf'])
const MAX_SIZE = 200 * 1024 * 1024 // 200MB

/** 内容魔数预检：拦截改了后缀的假文件，避免上传成功但解析必然失败。 */
function magicOk(ext: string, buf: Buffer): boolean {
  const head = buf.subarray(0, 128).toString('utf-8')
  if (ext === '.ifc') return head.startsWith('ISO-10303-21')
  if (ext === '.ifczip') return buf.subarray(0, 2).toString('latin1') === 'PK' // zip
  if (ext === '.glb') return head.startsWith('glTF')
  return head.trimStart().startsWith('{') // .gltf 是 JSON
}

/** 清洗文件名：只保留字母数字、中文、下划线、连字符、点。 */
function sanitize(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.\-]/g, '_').slice(0, 120) || 'model'
}

export async function uploadPost(ctx: Context): Promise<void> {
  const lang: Lang | undefined = ctx.query.lang === 'en' ? 'en' : undefined
  const name = sanitize((ctx.query.name as string) || 'model.ifc')
  const ext = path.extname(name).toLowerCase()
  if (!ALLOWED.has(ext)) {
    throw httpError(400, tr(lang, `不支持的文件类型：${ext}（支持 ${[...ALLOWED].join(' / ')}）`, `Unsupported file type: ${ext} (allowed: ${[...ALLOWED].join(' / ')})`))
  }

  const buf = await readRawBody(ctx)
  if (!buf.length) throw httpError(400, tr(lang, '文件内容为空', 'File content is empty'))
  if (buf.length > MAX_SIZE) {
    throw httpError(413, tr(lang, `文件过大（${(buf.length / 1048576).toFixed(1)}MB，上限 200MB）`, `File too large (${(buf.length / 1048576).toFixed(1)}MB, limit 200MB)`))
  }
  if (!magicOk(ext, buf)) {
    throw httpError(400, tr(lang, `文件内容与 .${ext.slice(1)} 格式不符（缺少格式头），请确认文件未损坏或后缀正确`, `File content does not match .${ext.slice(1)} format (missing format header); the file may be corrupt or misnamed`))
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const stamp = Date.now()
  const finalName = `${path.basename(name, ext)}-${stamp}${ext}`
  const target = path.join(UPLOAD_DIR, finalName)
  await fs.writeFile(target, buf)

  ctx.body = { path: target, name: finalName, size: buf.length }
}
