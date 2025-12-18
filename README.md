# HoneyGUI Design

一个强大的VSCode插件，为嵌入式GUI应用程序开发提供可视化设计环境、代码生成和实时仿真工具。

## 功能特性

### 核心功能
- **可视化设计器**：基于React的拖放式界面设计，支持HoneyGUI组件库
- **HML文件格式**：HoneyGUI Markup Language，类XML格式描述界面结构
- **C代码生成**：将HML设计转换为调用HoneyGUI API的C代码
- **代码保护区**：支持用户自定义逻辑保留机制
- **编译仿真**：完整的编译-运行-调试流程，基于HoneyGUI SDK
- **协同开发**：局域网多人实时协同编辑（离线可用）
- **资源管理**：统一管理图片、字体、视频、3D模型等资源文件

### 支持的组件类型
- 容器：`hg_screen`, `hg_view`, `hg_window`
- 基础控件：`hg_button`, `hg_text`, `hg_image`, `hg_switch`
- 输入控件：`hg_input`, `hg_checkbox`, `hg_radio`
- 高级控件：`hg_progressbar`, `hg_slider`, `hg_canvas`
- 多媒体/3D：`hg_video`, `hg_3d`
- 以及更多...

## 安装

### 从VSIX安装
1. 下载最新的`.vsix`文件
2. 在VSCode中：扩展 → 从VSIX安装
3. 选择下载的文件并安装

### 前置依赖（用于编译仿真）
- **HoneyGUI SDK**：安装到 `~/.HoneyGUI-SDK`（或在设置中配置路径）
- **SCons**：构建工具（`pip install scons`）
- **GCC/MinGW**：C编译器
- **SDL2**：图形库（仅运行仿真时需要）
- **FFmpeg**：视频转换工具（可选，用于处理视频资源）

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
├── src/                  # 源代码目录
│   ├── ui/               # UI代码（自动生成）
│   ├── callbacks/        # 回调代码（保护区）
│   └── user/             # 用户代码（只生成一次）
├── assets/               # 资源文件
├── build/                # 编译产物（编译后生成）
│   ├── assets/           # 转换后的资源（.bin）
│   ├── root_image.bin    # romfs 文件系统
│   ├── gui.exe           # 可执行文件（Windows）
│   └── ...               # SDK win32_sim 文件
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
src/
├── ui/                     # UI代码目录
│   ├── main_ui.h           # UI声明（每次覆盖）
│   └── main_ui.c           # UI实现（每次覆盖）
├── callbacks/              # 回调代码目录
│   ├── main_callbacks.h    # 回调声明（只生成一次）
│   └── main_callbacks.c    # 回调实现（保护区机制）
└── user/                   # 用户代码目录
    ├── main_user.h         # 用户头文件（只生成一次）
    └── main_user.c         # 用户逻辑（只生成一次）
```

**文件覆盖策略**：
| 文件 | 策略 | 说明 |
|------|------|------|
| `*_ui.h/c` | 每次覆盖 | 纯UI代码，由设计器完全控制 |
| `*_callbacks.c` | 保护区 | 用户自定义逻辑保留 |
| `user/*.c` | 只生成一次 | 用户完全控制，永不覆盖 |

### 4. 编译仿真

```bash
Ctrl+Shift+P → HoneyGUI: Compile & Simulate
```

自动执行：
1. 环境检查（SDK、SCons、GCC）
2. 转换资源（图片、视频、3D模型 → .bin）
3. 生成C代码
4. 准备编译环境（拷贝SDK的`win32_sim/`到`build/`，修改`build/SConstruct`）
5. 执行SCons编译
6. 启动SDL2仿真窗口（支持 Letter Shell 交互）

## 资源处理

HoneyGUI Design 自动处理资源转换：
- **图片**：PNG/JPG/JPEG → HoneyGUI 格式（自动检测格式）
- **视频**：MP4/AVI 等 → MJPEG/H264/AVI（使用 FFmpeg 预处理）
- **3D模型**：OBJ/GLTF → HoneyGUI 二进制描述文件（自动处理纹理和依赖）

**注意**：拖拽 GLTF 模型时，请确保同时拖拽关联的 `.bin` 文件。

## 代码生成策略

采用 **Qt模式 + 保护区** 组合策略，确保用户代码不被覆盖：

### 1. UI代码分离（每次覆盖）
```c
// main_ui.h - 自动生成，请勿手动修改
extern gui_obj_t *button1;
extern gui_obj_t *label1;

// main_ui.c - 自动生成，请勿手动修改
gui_obj_t *button1 = NULL;
// ... 组件创建代码
```

### 2. 回调保护区（保留用户代码）
```c
// main_callbacks.c
/* @protected start custom_functions */
// 用户自定义函数
void my_custom_logic(void) {
    // ...
}
/* @protected end custom_functions */
```

### 3. 用户代码目录（完全控制）
```c
// src/user/main/main.c - 只生成一次，后续不覆盖
#include "main.h"

void main_init_user(void) {
    // 在此添加初始化逻辑
}

void main_update_user(void) {
    // 在此添加更新逻辑
}
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
    "language": "c"
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

## 文档

- [文档中心](docs/README.md) - 完整文档导航
- [架构设计](docs/架构设计.md) - 技术架构详解
- [预览和编译架构](docs/预览和编译架构.md) - 仿真流程说明
- [代码生成](docs/代码生成.md) - 代码生成机制
- [事件系统设计](docs/事件系统设计.md) - 事件绑定和回调机制
- [资源处理流程](docs/资源处理流程.md) - 图片、视频、3D模型转换
- [开发指南](docs/开发指南.md) - 开发环境和工作流
- [测试指南](docs/测试指南.md) - 测试策略和方法
- [变更日志](docs/变更日志.md) - 版本更新记录

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

- 项目主页：https://gitee.com/realmcu/honeygui-design
- HoneyGUI SDK：https://gitee.com/realmcu/HoneyGUI
- 问题反馈：https://gitee.com/realmcu/honeygui-design/issues
