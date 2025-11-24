# BUG修复：点击控件导致控件消失

## 问题描述

**严重级别**: 🔴 高

在设计器画布中单击控件时，控件会从画布上消失，但对应的HML描述文件中的数据仍然存在。重新打开设计器后，控件又能正常显示。

## 问题分析

### 根本原因

在 `DesignerCanvas.tsx` 中，每个渲染的组件同时绑定了两个事件处理器：
1. `onMouseDown` - 调用 `handleComponentMouseDown`
2. `onClick` - 调用 `handleClick`

这两个事件处理器都在处理组件选择逻辑，导致事件冲突：

```typescript
// 问题代码
const handleClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  const multi = e.ctrlKey || e.metaKey || e.shiftKey;
  if (multi) {
    addToSelection(component.id);
  } else {
    onComponentSelect(component.id);
  }
};

// 在渲染时同时绑定两个事件
<button
  onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
  onClick={handleClick}  // ❌ 冲突！
  ...
>
```

### 事件执行顺序

1. 用户点击控件
2. `onMouseDown` 触发 → `handleComponentMouseDown` 执行
3. `onClick` 触发 → `handleClick` 执行
4. 两次状态更新可能导致渲染异常，控件从DOM中消失

### 为什么HML文件没有变化

因为问题只发生在前端渲染层面，store中的 `components` 数组数据并未被删除，所以：
- HML文件内容正常
- 重新打开设计器后，从HML加载数据，控件重新显示

## 解决方案

### 修复内容

移除所有组件的 `onClick` 事件处理器和 `handleClick` 函数，只保留 `onMouseDown` 事件处理。

**修改文件**: `src/webview/components/DesignerCanvas.tsx`

### 修改前

```typescript
const handleClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  const multi = e.ctrlKey || e.metaKey || e.shiftKey;
  if (multi) {
    addToSelection(component.id);
  } else {
    onComponentSelect(component.id);
  }
};

// 所有组件都有onClick
<button
  onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
  onClick={handleClick}
  ...
>
```

### 修改后

```typescript
// 移除handleClick函数

// 只保留onMouseDown
<button
  onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  ...
>
```

### 影响的组件类型

- `hg_button`
- `hg_label`
- `hg_text`
- `hg_input`
- `hg_image`
- `hg_panel`
- `hg_view`
- `hg_window`
- `hg_canvas`
- 默认组件类型

## 附加修复

在修复过程中，还发现并修复了以下问题：

### 1. CommandManager未定义

**文件**: `src/webview/store.ts`, `src/webview/utils/keyboardShortcuts.ts`

**问题**: 代码中引用了 `CommandManager` 类，但该类未定义

**修复**: 
- 移除 `store.ts` 中的 `export const commandManager = new CommandManager(50);`
- 注释掉 `keyboardShortcuts.ts` 中的 undo/redo 功能（待后续实现）

## 测试验证

### 测试步骤

1. 启动VSCode扩展开发环境
2. 打开或创建一个HML文件
3. 在设计器中拖拽添加多个控件
4. 单击各个控件进行选择
5. 验证控件不会消失
6. 使用Ctrl+点击进行多选
7. 验证所有操作正常

### 预期结果

- ✅ 单击控件时，控件被选中但不消失
- ✅ 控件边框显示选中状态（蓝色高亮）
- ✅ 可以正常拖动控件
- ✅ Ctrl+点击可以多选控件
- ✅ 属性面板正常显示选中控件的属性

## 相关文件

- `src/webview/components/DesignerCanvas.tsx` - 主要修复文件
- `src/webview/store.ts` - 移除未定义的commandManager
- `src/webview/utils/keyboardShortcuts.ts` - 注释undo/redo功能

## 提交信息

```
fix: 修复点击控件导致控件消失的BUG

- 移除DesignerCanvas中的onClick事件处理器
- 只保留onMouseDown处理组件选择
- 移除未定义的CommandManager引用
- 注释掉未实现的undo/redo功能

Fixes: 点击控件时控件从画布消失但HML文件正常的问题
```

## 日期

2025-11-23
