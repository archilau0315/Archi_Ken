// 信息提取用户模板持久化（L3）：文件型存储，位于 <数据目录>/takeoff-definitions/<id>.json。
// 原子写入（先写临时文件再 rename），避免并发读损坏。

import { promises as fs } from 'fs'
import { join } from 'path'

import type { TakeoffDefinition, TakeoffDefinitionInput, TakeoffDefinitionSummary } from './model'

const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? join(process.cwd(), '.data')
const STORE_DIR = join(DATA_DIR, 'takeoff-definitions')

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/

function fileOf(id: string): string {
  return join(STORE_DIR, `${id}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true })
}

/** 生成安全且唯一的模板 id（英文名转 slug，中文名回退到时间戳）。 */
function makeId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  const stamp = Date.now().toString(36)
  return base ? `${base}-${stamp}` : `takeoff-${stamp}`
}

async function readDefinition(id: string): Promise<TakeoffDefinition | null> {
  try {
    const text = await fs.readFile(fileOf(id), 'utf8')
    return JSON.parse(text) as TakeoffDefinition
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** 列出全部用户模板摘要（按更新时间倒序）。 */
export async function listDefinitions(): Promise<TakeoffDefinitionSummary[]> {
  await ensureDir()
  const names = await fs.readdir(STORE_DIR)
  const items: TakeoffDefinitionSummary[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const def = await readDefinition(name.slice(0, -5))
    if (!def) continue
    items.push({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      ifc_types: def.ifc_types,
      columns_count: def.columns.length,
      group_by: def.group_by,
      updated_at: def.updated_at
    })
  }
  return items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

/** 读取单个模板；不存在返回 null。 */
export async function getDefinition(id: string): Promise<TakeoffDefinition | null> {
  if (!ID_RE.test(id)) return null
  return readDefinition(id)
}

/** 保存（新建或覆盖）模板；返回落库后的完整对象。 */
export async function saveDefinition(input: TakeoffDefinitionInput): Promise<TakeoffDefinition> {
  await ensureDir()
  const id = input.id ?? makeId(input.name)
  if (!ID_RE.test(id)) {
    const err = new Error(`非法模板 id：${id}`) as Error & { status: number }
    err.status = 400
    throw err
  }
  const definition: TakeoffDefinition = {
    id,
    name: input.name,
    description: input.description,
    category: input.category,
    ifc_types: input.ifc_types,
    columns: input.columns,
    group_by: input.group_by,
    updated_at: new Date().toISOString()
  }
  const tmp = `${fileOf(id)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(definition, null, 2), 'utf8')
  await fs.rename(tmp, fileOf(id))
  return definition
}

/** 删除模板；返回是否确实删除。 */
export async function deleteDefinition(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false
  try {
    await fs.unlink(fileOf(id))
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}
