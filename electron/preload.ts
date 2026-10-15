import { contextBridge, ipcRenderer } from 'electron'

// 渲染进程与主进程之间的最小桥接面（contextIsolation 开启，仅暴露白名单方法）。
// forward：把内核（L2）/ 业务服务（L3）的请求转交主进程执行，返回原始响应。
// openFile：弹出原生文件选择对话框，返回绝对路径（添加 IFC 用）。
contextBridge.exposeInMainWorld('archiken', {
  forward: (spec: unknown) => ipcRenderer.invoke('archiken:forward', spec),
  openFile: () => ipcRenderer.invoke('archiken:openFile')
})
