# Screen 组件尺寸说明

## 概述

Screen 组件在 HoneyGUI 设计器中有**两种创建方式**，尺寸来源不同：

## 1. 自动创建的 Screen（项目默认）

**触发时机**: 打开设计器时

**创建位置**: `src/designer/DesignerPanel.ts`

**尺寸来源**: `project.json` 中的 `resolution` 字段

**示例**:
```json
// project.json
{
  "name": "MyApp",
  "resolution": "480X272",
  "mainHmlFile": "ui/main.hml"
}
```

**结果**:
- Screen 大小: 480x272
- ID: `screen_${timestamp}`（动态生成，如 `screen_123456789`）
- 名称: "Default Screen"
- 角色: 项目的主容器，所有 UI 组件默认添加到这里

**代码实现**:
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
    type: 'screen',
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

## 2. 拖放创建的 Screen（组件库）

**触发时机**: 从组件库拖拽到画布

**创建位置**: `src/webview/App.tsx` (拖放逻辑)

**尺寸来源**: `componentDefinitions` 中的 `defaultSize`

**示例**:
```typescript
// src/webview/components/ComponentLibrary.tsx
{
  type: 'screen',
  name: '屏幕',
  icon: '📱',
  defaultSize: { width: 1024, height: 768 },  // 固定值
  properties: [...]
}
```

**结果**:
- Screen 大小: 1024x768（固定值，与 project.json 无关）
- ID: `screen_${timestamp}_${random}`（如 `screen_123456789_abcd`）
- 名称: `screen_1234`
- 角色: 额外的容器，支持多 Screen 并行布局

**代码实现**:
```typescript
// src/webview/App.tsx
const newComponent: Component = {
  id: componentId,
  type: componentType,  // 'screen'
  name: componentName,
  position: {
    x, y,
    width: componentDef.defaultSize.width,   // 1024
    height: componentDef.defaultSize.height  // 768
  },
  parent: null,  // 顶级组件
  // ...
};
```

## 两种方式的对比

| 特性 | 自动创建 Screen | 拖放创建 Screen |
|------|----------------|----------------|
| **触发时机** | 打开设计器时 | 从组件库拖放 |
| **尺寸来源** | project.json 的 resolution | componentDefinitions.defaultSize (1024x768) |
| **ID 格式** | screen_${timestamp} | screen_${timestamp}_${random} |
| **名称** | Default Screen | screen_${last4} |
| **数量** | 1 个（自动） | 0 或多个（手动） |
| **层级** | 主容器 | 附加容器 |
| **组件默认父级** | 是 | 否（需要手动设置） |

## 使用场景

### 场景 1: 单 Screen 应用（最常见）

```
项目结构:
- MyApp/
  - project.json (resolution: 480x272)
  - ui/
    - main.hml

设计器:
- 自动创建 Screen #0: 480x272
- UI 组件添加到 Screen #0
- 无需拖放 Screen 组件
```

### 场景 2: 多 Screen 应用（高级）

```
项目结构:
- MultiScreenApp/
  - project.json (resolution: 800x480)
  - ui/
    - main.hml

设计器:
1. 自动创建 Screen #0: 800x480（主界面）
2. 从组件库拖放 Screen #1: 1024x768（设置页面）
3. 从组件库拖放 Screen #2: 800x600（关于页面）

特点:
- 不同 Screen 可以有不同的分辨率
- 实现多页面切换
- 每个 Screen 独立管理自己的组件
```

### 场景 3: Screen 嵌套（不推荐）

```
虽然技术上支持，但通常不推荐 Screen 嵌套:
Screen #0
└── Screen #1 (从组件库拖放)
    └── Button

原因:
- Screen 应该是顶层容器
- 嵌套可能导致布局混乱
- 与实际设备显示模型不符
```

## 最佳实践

### ✅ 推荐做法

1. **单 Screen 应用**
   - 依赖自动创建的 Screen
   - 这个 Screen 的大小 = project.json 的 resolution
   - 所有 UI 组件添加到这个 Screen

2. **多 Screen 应用（如果确实需要）**
   - 主 Screen：自动创建，大小 = project.json 的 resolution
   - 其他 Screen：从组件库拖放，大小固定 1024x768
   - 使用 View/Panel 组件实现多区域布局（更推荐）

