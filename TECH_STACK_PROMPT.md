# 算数 (suanshu) 项目 — 技术栈与约定

> 本文档供 AI 助手与开发者记忆项目技术栈，对话时可 @TECH_STACK_PROMPT.md 引用。

---

## 1. 项目概览

- **项目名**: 黄桥车队账目管理系统 (suanshu)
- **形态**: 前后端分离 Web 应用，Docker 编排，开发/生产统一通过 Nginx 80 端口访问
- **前端入口**: `http://localhost/` → Nginx → 前端 (开发时为 Umi Max 开发服务器，生产为静态 dist)
- **后端 API 根路径**: `http://localhost/api` → Nginx → Laravel (PHP-FPM)

---

## 2. 后端技术栈

| 项目 | 版本/选型 |
|------|------------|
| 框架 | **Laravel** 12.x |
| PHP | **8.4** (容器内 PHP-FPM) |
| 运行时 | PHP-FPM，由 Nginx 通过 FastCGI 转发 |
| 包管理 | Composer（镜像：阿里云 mirrors.aliyun.com） |
| 测试 | PHPUnit 11，Unit + Feature；测试环境默认 SQLite `:memory:`、array session/cache |

### 2.1 后端目录与约定

- 应用代码: `backend/app/`（Controllers、Models、Providers）
- 路由: `backend/routes/web.php`（当前 API 以 `/api` 前缀由 Nginx 挂载到 `backend/public`）
- 配置: `backend/config/`（database、cache、session、queue、logging 等）
- 迁移/种子: `backend/database/migrations`、`database/seeders`
- 环境: 根目录 `.env` 供 Docker；容器内使用 `backend/.env`（可由 `backend/.env.tmpl` 生成）

### 2.2 后端依赖要点

- `laravel/framework` ^12.0
- `laravel/tinker` ^2.10
- 开发: Laravel Sail、Pint、Pail、PHPUnit、Faker、Collision 等
- 数据库驱动: 生产/开发使用 **MariaDB**（Laravel 中 `DB_CONNECTION=mariadb`）；测试用 SQLite
- 缓存/会话: 生产可用 Redis；Session 配置为 `database`，Queue 为 `database`，Cache 在 .env.tmpl 中为 `database`（可改为 redis）
- Redis: 使用 `phpredis` 扩展（容器 Dockerfile 中已安装）

---

## 3. 前端技术栈

| 项目 | 版本/选型 |
|------|------------|
| 框架 | **React** 19.x + Umi Max 4.x |
| 语言 | **TypeScript** ~5.9 |
| 构建/开发服务器 | **Umi Max dev server** (默认 8000) |
| UI 组件库 | **Ant Design** 5.x (antd) + @ant-design/pro-components |
| HTTP 客户端 | **axios**（后续可迁移到 Umi request） |
| 代码规范 | ESLint 9 + TypeScript ESLint、React Hooks/Refresh 插件 |

### 3.1 前端目录与约定

- 源码: `frontend/src/`（`app.tsx`、`pages/`、`services/`、`utils/` 等 Umi 约定式目录）
- Umi 配置: `frontend/config/`（`config.ts`、`routes.ts`、`proxy.ts`、`defaultSettings.ts`）
- 构建输出: `frontend/dist`（生产由 Nginx 挂载提供静态资源）
- API 封装: `frontend/src/services/` 与 `frontend/src/requestErrorConfig.ts` — 默认 `baseURL: '/api'`，Bearer token 从 `localStorage`/`sessionStorage` 的 `auth_token` 读取，统一拦截器处理 `{ code, message, data }` 与 401/403/404/5xx

### 3.2 前端脚本

- `npm run dev` — Umi Max 开发服务器（容器内 `0.0.0.0:8000`）
- `npm run build` — `max build`
- `npm run lint` — `tsc --noEmit && max lint`
- `npm run preview` — `max preview`

---

## 4. 数据与缓存

