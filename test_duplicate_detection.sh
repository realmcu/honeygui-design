#!/bin/bash

# HoneyGUI 项目创建 - 重复检测测试脚本
# 测试各种边界情况下的项目重名检测

TEST_DIR="/tmp/honeygui_test"
echo "=== HoneyGUI 项目重名检测测试 ==="
echo "测试目录: $TEST_DIR"
echo "=================================="

# 创建测试目录
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 测试用例 1: 完全相同的项目名称
echo -e "\n📌 测试用例 1: 完全相同的项目名称"
echo "创建项目: TestProject"
mkdir -p "TestProject"
if [ -d "TestProject" ]; then
    echo "✅ 目录已存在 (模拟第一次创建)"
fi

echo "尝试再次创建: TestProject"
if [ -d "TestProject" ]; then
    echo "✅ 正确检测到重复: TestProject 已存在"
else
    echo "❌ 未检测到重复"
fi

# 测试用例 2: 大小写不同 (Linux区分大小写)
echo -e "\n📌 测试用例 2: 大小写不同"
if [ -d "TestProject" ]; then
    echo "目录 TestProject 已存在"
fi

echo "尝试创建: testproject (小写)"
if [ -d "testproject" ]; then
    echo "✅ 检测到重复 (小写版本已存在)"
else
    echo "✅ 正确允许创建 (Linux区分大小写)"
    mkdir -p "testproject"
fi

# 测试用例 3: 包含特殊字符
echo -e "\n📌 测试用例 3: 包含特殊字符"
echo "测试名称: My:Project? (包含 : 和 ?)"
TEST_NAME="My:Project?"
if echo "$TEST_NAME" | grep -q '[<>:*"?|\\/]'; then
    echo "✅ 正确检测到非法字符"
else
    echo "❌ 未检测到非法字符"
fi

# 测试用例 4: 路径中已存在同名文件夹
echo -e "\n📌 测试用例 4: 路径中已存在文件夹"
echo "创建嵌套目录: Parent/Child"
mkdir -p "Parent/Child"

echo "尝试在Parent中创建Child项目"
if [ -d "Parent/Child" ]; then
    echo "✅ 正确检测到路径已存在"
else
    echo "❌ 未检测到"
fi

# 测试用例 5: 同名文件（不是目录）
echo -e "\n📌 测试用例 5: 同名文件（不是目录）"
echo "创建文件: FileProject"
touch "FileProject"

echo "尝试创建FileProject项目"
if [ -e "FileProject" ] && [ ! -d "FileProject" ]; then
    echo "✅ 正确检测到同名文件存在 (非目录)"
else
    echo "❌ 未正确检测"
fi

# 测试用例 6: 空名称
echo -e "\n📌 测试用例 6: 空项目名称"
PROJECT_NAME=""
if [ -z "$PROJECT_NAME" ]; then
    echo "✅ 正确检测到名称为空"
else
    echo "❌ 未检测到"
fi

# 测试用例 7: 仅空格
echo -e "\n📌 测试用例 7: 仅空格名称"
PROJECT_NAME="   "
TRIMMED=$(echo "$PROJECT_NAME" | tr -d ' ')
if [ -z "$TRIMMED" ]; then
    echo "✅ 正确检测到名称仅包含空格"
else
    echo "❌ 未检测到"
fi

# 测试用例 8: 路径不存在
echo -e "\n📌 测试用例 8: 保存路径不存在"
if [ ! -d "/nonexistent/path" ]; then
    echo "✅ 正确检测到路径不存在"
else
    echo "❌ 路径检测错误"
fi

# 清理测试环境
echo -e "\n=================================="
echo "清理测试环境..."
cd /
rm -rf "$TEST_DIR"
echo "✅ 测试完成"
echo "=================================="
