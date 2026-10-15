import Koa from 'koa'

import { createRouter } from './router'
import { autorunDelete, autorunGet, autorunList, autorunRun, autorunRunGet, autorunRuns, autorunSave } from './routes/autorun'
import { issueBcfExport, issueComment, issueCreate, issueDelete, issueGet, issueImport, issueList, issueSnapshot, issueUpdate } from './routes/issue'
import { reportExportPost, reportHtmlGet, reportRunGet, reportRunPost } from './routes/report'
import { rulesetDelete, rulesetGet, rulesetList, rulesetRun, rulesetSave } from './routes/ruleset'
import { uploadPost } from './routes/upload'

// 业务逻辑层（L3）服务：编排内核（L2）结果并产出检查报告。
// 已实现：健康检查、结果与报告服务（/report/* 含 M9 PDF/Excel 导出）、规则集管理（/ruleset/*）、
// 沟通与 BCF（/issues/*）、Autorun 批量检查（/autorun/*，M11）。
// 后续按计划接入：检查任务状态机、报告持久化。

const PORT = Number(process.env.ARCHIKEN_SERVER_PORT ?? 4318)
const HOST = process.env.ARCHIKEN_SERVER_HOST ?? '0.0.0.0'
const SERVICE_VERSION = '0.6.0'

/**
 * API Key 鉴权中间件（可选）：仅当环境变量 ARCHIKEN_API_KEY 设置时启用。
 * 客户端请求需携带 Authorization: Bearer <key> 头。
 * /health 端点免鉴权（健康检查用）。
 */
function apiKeyGuard(): Koa.Middleware {
  const expected = process.env.ARCHIKEN_API_KEY
  if (!expected) {
    // 未配置密钥时直接放行（本地开发模式）
    return async (_ctx, next) => next()
  }
  return async (ctx, next) => {
    if (ctx.path === '/health') {
      await next()
      return
    }
    const auth = ctx.get('Authorization')
    if (auth !== `Bearer ${expected}`) {
      ctx.status = 401
      ctx.body = { error: 'unauthorized', detail: '缺少或错误的 API Key' }
      return
    }
    await next()
  }
}

const router = createRouter()
router.get('/health', (ctx) => {
  ctx.body = { status: 'ok', service: 'archiken-server', version: SERVICE_VERSION, build: process.env.ARCHIKEN_BUILD_ID ?? 'dev' }
})
router.get('/report/run', reportRunGet)
router.post('/report/run', reportRunPost)
router.get('/report/html', reportHtmlGet)
router.post('/report/export', reportExportPost)
router.get('/ruleset/list', rulesetList)
router.get('/ruleset/get', rulesetGet)
router.post('/ruleset/save', rulesetSave)
router.post('/ruleset/delete', rulesetDelete)
router.post('/ruleset/run', rulesetRun)
router.get('/issues/list', issueList)
router.get('/issues/get', issueGet)
router.post('/issues/create', issueCreate)
router.post('/issues/update', issueUpdate)
router.post('/issues/delete', issueDelete)
router.post('/issues/comment', issueComment)
router.post('/issues/snapshot', issueSnapshot)
router.post('/issues/import', issueImport)
router.post('/issues/bcf/export', issueBcfExport)
router.get('/autorun/list', autorunList)
router.get('/autorun/get', autorunGet)
router.post('/autorun/save', autorunSave)
router.post('/autorun/delete', autorunDelete)
router.post('/autorun/run', autorunRun)
router.get('/autorun/runs', autorunRuns)
router.get('/autorun/run/get', autorunRunGet)
router.post('/upload', uploadPost)

const app = new Koa()
app.use(apiKeyGuard())
app.use(router.middleware())

app.listen(PORT, HOST, () => {
  const apiKeyInfo = process.env.ARCHIKEN_API_KEY ? ' (API Key enabled)' : ' (no auth — local mode)'
  console.log(`[archiken-server] v${SERVICE_VERSION} listening on http://${HOST}:${PORT}${apiKeyInfo}`)
})
