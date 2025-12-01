# HoneyGUI Design

一个强大的VSCode插件，为嵌入式GUI应用程序开发提供可视化设计环境、代码生成和实时仿真工具。

## 功能特性

### 核心功能
- **可视化设计器**：基于React的拖放式界面设计，支持HoneyGUI组件库
- **HML文件格式**：HoneyGUI Markup Language，类XML格式描述界面结构
- **C代码生成**：将HML设计转换为调用HoneyGUI API的C代码
- **代码保护区**：重新生成代码时保留用户自定义逻辑
- **编译仿真**：完整的编译-运行-调试流程，基于HoneyGUI SDK
- **协同开发**：局域网多人实时协同编辑（离线可用）
- **资源管理**：统一管理图片、字体等资源文件

### 支持的组件类型
- 容器：`hg_screen`, `hg_view`, `hg_window`
- 基础控件：`hg_button`, `hg_text`, `hg_image`, `hg_switch`
- 输入控件：`hg_input`, `hg_checkbox`, `hg_radio`
- 高级控件：`hg_progressbar`, `hg_slider`, `hg_canvas`
- 以及更多...

## 安装

### 从VSIX安装
1. 下载最新的`.vsix`文件
2. 在VSCode中：扩展 → 从VSIX安装
3. 选择下载的文件并安装

### 前置依赖（用于编译仿真）
- **HoneyGUI SDK**：安装到 `~/.HoneyGUI-SDK`
- **SCons**：构建工具（`pip install scons`）
- **GCC/MinGW**：C编译器
- **SDL2**：图形库（仅运行仿真时需要）

## 快速开始

### 1. 创建新项目

```bash
Ctrl+Shift+P → HoneyGUI: New Project
```

选择目录并输入项目名称，自动生成项目结构：
```
my-project/
├── ui/main/
│   └── main.hml          # HML设计文件
├── src/autogen/main/     # 生成的C代码
├── assets/               # 资源文件
└── project.json          # 项目配置
```

### 2. 设计界面

1. 双击`.hml`文件打开设计器
2. 从左侧组件库拖拽组件到画布
3. 在右侧属性面板编辑组件属性
4. 使用`Ctrl+S`保存设计

**快捷键**：
- `Ctrl+Z/Y`：撤销/重做
- `Delete`：删除选中组件
- `Ctrl+D`：复制组件
- `方向键`：微调位置（1px）
- `Shift+方向键`：快速移动（10px）

### 3. 生成代码

点击工具栏"生成代码"按钮，自动生成：
```
src/autogen/main/
├── main.h                # 组件声明
├── main.c                # 初始化和更新逻辑
├── main_callbacks.h      # 事件回调声明
└── main_callbacks.c      # 事件回调实现（含保护区）
```

### 4. 编译仿真

```bash
Ctrl+Shift+P → HoneyGUI: Compile & Simulate
```

自动执行：
1. 环境检查（SDK、SCons、GCC）
2. 生成C代码
3. 准备编译环境（`.honeygui-build/`）
4. 执行SCons编译
5. 启动SDL2仿真窗口

## 代码保护区

在生成的回调文件中，保护区内的代码不会被覆盖：

```c
// main_callbacks.c
#include "main_callbacks.h"

// HONEYGUI PROTECTED START [on_button_click]
void on_button_click(gui_obj_t *obj) {
    // 用户自定义逻辑，重新生成时保留
    printf("Button clicked!\n");
    update_ui_state();
}
// HONEYGUI PROTECTED END [on_button_click]
```

## 协同开发

### 主机模式（拥有文件）
```bash
Ctrl+Shift+P → HoneyGUI: Start Host
输入端口（默认3000）
分享显示的地址给团队成员
```

### 访客模式（实时协同）
```bash
Ctrl+Shift+P → HoneyGUI: Join Session
输入主机地址（如 192.168.1.10:3000）
```

**特点**：
- 完全离线，仅局域网通信
- 毫秒级同步
- 主机负责保存文件
- 访客修改实时回传

## 项目配置

