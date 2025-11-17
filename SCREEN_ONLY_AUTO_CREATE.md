# Screen 容器仅自动创建 - 设计变更

## 变更说明

**变更日期**: 2025-11-17

**变更原因**: 确保 Screen 容器的权威性和一致性

**变更内容**: Screen 容器只能从 project.json 自动创建，**不再支持从组件库拖放创建**

## 设计原则

### 1. 单一权威来源

**理念**: Screen 的大小应该只有一个权威来源 - `project.json`

**之前的问题**:
```typescript
// 来源1: project.json (自动创建 Screen)
{
  "resolution": "480X272"
}
// → Screen: 480x272

// 来源2: 组件库拖放 (手动创建 Screen)
{
  type: 'screen',
  defaultSize: { width: 1024, height: 768 }
}
// → Screen: 1024x768
```

**问题**: 两个来源的尺寸不一致，会导致混淆和设计错误

**解决方案**:
- ✅ 移除组件库中的 Screen 定义
- ✅ Screen 只能通过 project.json 自动创建
- ✅ 确保设计时的分辨率与实际设备一致

### 2. 符合实际设备模型

**理念**: Screen 应该反映真实的设备屏幕

**实际情况**:
- 设备只有一个物理屏幕
- 设备分辨率在项目创建时确定
- Screen 大小不应该随意更改

**对比**:

| 概念 | 实际情况 | 设计器实现 |
|------|---------|----------|
| 物理屏幕 | 设备只有一个 | ❌ 之前支持多个（拖放） |
| 屏幕分辨率 | 项目创建时确定 | ❌ 之前可以随意创建不同尺寸 |
| 层级关系 | Screen 是根容器 | ⚠️ 之前支持嵌套 Screen |

**解决方案**:
- ✅ Screen 只能自动创建（每个项目一个）
- ✅ Screen 大小 = project.json 的 resolution
- ✅ Screen 不能嵌套（已经是根容器）

## 修改内容

### 1. 从 ComponentLibrary 移除 Screen

**文件**: `src/webview/components/ComponentLibrary.tsx`

**修改前**:
```typescript
const componentDefinitions: ComponentDefinition[] = [
  // ... 其他组件
  {
    type: 'screen',
    name: '屏幕',
    icon: '📱',
    defaultSize: { width: 1024, height: 768 },
    properties: [...]
  },
];
```

**修改后**:
```typescript
const componentDefinitions: ComponentDefinition[] = [
  // ... 其他组件
  // ✅ Screen 已从组件库中移除
];
```

### 2. 从 DesignerCanvas 移除 Screen 渲染

**文件**: `src/webview/components/DesignerCanvas.tsx`

**修改前**:
```typescript
switch (component.type) {
  case 'screen':
    // 渲染 Screen 容器
    return <div>...</div>;
  case 'button':
    // ...
}
```

**修改后**:
```typescript
switch (component.type) {
  // ✅ 'screen' case 已移除
  case 'button':
    // ...
}
```

**注意**: Screen 仍然作为组件类型存在（用于自动创建的 Screen），但不再支持从组件库拖放创建

### 3. 更新拖放逻辑注释

**文件**: `src/webview/App.tsx`

**修改前**:
```typescript
// 规则1: 容器类组件（View/Panel/Window/Screen）作为顶级组件
const isContainerComponent = ['view', 'panel', 'window', 'screen'].includes(componentType);
```

**修改后**:
```typescript
// 规则1: 容器类组件（View/Panel/Window）作为顶级组件
// - 注意: Screen 已从组件库中移除，只能通过 project.json 自动创建
const isContainerComponent = ['view', 'panel', 'window'].includes(componentType);
```

### 4. Store 类型兼容处理

**文件**: `src/webview/store.ts`

**修改**:
```typescript
type: 'screen' as ComponentType,  // 类型断言，兼容 ComponentType
```

**原因**: TypeScript 类型系统要求，但 'screen' 已从组件库中移除

## 使用方式

### 正确方式: 自动创建 Screen

```javascript
// project.json
{
  "name": "MyApp",
  "resolution": "480X272",
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
```

