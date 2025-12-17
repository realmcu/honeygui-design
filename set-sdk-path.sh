#!/bin/bash
# 设置 HoneyGUI SDK 路径（Linux/macOS）
# 使用方法: source set-sdk-path.sh /path/to/HoneyGUI-SDK

if [ -z "$1" ]; then
    echo "错误: 请提供 SDK 路径"
    echo "使用方法: source set-sdk-path.sh /path/to/HoneyGUI-SDK"
    echo ""
    echo "或者使用默认路径:"
    echo "  export HONEYGUI_SDK_PATH=~/.HoneyGUI-SDK"
    exit 1
fi

export HONEYGUI_SDK_PATH="$1"
echo "✓ SDK 路径已设置: $HONEYGUI_SDK_PATH"
echo ""
echo "验证配置:"
echo "  echo \$HONEYGUI_SDK_PATH"
echo ""
echo "运行测试:"
echo "  npm run test:video-formats"
echo ""
echo "注意: 使用 'source' 命令运行此脚本以保持环境变量"
echo "要永久设置，添加到 ~/.bashrc 或 ~/.zshrc:"
echo "  echo 'export HONEYGUI_SDK_PATH=$HONEYGUI_SDK_PATH' >> ~/.bashrc"