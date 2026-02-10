# 鉴权与用户角色设计

## 1. 角色与能力

| 角色 (role) | 说明           | Web 登录 | 小程序登录 | 录入 | 看统计 |
|-------------|----------------|----------|------------|------|--------|
| `admin`     | 常驻管理员     | ✅ 固定用户名 admin | 可选 | ✅ | ✅ |
| `daily_admin` | 日常管理员   | ✅ 一个账号         | ✅ 同一人 | ✅ | ✅ |
| `viewer`    | 仅小程序用户   | ❌       | ✅         | ❌   | ✅     |

- Web 端仅允许 `admin`、`daily_admin` 登录（校验密码 + role）。
- 录入接口仅允许 `admin`、`daily_admin`；统计/查看接口三角色均可（可按需再做数据范围限制）。
- 账目 `created_by_user_id` 指向 `users.id`，与端无关。

---

## 2. 表结构

### 2.1 users 表（在现有基础上扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 不变 |
| name | string | 显示名 |
| username | string nullable, unique | **Web 登录用**：admin 固定为 `admin`，日常管理员一个（如 `manager`），viewer 可为空 |
| email | string nullable | 可选；viewer 可无 |
| email_verified_at | timestamp nullable | 不变 |
| password | string nullable | **仅 Web 登录账号必填**；viewer 可为空 |
| role | string, default 'viewer' | `admin` \| `daily_admin` \| `viewer` |
| remember_token | string nullable | 不变 |
| timestamps | | 不变 |

约束（应用层或迁移注释）：

- `role in (admin, daily_admin)` 时 `username`、`password` 必填。
- Web 登录时只接受 `username` + 密码，且 `role` 为 admin 或 daily_admin。

### 2.2 user_wechat_bindings 表（预留小程序）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | |
| user_id | FK users.id | 关联用户 |
| app_id | string | 小程序 app_id |
| openid | string | 当前小程序下的 openid |
| unionid | string nullable | 同开放平台下多应用统一 id，建议存便于扩展 |
| nickname / avatar 等 | 可选 | 微信资料缓存 |
| timestamps | | |

唯一索引：`(app_id, openid)`，保证一个小程序内一个 openid 只绑一个 user。

---

## 3. Web 端密码如何设置

### 3.1 推荐方式：环境变量 + 首次 Seeder

- **admin**：固定用户名 `admin`，密码由环境变量提供，首次部署时通过 Seeder 写入。
- **日常管理员**：用户名与密码也由环境变量提供，Seeder 创建一条 `daily_admin` 用户。

环境变量示例（根目录或 `backend/.env`）：

```env
# Web 端初始账号（仅在执行 php artisan db:seed 时使用）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请修改为强密码

DAILY_ADMIN_USERNAME=manager
DAILY_ADMIN_PASSWORD=请修改为强密码
```

- 部署流程：复制 `.env.tmpl` 为 `.env`，填写上述四项 → 在容器内执行 `php artisan db:seed --class=UserSeeder`（或 `db:seed` 包含该 Seeder）。
- **安全**：生产环境务必使用强密码；Seeder 中若未设置或为空，应拒绝创建/更新，避免默认弱密码。

### 3.2 可选：Artisan 命令修改密码

便于后续改密、忘记密码时由运维在服务器执行：

```bash
php artisan user:set-password admin 新密码
php artisan user:set-password manager 新密码
```

实现方式：命令接收 `username` 与 `password`，查找 `User::where('username', $username)->first()`，仅允许对 `admin` / `daily_admin` 更新 `password`（Hash::make），避免误改 viewer。

### 3.3 不建议

- 在代码或仓库中写死密码。
- 使用过于简单的默认密码且生产可访问。

---

## 4. Token 来源（统计与审计）

- 签发时由**登录接口**决定来源，无需前端传参：
  - `POST /api/auth/login`（Web 账号密码）→ token 的 `name` 固定为 `web`；
  - `POST /api/auth/miniprogram/login`（小程序 code）→ token 的 `name` 固定为 `miniprogram`。
- 请求时从当前 token 读取：`$request->user()->currentAccessToken()->name` 或 `$request->user()->tokenSource()`，用于统计与审计。

---

## 5. 实现要点（不写具体代码，仅约定）

- **登录**：接收 `username` + `password`，用 `User::where('username', $username)->first()` 查用户；校验 `password` 与 `role in (admin, daily_admin)`，通过则发 Sanctum token（name=`web`），返回 `{ token, user }`。
- **中间件/策略**：  
  - 录入相关路由：`auth:sanctum` + `can.enter.data`（或校验 `user->canEnterData()`）。  
  - 统计/查看：`auth:sanctum` 即可（或再按数据范围过滤）。
- **小程序登录**（后续）：code → openid/unionid → 查 `user_wechat_bindings` 得 `user_id`；若无则按策略拒绝或由管理员在 Web 先建 viewer 再绑定；发 Sanctum token（name=`miniprogram`），接口侧同样用 `auth:sanctum` + role 判断能否录入。

---

## 6. 文件清单

| 内容 | 文件 |
|------|------|
| 角色/表/密码策略说明 | 本文档 `backend/docs/AUTH_DESIGN.md` |
| 迁移：users 增加 role、username；email/password 可空；微信绑定表 | `database/migrations/xxxx_add_roles_and_wechat_bindings.php` |
| User 模型：role、fillable、isAdmin、canEnterData 等 | `app/Models/User.php` |
| 微信绑定模型（预留） | `app/Models/UserWechatBinding.php` |
| 初始 admin + daily_admin | `database/seeders/UserSeeder.php`，由 DatabaseSeeder 调用 |
| 环境变量示例 | 根目录 `.env.tmpl`、`backend/.env.tmpl` 中增加 ADMIN_*、DAILY_ADMIN_* |
| 可选：改密命令 | `app/Console/Commands/SetUserPassword.php` |
| Sanctum token 表 | `database/migrations/2019_12_14_000001_create_personal_access_tokens_table.php` |
| Web/小程序登录、登出、当前用户 | `app/Http/Controllers/AuthController.php`，路由 `/api/auth/*` |
| 录入权限中间件 | `app/Http/Middleware/EnsureUserCanEnterData.php`，别名 `can.enter.data` |

以上为设计约定；具体代码在迁移、Seeder、命令、控制器与中间件中实现。
