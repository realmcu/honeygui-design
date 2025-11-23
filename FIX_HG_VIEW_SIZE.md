# 修复：hg_view 使用项目配置的分辨率

## 问题描述

**现象**：拖拽新的 `hg_view` 组件到画布时，大小固定为 `350x250`，不会根据项目配置的分辨率自动调整。

**影响**：
- 如果项目分辨率是 `800x480`，新建的 hg_view 却只有 `350x250`
- 用户需要手动调整大小，体验不好
- 不符合直觉：hg_view 应该默认填满整个屏幕

## 原因分析

### 旧逻辑

```typescript
// ComponentLibrary.tsx - 硬编码的默认大小
{
  type: 'hg_view',
  name: '视图',
  defaultSize: { width: 350, height: 250 },  // ← 固定值
}

// App.tsx - 直接使用硬编码值
let width = componentDef.defaultSize.width;   // 350
let height = componentDef.defaultSize.height; // 250
```

### 问题
- `hg_view` 的大小是在 `ComponentLibrary.tsx` 中硬编码的
- 创建组件时直接使用这个固定值，**完全忽略了项目配置**
- 项目配置的分辨率存储在 `store.canvasSize` 中，但没有被使用

## 修复方案

### 新逻辑

```typescript
// App.tsx - 动态使用项目分辨率
const canvasSize = useDesignerStore.getState().canvasSize;

// 对于 hg_view，优先使用项目配置的分辨率
let width = componentType === 'hg_view' && canvasSize 
  ? canvasSize.width   // 使用项目分辨率（如 800）
  : componentDef.defaultSize.width;  // 其他组件使用默认值

let height = componentType === 'hg_view' && canvasSize 
  ? canvasSize.height  // 使用项目分辨率（如 480）
  : componentDef.defaultSize.height;
```

### 逻辑说明

1. **hg_view 组件**：
   - 如果项目配置存在 → 使用 `canvasSize.width` 和 `canvasSize.height`
   - 如果项目配置不存在 → 回退到默认值 `350x250`

2. **其他组件**（Button、Panel等）：
   - 继续使用各自的默认大小
   - 不受项目分辨率影响

## 效果对比

### 修复前
```
项目分辨率: 800x480
拖拽 hg_view → 大小: 350x250 ❌ (需要手动调整)
```

### 修复后
```
项目分辨率: 800x480
拖拽 hg_view → 大小: 800x480 ✅ (自动匹配)
```

## 测试验证

### 测试步骤
1. 创建一个新项目，设置分辨率为 `800x480`
2. 从组件库拖拽 `hg_view` 到画布
3. 检查新创建的 hg_view 大小

### 预期结果
- hg_view 的宽度应该是 `800`
- hg_view 的高度应该是 `480`
- 完全填满画布

### 边界情况
- **没有项目配置**：回退到默认值 `350x250`
- **其他组件**：不受影响，继续使用各自的默认大小
- **已存在的 hg_view**：不受影响，保持原有大小

## 相关代码

### 修改的文件
- `src/webview/App.tsx` - `handleCanvasDrop` 函数

### 相关配置
- `store.projectConfig.resolution` - 项目分辨率字符串（如 "800x480"）
- `store.canvasSize` - 解析后的尺寸对象 `{width: 800, height: 480}`

### 组件定义
- `src/webview/components/ComponentLibrary.tsx` - 组件默认大小定义

## 后续优化建议

### 1. 其他容器组件
考虑是否也需要为 `hg_panel` 和 `hg_window` 应用类似逻辑：
```typescript
const isFullScreenContainer = ['hg_view'].includes(componentType);
let width = isFullScreenContainer && canvasSize 
  ? canvasSize.width 
  : componentDef.defaultSize.width;
```

### 2. 配置化
可以在组件定义中添加标记：
```typescript
{
  type: 'hg_view',
  name: '视图',
  useProjectSize: true,  // ← 新增标记
  defaultSize: { width: 350, height: 250 },
}
```

### 3. 用户提示
在拖拽时显示提示：
```
"hg_view 将使用项目分辨率 800x480"
```

## 总结

✅ **修复完成**
- hg_view 现在会自动使用项目配置的分辨率
- 其他组件不受影响
- 提升了用户体验

---

**修复日期**: 2025-11-23  
**提交**: 039f7bd
