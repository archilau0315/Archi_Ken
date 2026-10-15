// Autorun 批量检查数据模型（L3，M11）。
// 任务 = 一组模型 + 一个可选规则集 + 导出格式 + 可选分发目录；
// 运行记录 = 一次批量执行的结果清单（逐模型产物与统计）。

export type AutorunFormat = 'pdf' | 'xlsx' | 'html' | 'json'

export const FORMATS: AutorunFormat[] = ['pdf', 'xlsx', 'html', 'json']

/** 批量检查任务（可保存复用，一键无人值守执行）。 */
export interface AutorunTask {
  id: string
  name: string
  models: string[]
  ruleset_id: string | null
  include_clash: boolean
  formats: AutorunFormat[]
  output_dir: string | null
  updated_at: string
}

/** 列表用的轻量摘要。 */
export interface AutorunTaskSummary {
  id: string
  name: string
  models: number
  ruleset_id: string | null
  formats: AutorunFormat[]
  updated_at: string
}

/** 任务输入（保存请求体解析后的形态）。 */
export interface AutorunTaskInput {
  id?: string
  name: string
  models: string[]
  ruleset_id: string | null
  include_clash: boolean
  formats: AutorunFormat[]
  output_dir: string | null
}

/** 单个模型的产物文件信息。 */
export interface RunOutput {
  format: AutorunFormat
  file: string
  size: number
}

/** 单个模型的执行结果。 */
export interface RunItem {
  model: string
  status: 'ok' | 'error'
  issues: number
  outputs: RunOutput[]
  error?: string
}

/** 一次批量运行记录（同时作为 run 目录下的 manifest）。 */
export interface AutorunRun {
  id: string
  task_id: string
  task_name: string
  started_at: string
  finished_at: string
  status: 'done' | 'failed'
  items: RunItem[]
  totals: { models: number; ok: number; failed: number; issues: number; files: number }
  output_dir: string | null
}

/** 运行列表用的轻量摘要。 */
export interface AutorunRunSummary {
  id: string
  task_id: string
  task_name: string
  started_at: string
  status: 'done' | 'failed'
  totals: AutorunRun['totals']
}

/** Autorun 相关错误（携带 HTTP 状态码）。 */
export class AutorunError extends Error {
  status = 400
}

function fail(message: string): never {
  throw new AutorunError(message)
}

/** 校验并规范化任务保存请求体。 */
export function normalizeTask(raw: unknown): AutorunTaskInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('请求体必须是对象')
  const body = raw as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) fail('缺少任务名称 name')

  const modelsRaw = body.models
  if (!Array.isArray(modelsRaw) || modelsRaw.length === 0) fail('models 必须是非空数组（IFC 绝对路径）')
  const models = modelsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
  if (!models.length) fail('models 必须是非空数组（IFC 绝对路径）')

  const formatsRaw = body.formats
  if (!Array.isArray(formatsRaw) || formatsRaw.length === 0) {
    fail(`formats 必须是非空数组（可选 ${FORMATS.join('/')}）`)
  }
  const formats = formatsRaw.map((item) => String(item)) as AutorunFormat[]
  for (const format of formats) {
    if (!FORMATS.includes(format)) fail(`不支持的导出格式：${format}（可选 ${FORMATS.join('/')}）`)
  }

  const rulesetId =
    typeof body.ruleset_id === 'string' && body.ruleset_id.trim() ? body.ruleset_id.trim() : null
  const outputDir =
    typeof body.output_dir === 'string' && body.output_dir.trim() ? body.output_dir.trim() : null
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined

  return {
    id,
    name,
    models,
    ruleset_id: rulesetId,
    include_clash: body.include_clash !== false,
    formats: [...new Set(formats)],
    output_dir: outputDir
  }
}
