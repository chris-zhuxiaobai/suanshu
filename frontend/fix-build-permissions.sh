#!/bin/bash

# 修复构建权限问题
# 解决 dist 目录权限问题，允许宿主机构建

set -e

cd "$(dirname "$0")"

echo "🔧 修复构建目录权限..."

# 如果 dist 目录存在但权限不对，删除它
if [ -d "dist" ]; then
    echo "   -> 发现 dist 目录，检查权限..."
    
    # 尝试删除（如果权限允许）
    if rm -rf dist 2>/dev/null; then
        echo "   ✅ dist 目录已删除"
    else
        echo "   ⚠️  无法删除 dist 目录，尝试使用 sudo..."
        sudo rm -rf dist 2>/dev/null || {
            echo "   ❌ 无法删除 dist 目录，请手动执行："
            echo "      sudo rm -rf dist"
            exit 1
        }
        echo "   ✅ dist 目录已删除（使用 sudo）"
    fi
fi

# 创建新的 dist 目录（使用当前用户权限）
mkdir -p dist
echo "   ✅ dist 目录已创建（当前用户权限）"

echo ""
echo "✅ 权限修复完成！现在可以运行 npm run build"
