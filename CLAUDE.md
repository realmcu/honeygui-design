# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供使用该仓库代码时的指导。

## 项目概述

HoneyGUI Visual Designer 是一个 VS Code 扩展，提供可视化拖放界面来创建 HoneyGUI（HoneyGUI 标记语言）UI 界面。它能生成适用于嵌入式应用的 C++/C 代码，并支持代码保护区功能。

**关键技术：**
- TypeScript 5.3
- React 18 + ReactDOM + Zustand（用于 webview UI）
- VS Code 扩展 API
- Webpack 5（webview 构建）
- HML（HoneyGUI 标记语言 - 自定义类 XML 格式）

## 开发命令

### 常见任务

**构建和运行：**
```bash
# 完整构建（扩展 + webview，发布前使用）
npm run compile && npm run build:webview

# 开发监听模式（实时编译扩展）
npm run watch

# 开发模式（推荐）：在一个终端运行编译，另一个运行 webpack dev server
npm run watch:webview  # 编译监听
npm run serve:webview  # 启动 dev server（端口 3000）
```

**测试和调试：**
```bash
# 运行测试
npm test

# 代码检查（ESLint）
npm run lint
```

**单独运行：**
```bash
# 编译扩展 TypeScript（主进程）
npm run compile

# 监听扩展 TypeScript 变化
npm run watch

# 构建 webview React 应用（生产环境）
npm run build:webview

# 构建 webview React 应用（开发环境）
npm run build:webview:dev

# 监听 webview 变化
npm run watch:webview

# 使用开发服务器运行 webview（端口 3000）
npm run serve:webview

# 发布前完整构建
npm run vscode:prepublish
```

### 打包
```bash
# 生成 VSIX 文件（需要先安装 vsce）
vsce package

# 输出文件为: honeygui-visual-designer-{version}.vsix
```

### 快速开发流程
```bash
# 1. 首次安装依赖
npm install

# 2. 打开两个终端：
# 终端1：编译扩展（监听模式）
npm run watch

# 终端2：启动 webview dev server
npm run serve:webview

# 3. 在 VS Code 中按 F5 启动调试扩展

# 4. 开发 webview 时，访问 http://localhost:3000/ 查看实时效果
```

## 架构概述

### 模块结构

项目采用模块化架构，扩展逻辑与 webview UI 清晰分离：

```
src/
├── extension.ts                    # 扩展入口点
├── webview/                        # React webview UI
│   ├── index.tsx                   # React 应用入口
│   ├── App.tsx                     # 主应用组件
│   ├── store.ts                    # Zustand 状态管理
│   ├── types.ts                    # TypeScript 类型
│   ├── components/                 # UI 组件
│   │   ├── Toolbar.tsx
│   │   ├── ComponentLibrary.tsx
│   │   ├── DesignerCanvas.tsx
│   │   ├── PropertiesPanel.tsx
│   │   ├── ComponentTree.tsx
│   │   └── ResourceManager.tsx
│   └── utils/
│       └── undoRedo.ts             # 命令模式撤销/重做
├── designer/
│   ├── DesignerPanel.ts            # Webview 面板管理
│   └── DesignerModel.ts            # 设计器数据模型
├── hml/
│   ├── HmlController.ts            # HML 文件操作
│   ├── HmlParser.ts                # 解析 HML 到组件
│   └── HmlSerializer.ts            # 序列化组件到 HML
├── codegen/
│   ├── CodeGenerator.ts            # 抽象生成器基类
│   └── cpp/
│       └── CppCodeGenerator.ts     # C++ 代码生成
├── preview/
│   ├── PreviewService.ts           # 预览管理
│   └── PreviewRunner.ts            # HoneyGUI Runner 集成
├── template/
│   ├── TemplateManager.ts
│   ├── ProjectWizard.ts
│   └── ProjectTemplate.ts
└── config/
    └── ConfigManager.ts
```

### 状态管理

**扩展端**：通过 HmlController 和配置管理器直接管理状态
**Webview 端**：React + Zustand 用于 UI 状态管理

