import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { 
    port: 1420, 
    strictPort: true,
    // 代理 SSE 请求到测试服务器（开发环境）
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: { target: ['es2021', 'chrome100', 'safari13'] },
  // 测试配置
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
