#!/bin/bash

# ============================================
# 开发环境启动脚本
# 功能：启动包含前端热加载的开发环境
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ [SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️  [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}❌ [ERROR]${NC} $1"
}

# --- 1. 检查根目录 .env (Docker 环境变量来源) ---
log_info "检查根目录 .env 文件..."
if [ ! -f .env ]; then
    if [ -f .env.tmpl ]; then
        log_warn "根目录 .env 不存在，正在从模板创建..."
        cp .env.tmpl .env
        log_warn "请记得修改根目录 .env 里的数据库和 Redis 密码！"
    else
        log_error "缺少根目录 .env.tmpl"
        exit 1
    fi
fi

# --- 2. 检查前端目录是否存在 ---
if [ ! -d "frontend" ]; then
    log_error "frontend 目录不存在！"
    exit 1
fi

# --- 2.5. 检测 docker-compose 命令（兼容新旧版本）---
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    log_error "未找到 docker-compose 或 docker compose 命令！"
    exit 1
fi

# --- 3. 启动 Docker 容器服务（合并生产配置和开发配置）---
log_info "启动 Docker 容器服务..."
$DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans

# 等待容器启动
log_info "等待容器启动..."
sleep 3

# --- 4. 检查并生成 backend/.env (Laravel 框架必备) ---
log_info "检查容器内 Laravel 配置..."
docker exec suanshu-app sh -c '
    if [ ! -f .env ]; then
        echo "   -> 发现 backend/.env 缺失，正在从模板生成..."
        if [ -f .env.tmpl ]; then
            cp .env.tmpl .env
        else
            echo "   -> 警告：未找到 backend/.env.tmpl"
        fi
    fi
' 2>/dev/null || log_warn "Laravel 容器可能尚未完全启动，稍后请手动检查 backend/.env"

# --- 5. 生成 Key 与依赖安装 ---
log_info "初始化 Laravel 环境 (Key & Composer)..."
docker exec suanshu-app composer install --no-interaction || log_warn "Composer install 失败，请检查容器状态"
docker exec suanshu-app php artisan key:generate --force || log_warn "Key generate 失败，请检查容器状态"

# --- 6. 权限修复 ---
log_info "修复目录读写权限..."
docker exec suanshu-app chmod -R 777 storage bootstrap/cache || log_warn "权限修复失败，请检查容器状态"

# --- 7. 数据库迁移 ---
log_info "执行数据库迁移..."
docker exec suanshu-app php artisan migrate --force || log_warn "数据库迁移失败，请检查数据库连接"

# --- 8. 检查前端容器状态 ---
log_info "检查前端容器状态..."
if docker ps | grep -q suanshu-frontend; then
    log_success "前端容器运行中"
    log_info "前端开发服务器启动中，请稍候..."
    sleep 5
    
    # 检查前端容器日志
    if docker logs suanshu-frontend 2>&1 | grep -q "Local:"; then
        log_success "前端开发服务器已就绪"
    else
        log_warn "前端容器可能仍在启动中，请查看日志: docker logs -f suanshu-frontend"
    fi
else
    log_error "前端容器未运行！请检查: docker logs suanshu-frontend"
fi

# --- 9. 输出访问信息 ---
echo ""
echo "===================================================="
log_success "开发环境已就绪！"
echo "===================================================="
echo ""
echo "📱 前端访问地址："
echo "   - ${GREEN}http://localhost${NC} (统一通过 80 端口，与生产环境一致)"
echo ""
echo "🔧 后端 API 地址："
echo "   - ${GREEN}http://localhost/api${NC}"
echo ""
echo "📊 容器管理："
echo "   - 查看前端日志: ${BLUE}docker logs -f suanshu-frontend${NC}"
echo "   - 查看所有容器: ${BLUE}$DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml ps${NC}"
echo "   - 停止环境: ${BLUE}$DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml down${NC}"
echo ""
echo "💡 提示：前端代码修改后会自动热加载，无需重启容器"
echo "===================================================="
