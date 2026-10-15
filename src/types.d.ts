import type { RawResponse, ServiceRequest } from './services/transport'

export interface ArchiKenBridge {
  forward: (spec: ServiceRequest) => Promise<RawResponse>
  /** 打开原生文件选择对话框，返回绝对路径（Electron 桌面端）。 */
  openFile: () => Promise<string | null>
}

declare global {
  interface Window {
    /** Electron 预加载脚本注入的桥接面；浏览器开发期不存在。 */
    archiken?: ArchiKenBridge
  }

  /** 构建期注入的项目根目录（绝对路径，正斜杠），用于定位示例模型。 */
  const __PROJECT_ROOT__: string

  /** 构建期注入的应用版本号（取自 package.json version）。 */
  const __APP_VERSION__: string
}
