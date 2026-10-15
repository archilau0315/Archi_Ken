// Autorun 持久化（L3，M11）：文件型存储。
// 任务：<数据目录>/autorun/tasks/<id>.json（原子写入）；
// 运行记录：<数据目录>/autorun/runs/<run_id>/run.json + 同目录产物文件（自包含，便于整体分发）。

import { promises as fs } from 'fs'
import { join } from 'path'

import type {
  AutorunRun,
  AutorunRunSummary,
  AutorunTask,
  AutorunTaskInput,
  AutorunTaskSummary
} from './model'

// 数据目录：默认进程工作目录下 .data，可用环境变量覆盖。
const DATA_DIR = process.env.ARCHIKEN_DATA_DIR ?? join(process.cwd(), '.data')
const TASK_DIR = join(DATA_DIR, 'autorun', 'tasks')
const RUN_DIR = join(DATA_DIR, 'autorun', 'runs')

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/

function taskFile(id: string): string {
  return join(TASK_DIR, `${id}.json`)
}

/** 运行目录（run.json 与产物都在里面）。 */
export function runDir(runId: string): string {
  return join(RUN_DIR, runId)
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(TASK_DIR, { recursive: true })
  await fs.mkdir(RUN_DIR, { recursive: true })
}

/** 生成安全且唯一的任务 id（英文名转 slug，中文名回退到时间戳）。 */
function makeTaskId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  const stamp = Date.now().toString(36)
  return base ? `${base}-${stamp}` : `task-${stamp}`
}

/** 生成运行 id：run-<时间戳36>-<随机4位>。 */
export function makeRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** 原子写入 JSON（先写临时文件再 rename）。 */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

/** 列出全部任务摘要（按更新时间倒序）。 */
export async function listTasks(): Promise<AutorunTaskSummary[]> {
  await ensureDirs()
  const names = await fs.readdir(TASK_DIR)
  const items: AutorunTaskSummary[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const task = await readJson<AutorunTask>(join(TASK_DIR, name))
    if (!task) continue
    items.push({
      id: task.id,
      name: task.name,
      models: task.models.length,
      ruleset_id: task.ruleset_id,
      formats: task.formats,
      updated_at: task.updated_at
    })
  }
  return items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

/** 读取单个任务；不存在返回 null。 */
export async function getTask(id: string): Promise<AutorunTask | null> {
  if (!ID_RE.test(id)) return null
  return readJson<AutorunTask>(taskFile(id))
}

/** 保存（新建或覆盖）任务；返回落库后的完整对象。 */
export async function saveTask(input: AutorunTaskInput): Promise<AutorunTask> {
  await ensureDirs()
  const id = input.id ?? makeTaskId(input.name)
  if (!ID_RE.test(id)) {
    const err = new Error(`非法任务 id：${id}`) as Error & { status: number }
    err.status = 400
    throw err
  }
  const task: AutorunTask = {
    id,
    name: input.name,
    models: input.models,
    ruleset_id: input.ruleset_id,
    include_clash: input.include_clash,
    formats: input.formats,
    output_dir: input.output_dir,
    updated_at: new Date().toISOString()
  }
  await writeJsonAtomic(taskFile(id), task)
  return task
}

/** 删除任务；返回是否确实删除（不影响历史运行记录）。 */
export async function deleteTask(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false
  try {
    await fs.unlink(taskFile(id))
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

/** 写入运行记录（run.json 落在 run 目录内）。 */
export async function saveRun(run: AutorunRun): Promise<void> {
  const dir = runDir(run.id)
  await fs.mkdir(dir, { recursive: true })
  await writeJsonAtomic(join(dir, 'run.json'), run)
}

/** 读取运行记录；不存在返回 null。 */
export async function getRun(runId: string): Promise<AutorunRun | null> {
  if (!ID_RE.test(runId)) return null
  return readJson<AutorunRun>(join(runDir(runId), 'run.json'))
}

/** 列出运行记录摘要（可按任务过滤，按开始时间倒序）。 */
export async function listRuns(taskId?: string): Promise<AutorunRunSummary[]> {
  await ensureDirs()
  const names = await fs.readdir(RUN_DIR)
  const items: AutorunRunSummary[] = []
  for (const name of names) {
    const run = await readJson<AutorunRun>(join(RUN_DIR, name, 'run.json'))
    if (!run) continue
    if (taskId && run.task_id !== taskId) continue
    items.push({
      id: run.id,
      task_id: run.task_id,
      task_name: run.task_name,
      started_at: run.started_at,
      status: run.status,
      totals: run.totals
    })
  }
  return items.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
}
