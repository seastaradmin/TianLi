import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendProxyTarget = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    // 使用自定义 HTML 页面
    open: '/pure.html',
    // 让 dev 直接代理到真实后端，前端统一走 /api。
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4177,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: { target: ['es2021', 'chrome100', 'safari13'] },
  // 测试配置
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