**流程**:
```
1. 打开设计器
2. DesignerPanel 读取 project.json
3. 自动创建 Screen
   - width: 480 (来自 resolution)
   - height: 272 (来自 resolution)
4. UI 组件添加到 Screen
```

### 错误方式: 无法从组件库拖放 Screen

```typescript
// ❌ 这种方式不再支持
const screen = {
  type: 'screen',
  width: 1024,  // 与 project.json 的 resolution 不一致
  height: 768
};
```

**原因**:
- ComponentLibrary 中没有 'screen' 定义
- 无法从组件库拖拽
- 即使手动创建，尺寸也不会匹配 project.json

## 工作流程

### 项目启动流程

```
启动 VS Code 扩展
  ↓
打开 HoneyGUI 设计器
  ↓
DesignerPanel._createNewDocument() / _loadFile()
  ↓
读取 project.json
  ↓
获取 resolution (e.g., "480X272")
  ↓
发送到 Webview
  ↓
App.tsx initializeWithProjectConfig({ resolution: "480X272" })
  ↓
store.ts createDefaultScreen("480X272")
  ↓
return { width: 480, height: 272 }
  ↓
渲染 Screen 容器
  ↓
✓ Screen 大小与项目分辨率一致
```

### 组件添加流程

```
从组件库拖拽 Button
  ↓
App.tsx handleCanvasDrop('button')
  ↓
查找 componentDef (type: 'button')
  ↓
创建 Button 组件
  ↓
查找 Screen 容器
  ↓
设置 Button.parent = screen.id
  ↓
转换坐标为相对坐标
  ↓
添加到 store
  ↓
✓ Button 显示在 Screen 内
```

## 对比: 之前 vs 现在

### 之前的问题

| 问题 | 描述 |
|------|------|
| **尺寸不一致** | 自动创建 Screen: project.json resolution<br>拖放 Screen: 组件库 defaultSize (1024x768) |
| **多个 Screen** | 用户可以从组件库拖放多个 Screen |
| **嵌套 Screen** | 用户可能将 Screen 嵌套在其他 Screen 内 |
| **分辨率不匹配** | 设计时的分辨率可能与实际设备不一致 |
| **概念混淆** | 两种 Screen 尺寸不同，用途不明确 |

### 现在的改进

| 改进 | 描述 |
|------|------|
| **单一来源** | Screen 大小只来自 project.json resolution |
| **自动创建** | 每个项目一个 Screen，自动创建 |
| **禁止拖放** | 组件库中没有 Screen，无法手动创建 |
| **一致性** | 设计时的分辨率与实际设备一致 |
| **清晰概念** | Screen = 设备屏幕，固定且权威 |

## 替代方案

### 如果确实需要多个容器

**推荐**: 使用 View/Panel/Window 组件

```typescript
// 从组件库拖放 View
{
  type: 'view',
  defaultSize: { width: 300, height: 200 },
  properties: {...}
}

// 或者 Panel
{
  type: 'panel',
  defaultSize: { width: 400, height: 300 },
  properties: {...}
}

// 或者 Window
{
  type: 'window',
  defaultSize: { width: 1024, height: 768 },
  properties: {...}
}
```

**不推荐**: 手动创建 Screen
```typescript
// ❌ 不推荐，即使可以手动创建 Screen
// 原因: Screen 应该反映真实设备屏幕，不应该有多个
```

## 技术实现

### Screen 创建的唯一入口

```typescript
// src/webview/store.ts
const createDefaultScreen = (resolution?: string): Component => {
  const parseResolution = (res?: string) => {
    if (!res) return { width: 1024, height: 768 };
    const parts = res.split('X');
    return {
      width: parseInt(parts[0]) || 1024,
      height: parseInt(parts[1]) || 768
    };
  };

  const size = parseResolution(resolution);

  return {
    id: `screen_${Date.now()}`,
    type: 'screen' as ComponentType,
    name: 'Default Screen',
    position: {
      x: 50,
      y: 50,
      width: size.width,    // 来自 project.json
      height: size.height   // 来自 project.json
    },
    // ...
  };
};
```

