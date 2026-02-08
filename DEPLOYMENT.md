# 部署文档

## 📋 目录

- [系统要求](#系统要求)
- [环境准备](#环境准备)
- [生产环境部署](#生产环境部署)
- [开发环境部署](#开发环境部署)
- [配置说明](#配置说明)
- [常用命令](#常用命令)
- [故障排查](#故障排查)
- [维护更新](#维护更新)

---

## 系统要求

### 最低配置

- **操作系统**: Linux (推荐 Ubuntu 20.04+ / CentOS 7+)
- **Docker**: 20.10+
- **Docker Compose**: 1.29+ 或 Docker Compose V2
- **内存**: 2GB RAM (推荐 4GB+)
- **磁盘**: 10GB 可用空间
- **网络**: 80 端口可用

### 推荐配置

- **CPU**: 2 核心+
- **内存**: 4GB RAM+
- **磁盘**: 20GB+ SSD
- **网络**: 80, 443 端口可用（HTTPS）

---

## 环境准备

### 1. 安装 Docker

#### Ubuntu/Debian

```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

#### CentOS/RHEL

```bash
# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker Engine
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 2. 配置 Docker 用户权限（可选）

```bash
# 将当前用户添加到 docker 组（避免每次使用 sudo）
sudo usermod -aG docker $USER

# 重新登录或执行以下命令使权限生效
newgrp docker

# 验证权限
docker ps
```

### 3. 克隆项目

```bash
# 克隆项目（替换为实际仓库地址）
git clone <repository-url> suanshu
cd suanshu
```

---

## 生产环境部署

### 1. 配置环境变量(必要)

```bash
# 复制环境变量模板
cp .env.tmpl .env

# 编辑环境变量文件
nano .env  # 或使用 vim/vi
```

**必须配置的变量：**

```env
# 数据库配置
MYSQL_DATABASE=suanshu_db
MYSQL_ROOT_PASSWORD=your_strong_root_password
DB_DATABASE=suanshu_db
DB_USERNAME=suanshu_user
DB_PASSWORD=your_strong_db_password

# Redis 配置
REDIS_PASSWORD=your_strong_redis_password

# 应用配置
APP_ENV=production
APP_DEBUG=false
APP_URL=http://your-domain.com
APP_NAME=黄桥车队算数平台
```

### 2. 配置后端环境变量

**后端配置由部署脚本自动写入无需额外配置**


### 3. 构建前端

```bash
# 进入前端目录
cd frontend

# 安装依赖（在宿主机或容器内）
npm install

# 如果遇到 dist 目录权限问题，先修复权限
# 方法1：使用修复脚本（推荐）
./fix-build-permissions.sh

# 方法2：手动删除 dist 目录
rm -rf dist
# 或如果权限不足：
sudo rm -rf dist

# 构建生产版本（prebuild 脚本会自动清理 dist 目录）
npm run build

# 构建产物在 frontend/dist 目录
```

**注意**：如果 `dist` 目录是由 Docker 容器创建的，可能会出现权限问题。`prebuild` 脚本会自动处理，如果仍有问题，请使用 `fix-build-permissions.sh` 脚本。

### 4. 执行部署脚本

```bash
# 返回项目根目录
cd ..

# 赋予执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

**部署脚本会自动执行：**

1. ✅ 检查并创建 `.env` 文件
2. ✅ 启动所有 Docker 容器（数据库、Redis、后端、Nginx）
3. ✅ 检查并创建 `backend/.env` 文件
4. ✅ 安装 Composer 依赖
5. ✅ 生成 Laravel 应用密钥
6. ✅ 修复目录权限
7. ✅ 执行数据库迁移

### 5. 验证部署

```bash
# 检查容器状态
docker ps

# 应该看到以下容器运行中：
# - suanshu-db (MariaDB)
# - suanshu-redis (Redis)
# - suanshu-app (Laravel PHP-FPM)
# - suanshu-web (Nginx)

# 检查日志
docker logs suanshu-app
docker logs suanshu-web

# 访问应用
curl http://localhost
```

### 6. 配置域名（可选）

如果使用域名，需要：

1. **配置 DNS**: 将域名 A 记录指向服务器 IP
2. **修改 Nginx 配置**: 编辑 `.docker/nginx/prod.conf`，修改 `server_name`
3. **更新环境变量**: 修改 `.env` 中的 `APP_URL`
4. **重启容器**: `docker restart suanshu-web`

---

## 开发环境部署

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.tmpl .env

# 编辑环境变量（开发环境可以使用较简单的密码）
nano .env
```

**开发环境配置示例：**

```env
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost
```

### 2. 执行开发环境脚本

```bash
# 赋予执行权限
chmod +x dev.sh

# 启动开发环境
./dev.sh
```

**开发环境脚本会自动：**

1. ✅ 检查并创建 `.env` 文件
2. ✅ 启动所有容器（包括前端开发服务器）
3. ✅ 初始化 Laravel 环境
4. ✅ 启动前端热加载服务器

### 3. 访问开发环境

- **前端**: http://localhost
- **后端 API**: http://localhost/api
- **前端开发服务器**: 通过 Nginx 代理访问（统一 80 端口）

### 4. 开发提示

- ✅ 前端代码修改后自动热加载，无需重启
- ✅ 后端代码修改后需要重启容器：`docker restart suanshu-app`
- ✅ 查看前端日志：`docker logs -f suanshu-frontend`
- ✅ 查看后端日志：`docker logs -f suanshu-app`

---

## 配置说明

### Docker Compose 文件

- **`docker-compose.yml`**: 生产环境配置
  - MariaDB 数据库
  - Redis 缓存
  - Laravel PHP-FPM 后端
  - Nginx Web 服务器

- **`docker-compose.dev.yml`**: 开发环境扩展配置
  - Node.js 前端开发服务器
  - 开发模式 Nginx 配置

### Nginx 配置

- **`.docker/nginx/prod.conf`**: 生产环境配置
  - 静态文件服务
  - Laravel 路由代理

- **`.docker/nginx/dev.conf`**: 开发环境配置
  - 前端开发服务器代理
  - Laravel API 路由代理

### 数据持久化

以下目录/卷用于数据持久化：

- `./mysql_data`: MariaDB 数据目录
- `./redis_data`: Redis 数据目录
- `./logs/laravel`: Laravel 日志目录
- `./logs/nginx`: Nginx 日志目录
- `frontend_node_modules`: 前端依赖卷（开发环境）

---

## 常用命令

### 容器管理

```bash
# 启动所有容器
docker-compose up -d

# 停止所有容器
docker-compose down

# 重启容器
docker restart suanshu-app
docker restart suanshu-web

# 查看容器状态
docker ps
docker-compose ps

# 查看容器日志
docker logs -f suanshu-app
docker logs -f suanshu-web
docker logs -f suanshu-frontend  # 仅开发环境
```

### 数据库操作

```bash
# 进入数据库容器
docker exec -it suanshu-db bash

# 连接数据库
docker exec -it suanshu-db mysql -u root -p

# 执行数据库迁移
docker exec suanshu-app php artisan migrate

# 回滚迁移
docker exec suanshu-app php artisan migrate:rollback

# 查看迁移状态
docker exec suanshu-app php artisan migrate:status
```

### Laravel 命令

```bash
# 生成应用密钥
docker exec suanshu-app php artisan key:generate

# 清除缓存
docker exec suanshu-app php artisan cache:clear
docker exec suanshu-app php artisan config:clear
docker exec suanshu-app php artisan route:clear
docker exec suanshu-app php artisan view:clear

# 优化性能
docker exec suanshu-app php artisan config:cache
docker exec suanshu-app php artisan route:cache
docker exec suanshu-app php artisan view:cache

# 查看路由列表
docker exec suanshu-app php artisan route:list
```

### 前端操作

```bash
# 进入前端容器（开发环境）
docker exec -it suanshu-frontend sh

# 安装依赖（在容器内）
docker exec suanshu-frontend npm install

# 构建生产版本
cd frontend
npm run build

# 查看前端日志
docker logs -f suanshu-frontend
```

---

## 故障排查

### 1. 容器无法启动

```bash
# 查看容器日志
docker logs suanshu-app
docker logs suanshu-web

# 检查端口占用
netstat -tulpn | grep :80
sudo lsof -i :80

# 检查 Docker 服务状态
sudo systemctl status docker
```

### 2. 数据库连接失败

```bash
# 检查数据库容器状态
docker ps | grep suanshu-db

# 检查数据库日志
docker logs suanshu-db

# 测试数据库连接
docker exec -it suanshu-db mysql -u root -p

# 检查环境变量
docker exec suanshu-app env | grep DB_
```

### 3. 前端无法访问

```bash
# 检查前端容器状态（开发环境）
docker ps | grep suanshu-frontend

# 查看前端日志
docker logs -f suanshu-frontend

# 检查 Nginx 配置
docker exec suanshu-web cat /etc/nginx/conf.d/default.conf

# 测试 Nginx 配置
docker exec suanshu-web nginx -t

# 重启 Nginx
docker restart suanshu-web
```

### 4. 权限问题

```bash
# 修复 Laravel 目录权限
docker exec suanshu-app chmod -R 777 storage bootstrap/cache

# 修复日志目录权限（Linux）
sudo chmod -R 777 logs/

# 修复数据目录权限
sudo chmod -R 777 mysql_data redis_data
```

### 5. 内存不足

```bash
# 查看容器资源使用
docker stats

# 清理未使用的资源
docker system prune -a

# 限制容器内存（在 docker-compose.yml 中添加）
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

---

## 维护更新

### 1. 更新代码

```bash
# 拉取最新代码
git pull origin main

# 更新后端依赖
docker exec suanshu-app composer install --no-dev --optimize-autoloader

# 执行数据库迁移
docker exec suanshu-app php artisan migrate

# 清除缓存
docker exec suanshu-app php artisan config:clear
docker exec suanshu-app php artisan cache:clear

# 重新构建前端（生产环境）
cd frontend
npm install
npm run build
cd ..

# 重启容器
docker-compose restart
```

### 2. 备份数据

```bash
# 备份数据库
docker exec suanshu-db mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${DB_DATABASE} > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份 Redis 数据（可选）
docker exec suanshu-redis redis-cli --pass ${REDIS_PASSWORD} SAVE
docker cp suanshu-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d_%H%M%S).rdb

# 备份整个数据目录
tar -czf data_backup_$(date +%Y%m%d_%H%M%S).tar.gz mysql_data redis_data logs/
```

### 3. 恢复数据

```bash
# 恢复数据库
docker exec -i suanshu-db mysql -u root -p${MYSQL_ROOT_PASSWORD} ${DB_DATABASE} < backup_file.sql

# 恢复 Redis（可选）
docker cp redis_backup.rdb suanshu-redis:/data/dump.rdb
docker restart suanshu-redis
```

### 4. 监控和日志

```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app
docker-compose logs -f web

# 查看系统资源使用
docker stats

# 设置日志轮转（推荐）
# 在 docker-compose.yml 中添加日志配置
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"
```

### 5. 安全建议

1. **定期更新密码**: 修改 `.env` 中的数据库和 Redis 密码
2. **使用 HTTPS**: 配置 SSL 证书（Let's Encrypt）
3. **防火墙配置**: 只开放必要端口（80, 443）
4. **定期备份**: 设置自动备份脚本
5. **监控日志**: 定期检查错误日志
6. **更新依赖**: 定期更新 Docker 镜像和依赖包

---

## 快速参考

### 一键部署（生产环境）

```bash
# 1. 配置环境变量
cp .env.tmpl .env
nano .env

# 2. 构建前端
cd frontend && npm install && npm run build && cd ..

# 3. 执行部署
chmod +x deploy.sh && ./deploy.sh
```

### 一键启动（开发环境）

```bash
# 1. 配置环境变量
cp .env.tmpl .env
nano .env

# 2. 启动开发环境
chmod +x dev.sh && ./dev.sh
```

### 常用检查命令

```bash
# 检查所有服务状态
docker ps

# 检查服务健康
curl http://localhost
curl http://localhost/api/test

# 查看日志
docker-compose logs --tail=100
```

---

## 联系支持

如遇到问题，请提供以下信息：

1. 错误日志：`docker logs <container-name>`
2. 系统信息：`docker --version`, `docker compose version`
3. 环境变量：`.env` 文件（**注意：不要包含密码**）
4. 操作步骤：详细描述操作过程

作者信息
1. 作者名称: Chris
2. 联系邮箱: 274498190@qq.com

---

**最后更新**: 2026-02-09  
**文档版本**: 1.0.0
