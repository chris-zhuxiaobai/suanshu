@echo off
chcp 65001
setlocal enabledelayedexpansion

echo [INFO] 1. 检查宿主机根目录 .env (Docker 启动必备)...
if not exist .env (
    if exist .env.example (
        echo [WARN] 根目录 .env 不存在，正在根据模板创建...
        copy .env.example .env
        echo [!] 请手动修改根目录 .env 中的数据库和 Redis 密码后再继续！
        pause
    ) else (
        echo [ERROR] 缺少根目录 .env.example，请修复后再运行。
        pause
        exit
    )
)

echo [INFO] 2. 启动 Docker 容器 (加载环境配置)...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans

echo [INFO] 3. 检查并生成 Laravel 内部配置 (backend/.env)...
:: 直接在容器内操作，解决权限和路径问题
docker exec suanshu-app sh -c "if [ ! -f .env ]; then cp .env.example .env && echo '   -> 已补全 backend/.env'; fi"

echo [INFO] 4. 初始化 Laravel 环境 (Key/依赖/迁移)...
docker exec suanshu-app php artisan key:generate
docker exec suanshu-app composer install
docker exec suanshu-app sh -c "chmod -R 777 storage bootstrap/cache"
docker exec suanshu-app php artisan migrate --force
docker exec suanshu-app php artisan config:clear

echo.
echo ======================================================
echo [SUCCESS] Windows 开发环境已就绪！
echo 前端地址: http://localhost
echo ======================================================
pause