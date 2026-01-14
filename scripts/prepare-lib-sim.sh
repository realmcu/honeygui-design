#!/bin/bash
# 从 SDK 准备插件内置库文件
# 用法: ./scripts/prepare-lib-sim.sh [SDK_PATH]

SDK_PATH="${1:-$HOME/.HoneyGUI-SDK}"
LIB_SIM="./lib/sim"

if [ ! -d "$SDK_PATH" ]; then
    echo "错误: SDK 路径不存在: $SDK_PATH"
    echo "用法: $0 [SDK_PATH]"
    exit 1
fi

echo "从 SDK 准备内置库文件..."
echo "SDK 路径: $SDK_PATH"
echo "目标路径: $LIB_SIM"

# 1. 拷贝 win32_sim（仿真端代码）
echo "1. 拷贝 win32_sim..."
rm -rf "$LIB_SIM/win32_sim"
cp -r "$SDK_PATH/win32_sim" "$LIB_SIM/"

# 2. 拷贝头文件
echo "2. 拷贝头文件..."
rm -rf "$LIB_SIM/include"
mkdir -p "$LIB_SIM/include"
cp -r "$SDK_PATH/realgui/engine"/*.h "$LIB_SIM/include/" 2>/dev/null || true
cp -r "$SDK_PATH/realgui/widget"/*.h "$LIB_SIM/include/" 2>/dev/null || true
cp -r "$SDK_PATH/realgui/server"/*.h "$LIB_SIM/include/" 2>/dev/null || true
cp -r "$SDK_PATH/realgui/3rd"/*.h "$LIB_SIM/include/" 2>/dev/null || true

# 3. 拷贝构建工具
echo "3. 拷贝构建工具..."
rm -rf "$LIB_SIM/tool"
mkdir -p "$LIB_SIM/tool"
cp -r "$SDK_PATH/tool/scons-tool" "$LIB_SIM/tool/"

echo ""
echo "✓ 文件拷贝完成"
echo ""
echo "接下来需要手动编译预编译库："
echo "  Linux: cd $SDK_PATH/win32_sim && scons --buildlib=gui && cp build/libgui.a $PWD/$LIB_SIM/linux/"
echo "  Windows: 在 Windows 环境下编译 libgui.a 并放到 $LIB_SIM/win32/"
echo ""
echo "SDL2 静态库已存在于 $LIB_SIM/SDL2-2.26.0-STATIC/"