| 角色 | 技术 | 说明 |
|------|------|------|
| 主库 | **MariaDB** 12.0 | Docker 服务名 `db`，端口 3306，数据卷 `./mysql_data` |
| 缓存/会话可选 | **Redis** 8-alpine | Docker 服务名 `redis`，需配置 `REDIS_PASSWORD`，PHP 使用 phpredis |

- 数据库连接由根目录 `.env` 传入（`DB_CONNECTION`、`DB_DATABASE`、`DB_USERNAME`、`DB_PASSWORD` 等），容器内 Laravel 使用 `DB_HOST=db`、`REDIS_HOST=redis`。

---

## 5. 运维与部署

### 5.1 Docker 编排

- **基础栈**: `docker-compose.yml`  
  - `db`: MariaDB 12.0  
  - `redis`: Redis 8-alpine（带密码）  
  - `app`: 后端 PHP-FPM（`.docker/php` 构建，PHP 8.4，pdo_mysql/mbstring/gd/redis 等）  
  - `web`: Nginx Alpine，端口 80，挂载 `backend`、`frontend/dist` 及 Nginx 配置  

- **开发叠加**: `docker-compose.dev.yml`  
  - `frontend`: Node 24-alpine，挂载 `frontend` 目录，`npm run dev -- --host 0.0.0.0`；`node_modules` 使用命名卷 `frontend_node_modules`  
  - `web` 使用 `dev.conf`：`/` 反代到 `suanshu-frontend:5173`，`/api` 仍走 Laravel  

- 开发启动: 根目录 `./dev.sh`（检查 .env、启动 compose、容器内 `composer install`、`artisan key:generate`、迁移、权限等）。

### 5.2 Nginx 路由约定

- **开发**（`dev.conf`）:  
  - `location /` → `http://suanshu-frontend:8000`（Umi Max 开发服务器）  
  - `location /api` → Laravel `backend/public`，PHP 交给 `suanshu-app:9000`  

- **生产**（`prod.conf`）: 静态站与 API 由同一 Nginx 提供；前端为 `frontend/dist`，API 仍为 `/api` → Laravel。

### 5.3 环境变量

- **根目录 `.env`**: Docker 与 Laravel 共用来源（如 `MYSQL_*`、`DB_*`、`REDIS_*`、`APP_*`）；无则从 `.env.tmpl` 复制。  
- **backend/.env**: 容器内 Laravel 使用；可由 `backend/.env.tmpl` 生成，其中 `DB_HOST=db`、`REDIS_HOST=redis`。

---

## 6. 开发与协作约定

- **API 风格**: 前端期望后端 JSON 形如 `{ code?, message?, data }`；成功常用 `code` 200/0，业务错误用非 200/0；前端 `api.ts` 会解包 `data` 并统一处理 401/403/404/5xx。  
- **认证**: Bearer Token，key 为 `auth_token`，存于 localStorage 或 sessionStorage。  
- **后端新增 API**: 在 `backend/routes/web.php`（或后续 API 路由文件）中定义；URL 以 `/api` 为前缀由 Nginx 暴露，前端直接请求 `/api/xxx`。  
- **文档**: 部署与流程见 `DEPLOYMENT.md`；后端说明见 `backend/README.md`，前端见 `frontend/README.md`。

---

## 7. 关键文件速查

| 用途 | 路径 |
|------|------|
| 开发一键启动 | `./dev.sh` |
| Docker 基础 + 开发 | `docker-compose.yml` + `docker-compose.dev.yml` |
| 后端入口 | `backend/public/index.php` |
| 后端路由 | `backend/routes/web.php` |
| 前端 API 封装 | `frontend/src/utils/api.ts` |
| 前端入口 | `frontend/src/app.tsx`（Umi 约定式入口） |
| Nginx 开发/生产 | `.docker/nginx/dev.conf`、`.docker/nginx/prod.conf` |
| PHP 镜像 | `.docker/php/Dockerfile` |
| 环境模板 | 根目录 `.env.tmpl`、`backend/.env.tmpl` |

---

使用建议：在 Cursor 中可将本文件加入 `.cursor/rules` 或对话时使用 `@TECH_STACK_PROMPT.md`，以便助手始终基于上述技术栈与约定回答问题与改代码。