### project.json
```json
{
  "name": "my-project",
  "version": "1.0.0",
  "resolution": "480X272",
  "honeyguiSdkPath": "/path/to/sdk",  // 可选，覆盖全局设置
  "codeGeneration": {
    "language": "c",
    "outputPath": "src/autogen"
  }
}
```

### VSCode设置
```json
{
  "honeygui.sdk.path": "~/.HoneyGUI-SDK",
  "honeygui.codegen.language": "c",
  "honeygui.ui.gridSize": 8,
  "honeygui.ui.snapToGrid": true
}
```

## 技术架构

### 扩展端（TypeScript）
```
src/
├── extension.ts              # 入口
├── core/
│   ├── ExtensionManager.ts   # 扩展管理
│   └── CommandManager.ts     # 命令注册
├── hml/
│   ├── HmlController.ts      # HML文件控制
│   ├── HmlParser.ts          # XML解析
│   └── HmlSerializer.ts      # 序列化
├── codegen/honeygui/
│   └── HoneyGuiCCodeGenerator.ts  # C代码生成
├── simulation/
│   ├── SimulationService.ts  # 仿真服务
│   ├── BuildCore.ts          # 编译核心
│   └── EnvironmentChecker.ts # 环境检查
└── designer/
    ├── DesignerPanel.ts      # Webview面板
    └── MessageHandler.ts     # 消息处理
```

### Webview端（React + Zustand）
```
src/webview/
├── App.tsx                   # 主应用
├── store.ts                  # Zustand状态管理
├── components/
│   ├── DesignerCanvas.tsx    # 画布
│   ├── ComponentLibrary.tsx  # 组件库
│   ├── PropertiesPanel.tsx   # 属性面板
│   └── ComponentTree.tsx     # 组件树
└── utils/
    ├── keyboardShortcuts.ts  # 快捷键
    └── undoRedo.ts           # 撤销/重做
```

### 通信协议
```typescript
// 扩展 → Webview
{ command: 'loadHml', components: [...], projectConfig: {...} }
{ command: 'showMessage', text: '...', type: 'info' }

// Webview → 扩展
{ command: 'save', components: [...] }
{ command: 'codegen', language: 'c' }
{ command: 'updateComponent', id: '...', updates: {...} }
```

## 开发指南

### 环境搭建
```bash
git clone <repository>
cd honeygui-design
npm install
```

### 开发模式
```bash
# 终端1：编译扩展端
npm run watch

# 终端2：编译Webview端
npm run watch:webview

# 按F5启动调试
```

### 测试
```bash
# E2E测试（需要SDK）
npm run test:e2e

# 单元测试
npm test
```

### 构建发布
```bash
npm run vscode:prepublish  # 生产构建
vsce package               # 打包VSIX
```

## 文档

- [文档中心](docs/README.md) - 完整文档导航
- [架构设计](docs/架构设计.md) - 技术架构详解
- [预览和编译架构](docs/预览和编译架构.md) - 仿真流程说明
- [代码生成](docs/代码生成.md) - 代码生成机制
- [协同开发功能说明](docs/协同开发功能说明.md) - 协同开发使用指南
- [开发指南](docs/开发指南.md) - 开发环境和工作流
- [测试指南](docs/测试指南.md) - 测试策略和方法
- [变更日志](docs/变更日志.md) - 版本更新记录

## 版本历史

### v1.2.1 (2025-11-29)
- 重构编译架构，抽离BuildCore核心逻辑
- 改进E2E测试，复用编译逻辑
- 修复协同开发消息回环问题

### v1.2.0 (2025-11-27)
- 预览与编译仿真功能分离
- 完整实现编译仿真流程
- 新增环境检查和SDK路径配置

### v1.1.9 (2025-11-25)
- 支持资源面板拖拽图片到画布
- 删除资源时自动删除关联组件

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

- 项目主页：https://gitee.com/realmcu/honeygui-design
- HoneyGUI SDK：https://gitee.com/realmcu/HoneyGUI
- 问题反馈：https://gitee.com/realmcu/honeygui-design/issues