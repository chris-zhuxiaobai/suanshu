# 黄桥车队账目管理系统 - 前端

基于 **Ant Design Pro**（Umi Max + Pro 组件）的 React + TypeScript 中后台前端。

- 技术栈：Umi 4、Ant Design 5、@ant-design/pro-components、Pro 布局与权限
- 文档：[Ant Design Pro 开始使用](https://pro.ant.design/zh-CN/docs/getting-started)

## 开发与访问

- **Docker 开发环境（推荐）**：在项目根目录执行 `./dev.sh`，浏览器访问 **http://localhost**。前端由容器内 `npm install` + `npm run dev` 启动（Umi 默认端口 **8000**），Nginx 将 `/` 转发到前端、`/api` 转发到 Laravel。
- **仅本地跑前端**：在 `frontend` 目录执行 `npm install` 与 `npm run dev`，访问 **http://localhost:8000**。需自行解决 API：可设置环境变量 `BACKEND_URL`（如 `http://127.0.0.1:80`）使开发代理将 `/api` 转发到后端。

**IDE**：若 `node_modules` 由容器创建导致归属为 root，可执行：  
`docker exec suanshu-frontend chown -R $(id -u):$(id -g) /app/node_modules`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务（端口 8000） |
| `npm run build` | 构建生产产物到 `dist` |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | 类型检查 + 代码检查 |

## 目录与路由

- `config/`：Umi 配置（路由、代理、布局、主题等）
- `src/app.tsx`：运行时配置（getInitialState、layout、request）
- `src/pages/`：页面（`user/login` 登录、`Welcome` 欢迎页）
- `src/services/`：接口封装（如 `auth.ts`）
- `src/requestErrorConfig.ts`：请求拦截与 401 处理、Token 读写
