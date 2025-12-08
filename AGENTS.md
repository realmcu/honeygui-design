# AGENTS.md - AI 助手指南

本文件为 AI 编程助手提供项目上下文和协作指南。

## 项目概述

**HoneyGUI Design** 是一个 VSCode 扩展，为嵌入式 GUI 应用程序开发提供可视化设计环境。

- **类型**：VSCode Extension + React Webview
- **语言**：TypeScript, React, CSS
- **目标**：拖拽式 GUI 设计 → HML 文件 → C 代码生成 → 编译仿真

## 核心架构

### 1. 扩展端 (Extension Host)
```
src/
├── extension.ts              # 入口
├── core/                     # 核心管理
├── hml/                      # HML 解析/序列化
├── codegen/honeygui/         # C 代码生成
├── simulation/               # 编译仿真
└── designer/                 # Webview 管理
```

### 2. Webview 端 (React)
```
src/webview/
├── App.tsx                   # 主应用
├── store.ts                  # Zustand 状态管理
├── components/               # UI 组件
│   ├── DesignerCanvas.tsx    # 画布
│   ├── ComponentLibrary.tsx  # 组件库（Tab 1）
│   ├── AssetsPanel.tsx       # 资源预览（Tab 2）
│   ├── ComponentTree.tsx     # 组件树（Tab 3）
│   └── PropertiesPanel.tsx   # 属性面板
└── utils/                    # 工具函数
```

### 3. 通信机制
- **Extension → Webview**: `panel.webview.postMessage()`
- **Webview → Extension**: `vscodeAPI.postMessage()`
- **消息类型**: `loadHml`, `save`, `codegen`, `compile`, etc.

## 关键概念

### HML (HoneyGUI Markup Language)
类 XML 格式描述界面结构：
```xml
<hg_view id="main_view" x="0" y="0" w="480" h="272">
  <hg_button id="btn1" x="10" y="10" w="100" h="40" text="Click" />
</hg_view>
```

### 组件类型
- **容器**: `hg_view`, `hg_window` (可包含子组件)
- **基础控件**: `hg_button`, `hg_text`, `hg_image` (必须在容器内)
- **输入控件**: `hg_input`, `hg_checkbox`, `hg_radio` (必须在容器内)
- **图形控件**: `hg_canvas`, `hg_progressbar`, `hg_slider` (必须在容器内)
- **多媒体控件**: `hg_video`, `hg_audio` (必须在容器内)

**组件层级规则**：
- 只有容器控件（`hg_view`, `hg_window`）下面才可以添加其他控件
- 基础控件、输入控件、图形控件、多媒体控件必须作为容器的子组件
- 非容器控件不能包含子组件

### 代码生成策略
- **UI 代码** (`*_ui.c/h`): 每次覆盖
- **回调代码** (`*_callbacks.c`): 保护区机制，保留用户代码
- **用户代码** (`user/*.c`): 只生成一次，永不覆盖

### Tab 切换布局
左侧面板使用 Tab 切换：
- Tab 1: 组件库
- Tab 2: 资源预览
- Tab 3: 组件树

## 开发规范

### 代码风格
- TypeScript 严格模式
- React Hooks (函数组件)
- CSS 模块化（每个组件独立 CSS）
- 使用 VSCode 主题变量 (`var(--vscode-*)`)

### 命名约定
- 组件: PascalCase (`DesignerCanvas`)
- 文件: PascalCase (`DesignerCanvas.tsx`)
- CSS 类: kebab-case (`.designer-canvas`)
- 函数: camelCase (`handleDrop`)



## 常见任务

### 添加新组件类型
1. 在 `ComponentLibrary.tsx` 的 `componentDefinitions` 添加定义
2. 在 `HoneyGuiCCodeGenerator.ts` 添加代码生成逻辑
3. 更新 `ComponentType` 类型定义

### 修改 UI 布局
- 主布局: `src/webview/App.tsx` + `App.css`
- 面板样式: `src/webview/components/*.css`
- 全局样式: `src/webview/global.css`


## 重要约束

### 项目规则（必须遵守）
1. **编译规则**：
   - 修改代码后执行：`npm run compile && npm run build:webview`
   - 修改资源文件后执行：`npm run build:webview`
2. **语言规则**：使用中文回答问题
3. **离线优先**：这是离线版本的 VSCode 插件，不要添加依赖网络的功能
4. **文档管理**：
   - 不要随意创建 Markdown 文档
   - 不要删除 `CLAUDE.md` 文件
5. **代码质量**：
   - 考虑整理软件框架
   - Review 是否存在冗余代码
6. **执行环境**：只在 CMD 环境下执行命令，不要在 PowerShell 环境下执行
7. **代码提交**：除非用户特别说明，不要自动 commit 和 push 代码
8. **SDK 目录**：`/home/howie_wang/.HoneyGUI-SDK` 为 SDK 目录
9. **实验工程**：测试用的实验工程位于 `/home/howie_wang/NewProject` 目录

### 不要做的事
- ❌ 不要修改单元测试（除非用户明确要求）
- ❌ 不要在代码中硬编码密钥
- ❌ 不要自动添加测试（除非用户要求）
- ❌ 不要覆盖 `user/` 目录下的文件
- ❌ 不要修改 `*_ui.c/h` 的保护区标记
- ❌ 不要添加网络依赖功能
- ❌ 不要随意创建文档




## AI 助手协作建议

### 在修改代码前
1. 先分析现有实现
2. 提出方案供用户选择
3. 得到确认后再实施

### 代码改动原则
- 最小化改动，只修改必要部分
- 保持现有代码风格一致
- 添加必要的注释

### 提交规范
- 使用约定式提交: `feat:`, `fix:`, `refactor:`, `docs:`
- 提交信息清晰描述改动内容
- 一次提交只做一件事

### 沟通方式
- 直接回答问题，不过度客套
- 提供具体可执行的方案
- 遇到不确定的情况，明确说明并询问

## 项目状态

- **当前版本**: v1.3.1
- **最近更新**: Tab 切换功能（2025-12-03）
- **活跃开发**: 是
- **主要贡献者**: howie_wang


