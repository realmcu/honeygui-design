# HG_Screen容器组件解决方案

## 🎯 需求总结

1. ✅ **hg_screen不显示在组件库**，但可在画布上选中和调整
2. ✅ **自动创建hg_screen**：初始化时或拖拽组件时自动创建
3. ✅ **第一个hg_view自动放入screen**
4. ✅ **后续hg_view可以独立存在**（多容器并行）
5. ✅ **hg_view默认尺寸匹配screen**

## ✅ 已实施的解决方案

### 1. 组件库配置

**位置**: `src/webview/components/ComponentLibrary.tsx:148-150`

```typescript
// 不在组件库面板显示 screen 组件（仅供内部使用）
if (component.type === 'hg_screen') {
  return null;
}
```

**效果**: hg_screen不会出现在组件库面板中

---

### 2. 自动创建hg_screen

**位置**: `src/webview/App.tsx:handleCanvasDrop`

```typescript
// 如果没有找到screen容器，自动创建一个
if (!screenContainer) {
  // 从项目配置获取分辨率
  const projectConfig = useDesignerStore.getState().projectConfig;
  const resolution = projectConfig?.resolution || '800X480';
  const [width, height] = resolution.split('X').map(Number);
  
  // 创建screen组件 - 使用固定ID "mainScreen"
  screenContainer = {
    id: 'mainScreen',  // ✅ 固定ID，不会变化
    type: 'hg_screen',
    name: 'Screen',
    position: { x: 50, y: 50, width, height },
    style: { backgroundColor: '#000000' },  // 默认黑色
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 0,
    children: [],
    parent: null
  };
  
  addComponent(screenContainer, { save: false });
}
```

**触发时机**:
- 用户拖拽第一个组件到画布时
- 如果HML文件没有screen，自动创建

**特点**:
- ✅ 使用固定ID `mainScreen`
- ✅ 使用项目配置的分辨率
- ✅ 默认黑色背景
- ✅ 不立即保存（避免频繁IO）

---

### 3. 项目模板包含hg_screen

**位置**: `src/hml/HmlTemplateManager.ts:generateMainHml`

```typescript
static generateMainHml(
    projectName: string,
    resolution: string,
    appId?: string,
    minSdk?: string,
    pixelMode?: string
): string {
    const [width, height] = resolution.split('X').map(Number);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<hml>
    <meta>
        <project name="${projectName}" appId="${appId || ''}" resolution="${resolution}" ... />
        <author name="Anonymous" />
    </meta>
    <view>
        <hg_screen id="mainScreen" x="50" y="50" width="${width}" height="${height}" backgroundColor="#000000" />
    </view>
</hml>`;
}
```

**效果**: 新创建的项目自动包含hg_screen

---

### 4. 第一个hg_view自动放入screen

**位置**: `src/webview/App.tsx:handleCanvasDrop`

```typescript
// === 组件添加策略 ===
if (componentType === 'hg_view') {
  if (isFirstView) {
    // 第一个View: 放入screen容器，尺寸匹配screen
    parent = screenContainer.id;
    positionX = 0;  // 左上角对齐
    positionY = 0;
    width = screenContainer.position.width;   // ✅ 匹配screen宽度
    height = screenContainer.position.height; // ✅ 匹配screen高度
  } else {
    // 后续View: 独立存在，支持多容器并行
    parent = null;
    // 使用默认尺寸或用户拖放位置
  }
}
```

**效果**:
- ✅ 第一个hg_view自动成为screen的子组件
- ✅ 尺寸自动匹配screen
- ✅ 后续hg_view可以独立存在

---

### 5. hg_screen可选中和调整

**位置**: `src/webview/components/DesignerCanvas.tsx`

hg_screen作为普通组件渲染，可以：
- ✅ 点击选中
- ✅ 在属性面板中调整坐标
- ✅ 调整背景颜色
- ✅ 调整尺寸

---

## 🔧 工作流程

### 场景1: 创建新项目

1. 用户创建新项目
2. 系统生成包含hg_screen的main.hml
3. 用户打开设计器，看到黑色的screen容器
4. 用户拖拽组件，自动放入screen

### 场景2: 打开旧项目（无screen）

1. 用户打开旧的HML文件（没有screen）
2. 用户拖拽第一个组件
3. 系统自动创建mainScreen
4. 组件添加到screen中
5. 保存时screen和组件一起保存

### 场景3: 多容器布局

1. 用户拖拽第一个hg_view → 自动放入screen
2. 用户拖拽第二个hg_view → 独立存在（parent=null）
3. 用户拖拽第三个hg_view → 独立存在
4. 实现多容器并行布局

---

## 📊 组件层级关系

```
画布
├── hg_screen (id=mainScreen, parent=null)
│   ├── hg_view (第一个view, parent=mainScreen)
│   │   ├── hg_button
│   │   └── hg_text
│   ├── hg_button (直接子组件)
│   └── hg_panel
├── hg_view (第二个view, parent=null, 独立)
│   └── hg_image
└── hg_view (第三个view, parent=null, 独立)
    └── hg_list
```

---

## 🎨 hg_screen属性

### 默认属性
- **ID**: `mainScreen` (固定)
- **位置**: `x=50, y=50`
- **尺寸**: 从项目配置读取（如 480x272）
- **背景色**: `#000000` (黑色)

### 可调整属性
- ✅ 坐标 (x, y)
- ✅ 尺寸 (width, height)
- ✅ 背景颜色
- ❌ 不可删除（作为根容器）
- ❌ 不可设置parent（始终为null）

---

## 🐛 已修复的问题

### 问题1: ID变更
**原因**: 自动创建screen时使用时间戳生成ID  
**修复**: 使用固定ID `mainScreen`

### 问题2: 尺寸不匹配
**原因**: 使用默认尺寸800x480  
**修复**: 从项目配置读取分辨率

### 问题3: 无法拖拽组件
**原因**: 禁止自动创建screen，但HML文件没有screen  
**修复**: 恢复自动创建，但使用正确的ID和尺寸

### 问题4: 前端状态不同步
**原因**: React hooks闭包问题  
**修复**: 直接使用store.getState()

---

## 🧪 测试验证

### 测试1: 新项目
1. 创建新项目
2. 打开main.hml
3. 验证：有mainScreen，尺寸正确
4. 拖拽组件，验证：ID保持mainScreen

### 测试2: 旧项目
1. 打开没有screen的HML文件
2. 拖拽第一个组件
3. 验证：自动创建mainScreen
4. 保存，验证：screen被保存

### 测试3: 多容器
1. 拖拽第一个hg_view
2. 验证：parent=mainScreen
3. 拖拽第二个hg_view
4. 验证：parent=null

### 测试4: 属性调整
1. 选中mainScreen
2. 在属性面板调整背景色
3. 验证：颜色改变
4. 保存，验证：颜色被保存

---

## 📝 相关文件

- `src/webview/App.tsx` - 自动创建screen逻辑
- `src/webview/components/ComponentLibrary.tsx` - 隐藏screen
- `src/hml/HmlTemplateManager.ts` - 项目模板
- `src/webview/components/DesignerCanvas.tsx` - screen渲染
- `src/webview/components/PropertiesPanel.tsx` - 属性编辑

---

**更新时间**: 2025-11-21 17:37  
**状态**: ✅ 已实施，等待测试验证
