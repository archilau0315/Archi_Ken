import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 渲染进程（L4 UI 层）构建配置。
// base 使用相对路径，保证 Electron 通过 file:// 加载打包产物时不丢资源。
// 浏览器开发期通过 /api/kernel、/api/server 代理到本机内核（L2）与业务服务（L3）。
// 构建模式由 VITE_APP_MODE 控制：electron=桌面端默认、web=本地浏览器、cloud=云端生产。
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __PROJECT_ROOT__: JSON.stringify(process.cwd().replace(/\\/g, '/')),
    'import.meta.env.VITE_APP_MODE': JSON.stringify(process.env.VITE_APP_MODE ?? 'electron')
  },
  server: {
    port: 5173,
    proxy: {
      '/api/kernel': {
        target: 'http://127.0.0.1:4319',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kernel/, '')
      },
      '/api/server': {
        target: 'http://127.0.0.1:4318',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/server/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 构建时注入版本号和构建 ID，供部署后验证版本一致性用
    rollupOptions: {
      output: {
        // 保留 index.html 以便部署脚本读取 version/build hash
        entryFileNames: 'assets/index-[hash].js'
      }
    }
  }
})
