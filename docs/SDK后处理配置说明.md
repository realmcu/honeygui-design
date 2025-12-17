# SDK 后处理配置说明

## 📋 概述

视频转换包含两个阶段：
1. **FFmpeg 转换**：将原始视频转换为目标格式
2. **SDK 后处理**：使用 HoneyGUI SDK 脚本进行优化处理

本文档说明如何配置 SDK 后处理功能。

## 🎯 为什么需要后处理？

SDK 后处理脚本会对 FFmpeg 转换后的视频进行额外处理，以确保：
- 完全兼容 HoneyGUI 播放器
- 符合嵌入式系统的内存对齐要求
- 添加 HoneyGUI 特定的文件头信息
- 优化播放性能

## 🔧 配置方法

### 方法 1: 设置环境变量（推荐）

**Windows (CMD)**:
```cmd
set HONEYGUI_SDK_PATH=C:\path\to\HoneyGUI-SDK
```

**Windows (PowerShell)**:
```powershell
$env:HONEYGUI_SDK_PATH="C:\path\to\HoneyGUI-SDK"
```

**Linux/macOS**:
```bash
export HONEYGUI_SDK_PATH=/path/to/HoneyGUI-SDK
```

**永久设置（Linux/macOS）**:
```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'export HONEYGUI_SDK_PATH=/path/to/HoneyGUI-SDK' >> ~/.bashrc
source ~/.bashrc
```

### 方法 2: 使用默认路径

将 HoneyGUI SDK 放在以下默认位置：

**Linux/macOS**:
```
~/.HoneyGUI-SDK/
```

**Windows**:
```
C:\HoneyGUI-SDK\
```

### 方法 3: 修改代码

在 `BuildCore.ts` 中直接指定 SDK 路径：

```typescript
const videoConverter = new VideoConverterService('/path/to/your/sdk');
```

## 📁 SDK 目录结构

SDK 后处理脚本应位于以下位置之一：

```
HoneyGUI-SDK/
├── tool/
│   ├── video-convert-tool/
│   │   └── video_converter.py    ← 推荐位置
│   └── video_converter.py         ← 备选位置 1
├── tools/
│   └── video_converter.py         ← 备选位置 2
└── video_converter.py             ← 备选位置 3
```

系统会按顺序检查这些路径，使用第一个找到的脚本。

## 🔍 验证配置

### 1. 检查环境变量

**Windows**:
```cmd
echo %HONEYGUI_SDK_PATH%
```

**Linux/macOS**:
```bash
echo $HONEYGUI_SDK_PATH
```

### 2. 检查 SDK 目录

```bash
# 检查目录是否存在
ls $HONEYGUI_SDK_PATH

# 检查后处理脚本
ls $HONEYGUI_SDK_PATH/tool/video-convert-tool/video_converter.py
```

### 3. 运行测试

```bash
npm run test:video-formats
```

测试输出会显示：
- ✓ SDK 后处理脚本已找到: [路径]
- ⚠ SDK 后处理脚本未找到（如果没有配置）

## 📊 后处理状态识别

### 使用了后处理

```
✓ MJPEG 转换成功
  输出文件: birds.mjpeg
  文件大小: 15.23 MB
  转换耗时: 2.45 秒
  ✓ 已完成 SDK 后处理
```

### 跳过了后处理

```
✓ MJPEG 转换成功
  输出文件: birds.mjpeg
  文件大小: 15.23 MB
  转换耗时: 2.45 秒
  ⚠ 警告: SDK post-processing script not found, using direct copy
  → 未使用 SDK 后处理，使用了直接文件复制
```

## 🎭 降级机制

如果 SDK 后处理不可用，系统会自动降级：

1. **无 SDK 路径** → 直接使用 FFmpeg 输出
2. **SDK 路径存在但无脚本** → FFmpeg 输出 + 直接复制 + 警告
3. **脚本存在但执行失败** → FFmpeg 输出 + 回退复制 + 警告
4. **Python 不可用** → FFmpeg 输出 + 回退复制 + 警告

这确保即使没有 SDK 后处理，视频转换仍能正常工作。

## ⚠️ 常见问题

### 1. 找不到后处理脚本

**问题**: `SDK post-processing script not found`

**解决**:
1. 检查 SDK 路径是否正确
2. 确认后处理脚本存在
3. 检查脚本文件名是否为 `video_converter.py`

### 2. Python 未找到

**问题**: `SDK post-processing process failed`

**解决**:
```bash
# 检查 Python 是否安装
python --version
# 或
python3 --version

# Windows 用户可以使用 py launcher
py --version
```

### 3. 后处理失败

**问题**: 后处理脚本执行失败

**解决**:
1. 检查 Python 环境
2. 查看详细错误信息
3. 验证脚本依赖是否安装
4. 系统会自动回退到直接复制

## 🧪 测试后处理

### 创建测试脚本

在 SDK 目录创建简单的测试脚本：

```python
#!/usr/bin/env python3
# SDK/tool/video-convert-tool/video_converter.py

import sys
import shutil
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', required=True)
    parser.add_argument('-o', '--output', required=True)
    parser.add_argument('-f', '--format', default='mjpeg')
    parser.add_argument('-q', '--quality', type=int, default=85)
    parser.add_argument('-r', '--framerate', type=int, default=30)
    
    args = parser.parse_args()
    
    print(f"SDK 后处理: {args.input} -> {args.output}")
    print(f"格式: {args.format}, 质量: {args.quality}, 帧率: {args.framerate}")
    
    # 实际的后处理逻辑
    # 这里简化为直接复制
    shutil.copy2(args.input, args.output)
    
    print("后处理完成")

if __name__ == '__main__':
    main()
```

### 运行测试

```bash
# 设置 SDK 路径
export HONEYGUI_SDK_PATH=/path/to/sdk

# 运行测试
npm run test:video-formats
```

## 📝 最佳实践

1. **开发环境**: 设置环境变量，方便切换不同的 SDK 版本
2. **生产环境**: 使用默认路径，确保一致性
3. **CI/CD**: 在构建脚本中设置环境变量
4. **团队协作**: 在项目文档中说明 SDK 路径配置

## 🔗 相关文档

- [FFmpeg 视频转换方案](./FFmpeg视频转换方案.md)
- [视频格式转换测试指南](./视频格式转换测试指南.md)
- [视频控件功能验证清单](./视频控件功能验证清单.md)

## ✅ 配置检查清单

- [ ] SDK 路径已配置（环境变量或默认路径）
- [ ] SDK 目录存在且可访问
- [ ] 后处理脚本存在于正确位置
- [ ] Python 环境可用
- [ ] 测试脚本运行成功
- [ ] 转换输出显示"已完成 SDK 后处理"

完成以上检查后，视频转换将使用完整的 SDK 后处理流程！