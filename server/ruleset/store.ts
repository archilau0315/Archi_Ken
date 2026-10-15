// 规则集持久化（L3）：文件型存储，位于 <数据目录>/rulesets/<id>.json。
// 原子写入（先写临时文件再 rename），避免并发读损坏。

import { promises as fs } from 'fs'
import { join } from 'path'

import type { Ruleset, RulesetInput, RulesetSummary } from './model'

// 数据目录：默认进程工作目录下 .data，可用环境变量覆盖。
const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? join(process.cwd(), '.data')
const RULESET_DIR = join(DATA_DIR, 'rulesets')

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/

function fileOf(id: string): string {
  return join(RULESET_DIR, `${id}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(RULESET_DIR, { recursive: true })
}

/** 生成安全且唯一的规则集 id（英文名转 slug，中文名回退到时间戳）。 */
function makeId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  const stamp = Date.now().toString(36)
  return base ? `${base}-${stamp}` : `ruleset-${stamp}`
}

async function readRuleset(id: string): Promise<Ruleset | null> {
  try {
    const text = await fs.readFile(fileOf(id), 'utf8')
    return JSON.parse(text) as Ruleset
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** 列出全部规则集摘要（按更新时间倒序）。 */
export async function listRulesets(): Promise<RulesetSummary[]> {
  await ensureDir()
  const names = await fs.readdir(RULESET_DIR)
  const items: RulesetSummary[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const ruleset = await readRuleset(name.slice(0, -5))
    if (!ruleset) continue
    items.push({
      id: ruleset.id,
      name: ruleset.name,
      description: ruleset.description,
      rules_count: ruleset.rules.length,
      updated_at: ruleset.updated_at
    })
  }
  return items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

/** 读取单个规则集；不存在返回 null。 */
export async function getRuleset(id: string): Promise<Ruleset | null> {
  if (!ID_RE.test(id)) return null
  return readRuleset(id)
}

/** 保存（新建或覆盖）规则集；返回落库后的完整对象。 */
export async function saveRuleset(input: RulesetInput): Promise<Ruleset> {
  await ensureDir()
  const id = input.id ?? makeId(input.name)
  if (!ID_RE.test(id)) {
    const err = new Error(`非法规则集 id：${id}`) as Error & { status: number }
    err.status = 400
    throw err
  }
  const ruleset: Ruleset = {
    id,
    name: input.name,
    description: input.description,
    rules: input.rules,
    updated_at: new Date().toISOString()
  }
  const tmp = `${fileOf(id)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(ruleset, null, 2), 'utf8')
  await fs.rename(tmp, fileOf(id))
  return ruleset
}

/** 删除规则集；返回是否确实删除。 */
export async function deleteRuleset(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false
  try {
    await fs.unlink(fileOf(id))
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}