**Zustand store 主要功能：**
- 组件增删改查操作
- 选择状态
- 撤销/重做（命令模式，50 步历史）
- 画布状态（缩放、平移、网格设置）

### 通信流程

1. **扩展 → Webview**：通过 `postMessage()` 发送带类型的消息
   - `loadHml`：将 HML 内容加载到设计器
   - `showMessage`：显示通知
   - `error`：显示错误消息
   - `codegenProgress`：显示代码生成进度
   - `codegenComplete`：通知代码生成完成

2. **Webview → 扩展**：通过 `vscode.postMessage()`
   - `save`：请求保存操作
   - `codegen`：请求代码生成
   - `addComponent`/`removeComponent`/`updateComponent`：组件变更
   - `notify`：用户通知
   - `updateStatus`：状态更新

### 构建输出

```
out/
├── extension.js                    # 编译后的扩展
├── extension.js.map
├── hml/
├── designer/
│   └── designerPanel.js
├── codegen/
│   └── cpp/
│       └── CppCodeGenerator.js
└── designer/
    └── webview/                    # React 构建输出
        ├── index.html
        ├── styles.css
        └── webview.js              # 791 KiB React 包
```

## 开发指南

### 添加新 UI 组件

1. **组件定义** (`src/webview/types.ts`)：
   - 添加组件类型到 `ComponentDefinition`
   - 定义属性模式

2. **组件库** (`ComponentLibrary.tsx`)：
   - 添加条目到 `COMPONENT_LIBRARY`
   - 提供图标、名称、描述

3. **组件渲染** (`DesignerCanvas.tsx`)：
   - 在 `renderComponent` 中添加渲染分支
   - 实现组件特定渲染

4. **代码生成** (`src/codegen/cpp/CppCodeGenerator.ts`)：
   - 为新组件类型添加生成方法
   - 在主生成循环中注册

### HML 文件格式

HML 是自定义类 XML 格式：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hone:HoneyGUI xmlns:hone="http://www.honeygui.com"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:schemaLocation="http://www.honeygui.com honeygui.xsd">
    <HoneyGUI version="1.0">
        <Plugin name="com.honeygui.designer" version="1.1.0"/>
        <Window width="800" height="600" title="Main Window">
            <Button id="button1" x="100" y="50" width="120" height="40" text="Click Me"/>
            <Label id="label1" x="100" y="120" width="200" height="30" text="Hello HoneyGUI"/>
        </Window>
    </HoneyGUI>
