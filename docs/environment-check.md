# 环境检查功能

## 功能说明

在 HoneyGUI Visual Designer 插件的左侧面板中，新增了 **ENVIRONMENT** 视图，用于检查开发环境是否完整。

## 检查项目

1. **Python** - 必需，用于运行构建脚本
2. **SCons** - 必需，用于项目编译
3. **编译器 (GCC/MinGW)** - 必需，用于代码编译
4. **FFmpeg** - 可选，用于视频资源转换

## 使用方法

1. 打开 VSCode
2. 点击左侧活动栏的 HoneyGUI 图标
3. 在 **ENVIRONMENT** 面板中查看各项环境状态
4. 点击面板右上角的刷新按钮可重新检查

## 状态图标

- ✓ (绿色) - 已安装
- ✗ (红色) - 未安装（必需项）
- ✗ (黄色) - 未安装（可选项）

## 安装指南

### Python
- 下载地址: https://www.python.org/
- 安装后确保添加到系统 PATH

### SCons
```bash
pip install scons
```

### 编译器
- **Windows**: 安装 MinGW (https://www.mingw-w64.org/)
- **Linux**: 
  ```bash
  sudo apt-get install build-essential  # Ubuntu/Debian
  sudo yum groupinstall "Development Tools"  # CentOS/RHEL
  ```

### FFmpeg (可选)
- 下载地址: https://ffmpeg.org/
- 用于视频格式转换功能
