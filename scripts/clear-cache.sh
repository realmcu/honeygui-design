#!/bin/bash

# 清理所有缓存文件和目录
# 用于解决调试过程中的缓存问题

echo "========================================"
echo "开始清理缓存..."
echo "========================================"
echo ""

# 计数器
removed=0

# 清理函数
remove_if_exists() {
    if [ -e "$1" ]; then
        rm -rf "$1"
        echo "✓ 已删除: $1"
        ((removed++))
    fi
}

# Webpack 缓存
remove_if_exists ".webpack_cache"
remove_if_exists "node_modules/.cache"

# TypeScript 构建信息
remove_if_exists "*.tsbuildinfo"
remove_if_exists "tsconfig.tsbuildinfo"

# 输出目录
remove_if_exists "out"

# ESLint 缓存
remove_if_exists ".eslintcache"

# Stylelint 缓存
remove_if_exists ".stylelintcache"

# 通用缓存目录
remove_if_exists ".cache"

# VS Code 测试缓存
remove_if_exists ".vscode-test"

echo ""
echo "========================================"
if [ $removed -gt 0 ]; then
    echo "✓ 清理完成！共删除 $removed 个缓存项"
else
    echo "✓ 没有发现需要清理的缓存"
fi
echo "========================================"
echo ""
echo "建议执行以下命令重新构建:"
echo "  npm run compile"
echo "  npm run build:webview"