</hone:HoneyGUI>
```

### 代码保护区

生成 C++/C 代码时，用户可以使用特殊注释添加保护区：

```cpp
// HONEYGUI PROTECTED START [unique-id]
// 您的自定义代码在这里 - 重新生成时保留
int customVariable = 42;
// HONEYGUI PROTECTED END [unique-id]
```

代码生成器 (`CppCodeGenerator`) 会解析现有文件，并在生成新代码时合并保护区。

## 关键实现细节

### 撤销/重做系统

实现命令模式：
- `AddComponentCommand`
- `DeleteComponentCommand`
- `MoveComponentCommand`
- `UpdatePropertyCommand`

由 `CommandManager` 管理，50 步历史记录。集成到 Zustand store。

### 设计器画布

支持：
- 从组件库拖放
- 带视觉反馈的组件选择
- 位置吸附到网格（默认 8px）
- 缩放（25% - 800%）
- 多级组件嵌套

### 键盘快捷键

通过 React hook (`useKeyboardShortcuts`) 实现：
- Ctrl+S：保存
- Ctrl+Z：撤销
- Ctrl+Shift+Z/Ctrl+Y：重做
- Delete：删除选中
- Ctrl+D：复制
- 方向键：微调（1px）
- Shift+方向键：快速移动（10px）

### 扩展命令

**主要命令：**
- `honeygui.newProject`：使用向导创建新项目
- `honeygui.openDesigner`：打开可视化设计器
- `honeygui.codegen`：生成 C++/C 代码
- `honeygui.preview`：使用 HoneyGUI Runner 启动预览
- `honeygui.openResourceManager`：打开资源浏览器
- `honeygui.openDocs`：打开文档
- `honeygui.migrateXmlToHml`：将 XML 文件迁移到 HML

**欢迎视图导航命令：**
- `honeygui.switchView`：在欢迎视图和快速视图之间切换
- `honeygui.openProject`：打开现有项目
- `honeygui.openRecent`：打开最近使用的项目列表

**运行控制命令：**
- `honeygui.showCreateProjectForm`：显示项目创建表单
- `honeygui.openSettings`：打开 HoneyGUI 设置
- `honeygui.startProject`：启动项目
- `honeygui.stopProject`：停止项目
- `honeygui.restartProject`：重启项目

## VS Code 配置设置

扩展提供以下设置（前缀：`honeygui.`）：

### 代码生成设置
- `codegen.language`：目标语言（cpp/c），默认：cpp
- `codegen.outputDir`：代码生成输出目录，默认："src/ui"
- `codegen.outputPath`：代码输出路径，默认："src"
- `codegen.cppVersion`：C++ 版本，默认："c++17"
- `codegen.enableDebugInfo`：在生成代码中包含调试信息，默认：true

### 预览设置
- `preview.runnerPath`：HoneyGUI Runner 可执行文件路径，默认：""
- `preview.autoDownload`：缺失时自动下载 runner，默认：true
- `preview.timeoutMs`：预览超时（毫秒），默认：10000
- `preview.autoReload`：变更时自动重载预览，默认：true

### UI 设置
- `ui.gridSize`：吸附网格大小（像素），默认：8
- `ui.snapToGrid`：启用网格吸附，默认：true
- `hml.outputDir`：HML 文件输出目录，默认："ui"

### 其他设置
- `telemetry.enabled`：启用遥测收集，默认：true

## 测试

### 测试结构
测试位于 `test/` 目录：
- 单元测试：`test/unit/`
- 集成测试：`test/integration/`

### 运行测试
```bash
# 编译然后运行测试套件
npm test

# 单独编译
npm run compile

# 注意：当前测试套件需要配置 vscode-test 环境
# 在 VS Code 中按 F5 启动调试模式进行手动测试
```

### 推荐的测试方法
由于 VS Code 扩展测试需要特殊环境配置，建议：
1. 使用 VS Code 的调试功能（F5）启动扩展开发宿主
2. 在开发宿主中手动执行功能测试
3. 查看输出窗口（Output > HoneyGUI Design）检查日志
4. 使用浏览器的开发者工具检查 webview 控制台

## 已知限制

1. **包大小**：React 包为 791 KiB（超过推荐的 244 KiB）。生产环境建议使用代码分割。

2. **通信**：Webview <-> 扩展之间的通信需要完善某些功能。

3. **性能**：未广泛使用 React.memo；大型组件树需考虑优化。

4. **文件系统**：资源管理器使用模拟数据；需要真实文件系统集成。

## 构建系统

使用双构建系统：
- **扩展**：TypeScript 编译器 (tsc) 输出到 `out/`
- **Webview**：Webpack 5 输出到 `out/designer/webview/`

**Webpack 特性：**
- ts-loader 编译 TypeScript
- css-loader + style-loader（开发）/ MiniCssExtractPlugin（生产）
- HtmlWebpackPlugin 生成 HTML
- Source map 调试

提供端口 3000 的 dev server 用于 webview 开发。

### 构建输出位置
```javascript
// 扩展文件：
out/extension.js                     // VS Code 扩展入口
out/designer/DesignerPanel.js       // 设计器面板
out/hml/                            // HML 相关模块
out/codegen/                        // 代码生成器

// Webview 文件：
out/designer/webview/
  ├── index.html                    // Webview HTML 模板
  ├── webview.js                    // React 应用包（791 KiB）
  └── styles.css                    // 样式（生产环境）
```
