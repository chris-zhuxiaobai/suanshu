#!/bin/bash

# --- 1. 检查根目录 .env (Docker 环境变量来源) ---
if [ ! -f .env ]; then
    if [ -f .env.tmpl ]; then
        echo "⚠️ [INFO] 根目录 .env 不存在，正在从模板创建..."
        cp .env.tmpl .env
        echo "💡 [HINT] 请记得修改根目录 .env 里的正式环境密码！"
    else
        echo "❌ [ERROR] 缺少根目录 .env.tmpl"
        exit 1
    fi
fi

# --- 1.5. 检测 docker-compose 命令（兼容新旧版本）---
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    log_error "未找到 docker-compose 或 docker compose 命令！"
    exit 1
fi

echo "🚀 [1/5] 启动 Docker 容器服务..."
mkdir -p logs/laravel logs/nginx
$DOCKER_COMPOSE_CMD up -d --build --remove-orphans

# --- 2. 检查并生成 backend/.env (Laravel 框架必备) ---
echo "📂 [2/5] 检查容器内 Laravel 配置..."
docker exec suanshu-app sh -c '
    if [ ! -f .env ]; then
        echo "   -> 发现 backend/.env 缺失，正在从模板生成..."
        cp .env.tmpl .env
    fi
'

# --- 3. 生成 Key 与 依赖安装 ---
echo "🔑 [3/5] 初始化 Laravel 环境 (Key & Composer)..."
docker exec suanshu-app composer install --no-dev --optimize-autoloader
docker exec suanshu-app php artisan key:generate

# --- 4. 权限修复 (Linux 环境核心) ---
echo "🔐 [4/5] 修复目录读写权限..."
chmod -R 777 logs 2>/dev/null || true
docker exec suanshu-app chmod -R 777 storage bootstrap/cache /var/www/html/backend/storage/logs

# --- 5. 数据库迁移与缓存优化 ---
echo "🗄️ [5/5] 执行数据库迁移与性能优化..."
docker exec suanshu-app php artisan migrate --force

echo "✅ [SUCCESS] 全量环境部署完成！"