# HoneyGUI 组件命名规范检查报告

## ✅ 所有HoneyGUI组件已统一使用 `hg_` 前缀

---

## 组件清单

### 容器组件
- ✅ `hg_screen` - 屏幕容器（仅main.hml使用）
- ✅ `hg_panel` - 面板
- ✅ `hg_view` - 视图
- ✅ `hg_window` - 窗口
- ✅ `hg_canvas` - 画布

### 基础组件
- ✅ `hg_button` - 按钮
- ✅ `hg_label` - 标签
- ✅ `hg_text` - 文本（类型定义中）
- ✅ `hg_input` - 输入框
- ✅ `hg_textarea` - 文本域（类型定义中）
- ✅ `hg_image` - 图片

### 表单组件
- ✅ `hg_checkbox` - 复选框
- ✅ `hg_radio` - 单选框
- ✅ `hg_switch` - 开关（类型定义中）
- ✅ `hg_slider` - 滑块（类型定义中）

---

## 命名规范

### ✅ 正确示例

**组件类型**:
```typescript
type: 'hg_button'
type: 'hg_panel'
type: 'hg_screen'
```

**XML标签**:
```xml
<hg_button id="btn1" />
<hg_panel id="panel1" />
<hg_screen id="mainScreen" />
```

**代码判断**:
```typescript
if (component.type === 'hg_button') { ... }
if (comp.type.startsWith('hg_')) { ... }
```

### ❌ 错误示例

**不要使用无前缀的名称**:
```typescript
type: 'button'  // ❌ 错误
type: 'panel'   // ❌ 错误
type: 'screen'  // ❌ 错误
```

**不要使用其他前缀**:
```typescript
type: 'gui_button'  // ❌ 错误（除非是兼容性处理）
type: 'ui_button'   // ❌ 错误
```

---

## 与其他组件的区分

### HoneyGUI组件 (使用 `hg_` 前缀)
```typescript
// ✅ HoneyGUI组件
'hg_button'
'hg_panel'
'hg_screen'
```

### React组件 (不使用前缀)
```typescript
// ✅ React组件 - 不需要前缀
<div>
<button>
<input>
```

### HTML元素 (不使用前缀)
```html
<!-- ✅ HTML元素 - 不需要前缀 -->
<div class="container">
<button onclick="...">
<input type="text">
```

---

## 验证方法

### 1. 检查ComponentType定义
```bash
grep "ComponentType" src/webview/types.ts
```

**预期**: 所有类型都有 `hg_` 前缀

### 2. 检查组件库定义
```bash
grep "type:" src/webview/components/ComponentLibrary.tsx
```

**预期**: 所有 `type:` 值都有 `hg_` 前缀

### 3. 检查HML文件
```bash
grep -r "<hg_\|</hg_" ui/
```

**预期**: 所有HoneyGUI组件标签都有 `hg_` 前缀

---

## 兼容性处理

### 解析器支持多种格式（向后兼容）

**位置**: `src/hml/HmlParser.ts`

```typescript
private readonly VALID_COMPONENTS = new Set([
  // HoneyGUI标准组件 (hg_前缀)
  'hg_button', 'hg_panel', 'hg_screen', ...
  
  // 无前缀组件 (向后兼容) - 解析时自动转换为hg_前缀
  'button', 'panel', 'text', ...
]);
```

**标准化处理**:
```typescript
static normalizeComponentType(name: string): string {
  if (name.startsWith('hg_')) {
    return name;  // 已经是标准格式
  }
  
  // 无前缀的添加hg_前缀
  if (this.VALID_COMPONENTS.has(name)) {
    return `hg_${name}`;
  }
  
  return name;
}
```

---

## 组件库显示规则

### 显示在组件库中
- ✅ `hg_button`
- ✅ `hg_panel`
- ✅ `hg_view`
- ✅ `hg_window`
- ✅ 所有其他组件...

### 不显示在组件库中
- ❌ `hg_screen` - 仅供内部使用，由main.hml自动包含

**代码**:
```typescript
// ComponentLibrary.tsx
{componentDefinitions.map((component) => {
  if (component.type === 'hg_screen') {
    return null;  // 不显示
  }
  return <ComponentItem ... />;
})}
```

---

## 总结

✅ **所有HoneyGUI组件都已正确使用 `hg_` 前缀**

✅ **与React/HTML组件清晰区分**

✅ **命名规范统一一致**

✅ **支持向后兼容（自动转换）**

---

**检查时间**: 2025-11-21 17:59  
**状态**: ✅ 命名规范完全符合要求  
**问题**: 无
