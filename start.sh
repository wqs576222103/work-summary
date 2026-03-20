#!/bin/bash

echo "========================================"
echo "  工作总结生成工具 - 启动器"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "[警告] .env 文件不存在！"
    echo "请复制 .env.example 为 .env 并配置 API Key"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[提示] 正在安装依赖..."
    npm install
    echo ""
fi

# Start server
echo "[提示] 正在启动服务器..."
echo ""
npm start
