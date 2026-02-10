/**
 * 开发环境代理：/api -> 后端
 * 生产环境由 Nginx 处理 /api，此处仅开发时生效
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  dev: {
    '/api/': {
      target: process.env.BACKEND_URL || 'http://127.0.0.1:80',
      changeOrigin: true,
    },
  },
};
