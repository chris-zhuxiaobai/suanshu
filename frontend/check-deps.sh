#!/bin/bash

# 检查并安装容器内的依赖
# 用于确保容器内的 node_modules 包含所有依赖

echo "🔍 检查前端容器状态..."

# 检查容器是否运行
if ! docker ps | grep -q suanshu-frontend; then
    echo "❌ 前端容器未运行，请先启动："
    echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend"
    exit 1
fi

echo "✅ 前端容器运行中"
echo ""
echo "📦 在容器内安装依赖..."

# 在容器内安装依赖
docker exec suanshu-frontend npm install

echo ""
echo "✅ 依赖安装完成！"
echo "💡 如果问题仍然存在，请重启容器："
echo "   docker restart suanshu-frontend"