**调用时机**:
```typescript
// 1. 打开设计器时 (DesignerPanel._createNewDocument)
const screen = createDefaultScreen(projectConfig?.resolution);

// 2. 加载 HML 文件时 (DesignerPanel._loadFile)
const screen = createDefaultScreen(projectConfig?.resolution);

// 3. 初始化配置时 (store.initializeWithProjectConfig)
const components = [createDefaultScreen(config?.resolution)];
```

### 组件库过滤

```typescript
// src/webview/components/ComponentLibrary.tsx
const componentDefinitions: ComponentDefinition[] = [
  { type: 'button', ... },
  { type: 'label', ... },
  { type: 'view', ... },
  { type: 'panel', ... },
  { type: 'window', ... },
  { type: 'canvas', ... },
  // ✅ { type: 'screen', ... }, // 已移除
];
```

## 边界情况

### 没有 project.json

**行为**:
- Screen 大小: 1024x768 (默认值)
- 不报错，正常显示
- 用户会收到提示（建议创建 project.json）

### project.json 没有 resolution

**行为**:
- Screen 大小: 1024x768 (默认值)
- 控制台警告

### 旧的 HML 文件包含 screen

**行为**:
- 正常加载 HML 文件中的 screen
- 保留现有的 screen（向后兼容）
- 只是不能从组件库拖放创建**新的** screen

## 向后兼容

### 旧的 HML 文件

✅ **完全兼容**
- 可以正常加载包含 screen 的 HML 文件
- 可以编辑现有的 screen
- 只是不能创建**新的** screen

### 旧的 project.json

✅ **完全兼容**
- 没有 `designer` 配置 → 使用默认值
- 没有 `resolution` → 使用 1024x768

## 迁移步骤

### 对于现有项目

**无需任何操作**，完全向后兼容。

### 对于新项目

**建议**: 在 project.json 中添加 `resolution`

```json
{
  "name": "MyApp",
  "resolution": "480X272",
  "designer": {
    "canvasBackgroundColor": "#f0f0f0"
  }
}
```

## 文档更新

- ✅ `SCREEN_COMPONENT_SIZING.md` - 更新为仅自动创建
- ✅ `SCREEN_RESOLUTION_FIX.md` - 添加仅自动创建的说明
- ✅ `PROJECT_JSON_EXAMPLE.md` - 添加 resolution 示例
- ✅ `CANVAS_CONFIG_MIGRATION.md` - 更新 Screen 说明

## 总结

### 核心变更

1. ✅ Screen 只能从 project.json 自动创建
2. ✅ 组件库中移除 Screen 定义
3. ✅ DesignerCanvas 中移除 Screen 拖放渲染
4. ✅ Store 初始化优化

### 预期效果

1. **概念清晰**: Screen = 设备屏幕，只有一个
2. **尺寸一致**: Screen 大小 = project.json 的 resolution
3. **操作简单**: 用户无需关心 Screen 创建
4. **符合实际**: 与真实设备模型一致

### 用户操作

**打开设计器**:
```
✓ Screen 自动创建（大小来自 project.json）
✓ 画布背景色自动应用
✓ 可以开始拖放 UI 组件
```

**无法操作**:
```
❌ 从组件库拖放 Screen（已移除）
❌ 手动创建多个 Screen
❌ 修改 Screen 大小（只读，来自 resolution）
```

### 技术收益

1. **类型安全**: ComponentType 仍然包含 'screen'，但只在内部使用
2. **代码清晰**: 明确的 Screen 创建逻辑
3. **维护简单**: 无需处理多 Screen 的复杂逻辑
4. **减少错误**: 避免分辨率不匹配

## 相关文件

- ✅ `src/webview/components/ComponentLibrary.tsx` - 移除 Screen 定义
- ✅ `src/webview/components/DesignerCanvas.tsx` - 移除 Screen 渲染 case
- ✅ `src/webview/App.tsx` - 更新注释
- ✅ `src/webview/store.ts` - 类型断言
- ✅ `src/webview/types.ts` - ComponentType 保留 'screen'（内部使用）
- ✅ `SCREEN_ONLY_AUTO_CREATE.md` - 本文档