### ❌ 避免做法

1. **不要混淆两种 Screen**
   - 自动创建的 Screen：反映真实设备分辨率
   - 拖放的 Screen：固定 1024x768，与真实设备无关

2. **不要将拖放的 Screen 作为主容器**
   - 拖放的 Screen 不会根据 project.json 调整大小
   - 会导致设计时的分辨率与实际设备不匹配

3. **不要嵌套 Screen**
   - Screen 应该是顶层容器
   - 使用 View/Panel 实现嵌套布局

## 代码中的尺寸逻辑

### 自动创建 Screen 的流程

```
project.json (resolution: 480X272)
  ↓
DesignerPanel._createNewDocument() / _loadFile()
  ↓
读取 projectConfig.resolution = "480X272"
  ↓
postMessage { projectConfig: { resolution: "480X272" } }
  ↓
App.tsx initializeWithProjectConfig({ resolution: "480X272" })
  ↓
createDefaultScreen("480X272")
  ↓
parseResolution("480X272") → { width: 480, height: 272 }
  ↓
Screen: { width: 480, height: 272 } ✓
```

### 拖放创建 Screen 的流程

```
组件库 (defaultSize: 1024x768)
  ↓
用户拖放 Screen 到画布
  ↓
App.tsx handleCanvasDrop()
  ↓
查找 componentDefinitions (type: 'screen')
  ↓
获取 componentDef.defaultSize = { width: 1024, height: 768 }
  ↓
创建组件: { width: 1024, height: 768 }
  ↓
Screen: { width: 1024, height: 768 } ✓
```

## 常见问题

### Q: 为什么拖放的 Screen 是 1024x768，而不是 project.json 的分辨率？

**A**: 这是设计决定的两种不同用途：
- 自动创建的 Screen：反映设备实际分辨率（从 project.json）
- 拖放的 Screen：作为额外容器，使用固定尺寸（1024x768）

如果你需要多个不同分辨率的 Screen，可以在属性面板手动调整拖放 Screen 的大小。

### Q: 可以在组件库中修改 Screen 的 defaultSize 吗？

**A**: 可以，但不推荐：

```typescript
// ComponentLibrary.tsx
{
  type: 'screen',
  defaultSize: { width: 800, height: 480 },  // 修改这里
}
```

**为什么不推荐**:
- 这个 defaultSize 与 project.json 的 resolution 无关
- 会导致混淆：自动创建的 Screen 用 resolution，拖放的 Screen 用 defaultSize
- 建议保持 1024x768，在拖放后手动调整

### Q: 如何让拖放的 Screen 也使用 project.json 的分辨率？

**A**: 目前没有自动方式，需要手动调整：

1. 从组件库拖放 Screen
2. 选中 Screen
3. 在属性面板修改 Width 和 Height
4. 输入 project.json 中的分辨率值

或者修改代码：

```typescript
// App.tsx (不推荐)
if (componentType === 'screen') {
  // 从 projectConfig 获取分辨率
  const resolution = useDesignerStore.getState().projectConfig?.resolution;
  if (resolution) {
    const [width, height] = resolution.split('X').map(Number);
    newComponent.position.width = width;
    newComponent.position.height = height;
  }
}
```

### Q: Screen 组件的 defaultSize 有什么用？

**A**: 主要用于：
1. **拖放时**确定初始大小
2. **文档说明**表明这是一个较大容器
3. **保持一致性**与其他组件定义方式相同

但实际项目中，主要使用自动创建的 Screen（基于 project.json）。

## 总结

1. **自动创建的 Screen**: 使用 project.json 的 resolution（推荐）
2. **拖放创建的 Screen**: 使用 componentDefinitions.defaultSize（1024x768）
3. **两种 Screen 用途不同**:
   - 自动创建：主容器，反映设备真实分辨率
   - 拖放：额外容器，实现多 Screen 布局
4. **建议**: 单 Screen 应用只使用自动创建的 Screen

**关键点**: Screen 组件确实有 defaultSize（1024x768），但这个 defaultSize 只在从组件库拖放时使用；自动创建的 Screen 使用 project.json 的 resolution。
