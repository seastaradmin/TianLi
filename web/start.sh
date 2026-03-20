#!/bin/bash
# TianLi Console Web - 快速启动脚本

echo "🌟 TianLi Console Web 启动脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本：$(node --version)"
echo "✅ npm 版本：$(npm --version)"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 首次运行，安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
fi

echo ""
echo "选择启动模式:"
echo "1. 开发模式 (模拟数据)"
echo "2. 开发模式 + SSE 测试服务器"
echo "3. 仅 SSE 测试服务器"
echo "4. 构建生产版本"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 启动开发服务器..."
        npm run dev
        ;;
    2)
        echo ""
        echo "🚀 启动开发服务器 + SSE 测试服务器..."
        npm run dev:all
        ;;
    3)
        echo ""
        echo "🚀 启动 SSE 测试服务器..."
        npm run server
        ;;
    4)
        echo ""
        echo "📦 构建生产版本..."
        npm run build
        echo "✅ 构建完成，输出在 dist/ 目录"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac
