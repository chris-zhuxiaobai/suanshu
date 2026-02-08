import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 注意：前端容器不暴露端口到宿主机，统一通过 Nginx (80端口) 访问
    // API 请求会直接发送到当前域名，由 Nginx 处理 /api 路由
    // 以下代理配置保留作为备用（如果未来需要直接访问 5173 端口时使用）
    proxy: {
      '/api': {
        target: 'http://suanshu-web:80',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
})
