import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'

// Electron 主进程 —— 本地编排器（见架构设计 L3/L4 之间的桥接层）。
// 职责：拉起 Python 计算内核（L2）、创建主窗口、为渲染进程转发内核/业务服务请求。

// 与 src/services/transport.ts 中同名类型结构保持一致（electron 独立编译，不跨目录引用）。
interface ServiceRequest {
  target: 'kernel' | 'server'
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

interface RawResponse {
  status: number
  contentType: string
  text: string
}

const KERNEL_HOST = '127.0.0.1'
const KERNEL_PORT = 4319
const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 4318

const BASE_URL: Record<ServiceRequest['target'], string> = {
  kernel: `http://${KERNEL_HOST}:${KERNEL_PORT}`,
  server: `http://${SERVER_HOST}:${SERVER_PORT}`
}

let kernel: ChildProcess | null = null
let win: BrowserWindow | null = null

/** 启动 Python 计算内核（L2）。开发期直接使用系统 python，正式版改为随包分发。 */
function startKernel(): void {
  const entry = path.join(app.getAppPath(), 'kernel', 'main.py')
  kernel = spawn('python', [entry, '--host', KERNEL_HOST, '--port', String(KERNEL_PORT)], {
    stdio: 'inherit'
  })
  kernel.on('exit', (code) => {
    console.log(`[archiken] 内核进程退出，code=${code ?? 'null'}`)
    kernel = null
  })
}

function stopKernel(): void {
  if (kernel && !kernel.killed) {
    kernel.kill()
  }
  kernel = null
}

/** 转发一次服务请求（L3/L2），返回原始响应供渲染进程解析。 */
async function forward(spec: ServiceRequest): Promise<RawResponse> {
  const base = BASE_URL[spec.target]
  if (!base) throw new Error(`未知的服务目标：${String(spec.target)}`)

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(spec.query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  const url = `${base}${spec.path}${query ? `?${query}` : ''}`

  const init: RequestInit = { method: spec.method }
  if (spec.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(spec.body)
  }

  const res = await fetch(url, init)
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text: await res.text() }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'ArchiKen 筑审通',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('archiken:forward', (_event, spec: ServiceRequest) => forward(spec))

/** 打开原生文件选择对话框，返回选中文件的绝对路径（桌面端添加 IFC 用）。 */
ipcMain.handle('archiken:openFile', async () => {
  const result = await dialog.showOpenDialog(win ?? new BrowserWindow({ show: false }), {
    title: '选择 IFC 模型文件',
    properties: ['openFile'],
    filters: [
      { name: 'IFC 模型', extensions: ['ifc', 'ifczip'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

app.whenReady().then(() => {
  startKernel()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopKernel()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', stopKernel)
