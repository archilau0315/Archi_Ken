// Autorun 批量执行器（L3，M11）：一次触发，对任务内全部模型顺序执行
// 「规则（可选规则集）+ 碰撞」检查，按格式产出报告到运行目录，
// 可选把整份结果复制到分发目录（共享盘 / 交付目录）。

import { promises as fs } from 'fs'
import { basename, join } from 'path'

import { exportReport, runClash, runRules } from '../kernel-client'
import { buildReport, type Report } from '../report/aggregate'
import { renderReportHtml } from '../report/html'
import { getRuleset } from '../ruleset/store'
import type { RuleLike } from '../ruleset/model'
import type { AutorunRun, AutorunTask, RunItem, RunOutput } from './model'
import { makeRunId, runDir, saveRun, writeJsonAtomic } from './store'

/** 模型文件名转安全的基础名（去扩展名、非法字符转 -）。 */
function modelBase(path: string): string {
  const name = basename(path).replace(/\.[^.]+$/, '')
  return name.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 64) || 'model'
}

/** 把内核导出（.data/exports）的文件复制进运行目录并改名。 */
async function adoptExport(file: string, targetName: string, dir: string): Promise<RunOutput> {
  const target = join(dir, targetName)
  await fs.copyFile(file, target)
  const stat = await fs.stat(target)
  return { format: targetName.endsWith('.pdf') ? 'pdf' : 'xlsx', file: target, size: stat.size }
}

/** 单模型：检查 + 按格式产出报告。 */
async function runOne(
  model: string,
  rules: RuleLike[] | undefined,
  task: AutorunTask,
  dir: string
): Promise<RunItem> {
  const results = await runRules(model, undefined, rules)
  const clash = task.include_clash ? await runClash(model) : null
  const report: Report = buildReport(model, results, clash)
  const base = modelBase(model)
  const title = `${task.name} - ${base}`

  const outputs: RunOutput[] = []
  for (const format of task.formats) {
    if (format === 'pdf' || format === 'xlsx') {
      const exported = await exportReport(report, format, title)
      outputs.push(await adoptExport(exported.file, `${base}.${format}`, dir))
    } else if (format === 'html') {
      const file = join(dir, `${base}.html`)
      await fs.writeFile(file, renderReportHtml(report), 'utf8')
      outputs.push({ format, file, size: (await fs.stat(file)).size })
    } else {
      const file = join(dir, `${base}.json`)
      await writeJsonAtomic(file, report)
      outputs.push({ format, file, size: (await fs.stat(file)).size })
    }
  }
  return { model, status: 'ok', issues: report.summary.total, outputs }
}

/** 把运行目录全部文件复制到分发目录（<output_dir>/<run_id>/）。 */
async function distribute(runId: string, dir: string, outputDir: string): Promise<void> {
  const target = join(outputDir, runId)
  await fs.mkdir(target, { recursive: true })
  for (const name of await fs.readdir(dir)) {
    await fs.copyFile(join(dir, name), join(target, name))
  }
}

/** 执行任务：逐模型顺序跑批，单模型失败不中断整体，最后落 run.json 并可选分发。 */
export async function runTask(task: AutorunTask): Promise<AutorunRun> {
  let rules: RuleLike[] | undefined
  if (task.ruleset_id) {
    const ruleset = await getRuleset(task.ruleset_id)
    if (!ruleset) {
      const err = new Error(`规则集不存在：${task.ruleset_id}`) as Error & { status: number }
      err.status = 404
      throw err
    }
    rules = ruleset.rules
  }

  const runId = makeRunId()
  const dir = runDir(runId)
  await fs.mkdir(dir, { recursive: true })
  const startedAt = new Date().toISOString()

  const items: RunItem[] = []
  for (const model of task.models) {
    try {
      items.push(await runOne(model, rules, task, dir))
    } catch (err) {
      items.push({
        model,
        status: 'error',
        issues: 0,
        outputs: [],
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const ok = items.filter((item) => item.status === 'ok').length
  const run: AutorunRun = {
    id: runId,
    task_id: task.id,
    task_name: task.name,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: ok === 0 && items.length > 0 ? 'failed' : 'done',
    items,
    totals: {
      models: items.length,
      ok,
      failed: items.length - ok,
      issues: items.reduce((sum, item) => sum + item.issues, 0),
      files: items.reduce((sum, item) => sum + item.outputs.length, 0)
    },
    output_dir: task.output_dir
  }
  await saveRun(run)

  if (task.output_dir) {
    try {
      await distribute(runId, dir, task.output_dir)
    } catch (err) {
      // 分发失败不抹掉已生成的结果，仅在记录里标注。
      run.status = 'failed'
      run.items.push({
        model: '(分发)',
        status: 'error',
        issues: 0,
        outputs: [],
        error: `复制到分发目录失败：${err instanceof Error ? err.message : String(err)}`
      })
      await saveRun(run)
    }
  }
  return run
}
