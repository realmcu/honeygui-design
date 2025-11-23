# HoneyGUI Design

一个强大的VSCode插件，为GUI应用程序开发提供可视化设计环境和代码生成工具。

> 📝 **最近更新**: 查看 [RECENT_FIXES.md](RECENT_FIXES.md) 了解最新的BUG修复和优化

## 功能特性

### 核心功能
- **可视化设计器**：拖放式界面设计，支持多种UI组件
- **HML文件格式**：专有的HoneyGUI Markup Language，用于描述界面结构
- **代码生成**：支持将设计转换为C++/C代码
- **代码保护区**：在代码生成过程中保留特定注释块内的自定义代码
- **项目管理**：创建新项目、导入现有项目

### 界面组件支持
- 按钮（Button）
- 输入框（Input）
- 复选框（Checkbox）
- 单选按钮（Radio）
- 面板（Panel）
- 进度条（ProgressBar）
- 以及更多组件...

## 安装

1. 从VSCode扩展市场安装HoneyGUI Design插件
2. 或者，使用VSCode的"从VSIX安装"功能安装打包的插件

## 使用指南

### 创建新项目

1. 打开命令面板（Ctrl+Shift+P）
2. 输入并选择：`HoneyGUI: New Project`
3. 选择一个目录并输入项目名称
4. 新的HML文件将被创建并在设计器中打开

### 打开现有HML文件

1. 在资源管理器中右键点击.hml文件
2. 选择："使用HoneyGUI设计器打开"
3. 或者，在编辑器中打开.hml文件，然后点击右上角的"在设计器中打开"按钮

### 设计界面

1. 从左侧组件面板拖拽组件到设计画布
2. 选择组件后，在右侧属性面板编辑其属性
3. 使用工具栏按钮保存设计、预览或生成代码

### 生成代码

1. 完成界面设计后，点击工具栏中的"生成代码"按钮
2. 选择目标语言（C++或C）
3. 在代码生成设置中配置选项（启用代码保护区、生成调试信息）
4. 选择输出目录
5. 生成的代码将保存在指定位置

## 代码保护区

代码保护区允许你在生成的代码中保留自定义逻辑。在生成的代码中，你可以使用以下注释标记来定义保护区：

```cpp
// HONEYGUI PROTECTED START [唯一标识符]
// 这里的代码将在重新生成时保留
// HONEYGUI PROTECTED END [唯一标识符]
```

## 项目结构

生成的C++/C项目结构如下：

- `include/` - 头文件目录
  - `main_window.h` - 主窗口头文件
  - `app.h` - 应用程序头文件
- `src/` - 源文件目录
  - `main.cpp` - 主程序入口
  - `main_window.cpp` - 主窗口实现
  - `app.cpp` - 应用程序实现
- `resources/` - 资源文件目录
- `CMakeLists.txt` - CMake构建脚本

## 支持的平台

- Windows
- Linux
- macOS

## 技术栈

- Visual Studio Code Extension API
- TypeScript
- React + Zustand
- Webpack
- HTML/CSS/JavaScript
- C++/C
- CMake

## 开发相关

### 构建项目
```bash
npm install          # 安装依赖
npm run compile      # 编译TypeScript
npm run build:webview # 构建前端
```

### 开发模式
```bash
npm run watch        # 监听后端变化
npm run watch:webview # 监听前端变化
```

### 清理缓存
```bash
npm run clean        # 清理所有缓存
npm run rebuild      # 清理并重新构建
```

### 文档
- [开发指南](DEVELOPMENT.md) - 开发环境配置和工作流
- [快速参考](QUICK_REFERENCE.md) - 常用命令和API
- [架构分析](ARCHITECTURE_ANALYSIS.md) - 项目架构说明
- [最近修复](RECENT_FIXES.md) - 最新的BUG修复记录

## 许可证

MIT

## 联系方式

如有任何问题或建议，请提交issue或联系开发团队。