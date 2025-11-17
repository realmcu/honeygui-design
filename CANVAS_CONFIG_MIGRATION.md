# 画布配置迁移说明

## 变更概述

**变更日期**: 2025-11-17

**原因**: 画布背景色应该是项目级别的配置，而不是全局的 VS Code 设置

**影响范围**: 所有项目配置文件 (project.json)

## 变更详情

### 配置位置变更

#### ❌ 旧方式（已移除）

```json
// .vscode/settings.json
{
  "honeygui.ui.canvasBackgroundColor": "#f0f0f0"
}
```

**缺点**:
- 影响所有项目，无法为不同项目设置不同颜色
- 不符合项目配置的原则

#### ✅ 新方式（推荐）

```json
// project.json
{
  "name": "MyApp",
  "resolution": "480X272",
  "designer": {
    "canvasBackgroundColor": "#f0f0f0"
  }
}
```

**优点**:
- 项目级别的配置，不同项目可以不同颜色
- 配置文件与项目代码一起版本控制
- 符合项目配置的原则

## project.json 完整配置

### 示例 1: 最小化配置

```json
{
  "name": "MyApp",
  "appId": "com.example.MyApp",
  "version": "1.0.0",
  "resolution": "480X272",
  "minSdk": "API 2: Persim Wear V1.1.0",
  "pixelMode": "ARGB8888",
  "mainHmlFile": "ui/main.hml"
}
```
**画布背景色**: 使用默认值 `#f0f0f0` (浅灰色)

### 示例 2: 带自定义画布颜色

```json
{
  "name": "MyApp",
  "appId": "com.example.MyApp",
  "version": "1.0.0",
  "resolution": "480X272",
  "minSdk": "API 2: Persim Wear V1.1.0",
  "pixelMode": "ARGB8888",
  "mainHmlFile": "ui/main.hml",
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
```
**画布背景色**: 浅蓝色

### 示例 3: 不同配色方案

#### 深色主题
```json
{
  "designer": {
    "canvasBackgroundColor": "#2d2d2d"
  }
}
```

#### 护眼模式（浅绿色）
```json
{
  "designer": {
    "canvasBackgroundColor": "#f1f8e9"
  }
}
```

#### 蓝色系
```json
{
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
```

## 迁移步骤

### 步骤 1: 删除旧的 VS Code 配置

打开 `.vscode/settings.json`，删除：

```json
{
  "honeygui.ui.canvasBackgroundColor": "..."  // 删除这一行
}
```

### 步骤 2: 在 project.json 中添加新配置

在项目的 `project.json` 文件中添加 `designer` 字段：

```json
{
  "name": "...",
  "resolution": "...",
  "designer": {
    "canvasBackgroundColor": "#f0f0f0"  // 添加这行
  }
}
```

### 步骤 3: 重新打开设计器

关闭并重新打开设计器，配置即可生效。

**注意**: 不需要重启 VS Code，只需要重新打开设计器。

## 配置生效时机

配置在以下情况被读取：

1. **打开设计器时**
   - 读取当前项目的 `project.json`
   - 如果找不到配置，使用默认值 `#f0f0f0`

2. **加载 HML 文件时**
   - 读取与 HML 文件同目录或上级目录的 `project.json`
   - 如果找不到配置，使用默认值 `#f0f0f0`

3. **创建新项目时**
   - 读取工作区根目录的 `project.json`
   - 如果找不到配置，使用默认值 `#f0f0f0`

## 代码实现

### DesignerPanel.ts

```typescript
// 从 project.json 读取
const canvasBackgroundColor = projectConfig?.designer?.canvasBackgroundColor || '#f0f0f0';

// 发送到 Webview
this._panel.webview.postMessage({
  command: 'loadHml',
  designerConfig: {
    canvasBackgroundColor
  }
});
```

### App.tsx

```typescript
if (message.designerConfig?.canvasBackgroundColor) {
  setCanvasBackgroundColor(message.designerConfig.canvasBackgroundColor);
}
```

## 向后兼容

**旧项目**: 如果 `project.json` 中没有 `designer` 配置，系统会自动使用默认值 `#f0f0f0`，不会影响功能。

**建议**: 建议在创建新项目时，在 `project.json` 中添加 `designer` 配置。

## 相关文件

- **project.json 示例**: `/home/howie_wang/workspace/NewProject/project.json`
- **配置说明**: `/home/howie_wang/workspace/honeygui-design/PROJECT_JSON_EXAMPLE.md`
- **实现代码**:
  - `src/designer/DesignerPanel.ts` (第451-463行, 第508-519行)
  - `src/webview/App.tsx` (第66-69行)
  - `src/webview/store.ts` (第182行)

## 常见问题

### Q: 修改配置后需要重启 VS Code 吗？

**A**: 不需要。只需要关闭并重新打开设计器即可。

### Q: 如果没有 project.json 文件会怎样？

**A**: 会使用默认值 `#f0f0f0` (浅灰色)。

### Q: 可以为不同项目设置不同的画布颜色吗？

**A**: 可以！每个项目在自己的 `project.json` 中配置 `designer.canvasBackgroundColor`。

### Q: 项目之间没有隔离吗？

**A**: 是的，每个项目的配置是相互独立的，符合项目配置的预期行为。

## 总结

**变更优势**:
- ✅ 项目级别的配置，更符合实际使用场景
- ✅ 配置文件与项目代码一起版本控制
- ✅ 不同项目可以使用不同的画布颜色
- ✅ 更符合配置管理的最佳实践

**影响**:
- 需要从 `settings.json` 迁移配置到 `project.json`
- 配置方式更加清晰和规范
- 项目的可移植性更好
