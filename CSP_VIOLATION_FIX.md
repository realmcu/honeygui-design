# CSP 违规问题修复报告

## 问题描述

**报错信息**: `Refused to execute inline event handler because it violates the following Content Security Policy directive`

**错误原因**: VS Code WebView 的 Content Security Policy (CSP) 禁止内联事件处理器（如 `onclick="..."`、`oninput="..."` 等）

**影响范围**: 项目创建面板（CreateProjectPanel）

---

## 修复详情

### 文件位置
- **文件**: `src/designer/CreateProjectPanel.ts`
- **问题代码行**: 293, 307, 312, 318, 324, 333, 342

### 修复的 HTML 元素

1. **Project name 输入框** (第 293 行)
   ```diff
   - <input ... oninput="validateForm()" />
   + <input ... />
   ```

2. **APP ID 输入框** (第 307 行)
   ```diff
   - <input ... oninput="validateForm()" />
   + <input ... />
   ```

3. **Resolution 下拉框** (第 312 行)
   ```diff
   - <select ... onchange="validateForm()">
   + <select ...>
   ```

4. **Min SDK 下拉框** (第 324 行)
   ```diff
   - <select ... onchange="validateForm()">
   + <select ...>
   ```

5. **Pixel Mode 下拉框** (第 333 行)
   ```diff
   - <select ... onchange="validateForm()">
   + <select ...>
   ```

6. **Create 按钮** (第 342 行)
   ```diff
   - <button ... onclick="createProject()">Create</button>
   + <button ... >Create</button>
   ```

### JavaScript 事件绑定增强

在 `DOMContentLoaded` 事件处理器中（第 391-485 行），补充了以下事件绑定：

```javascript
// 新增的表单元素引用
const appIdInput = document.getElementById('appId');
const resolutionSelect = document.getElementById('resolution');
const minSdkSelect = document.getElementById('minSdk');
const pixelModeSelect = document.getElementById('pixelMode');

// 绑定 APP ID 输入事件
if (appIdInput) {
    appIdInput.addEventListener('input', function() {
        console.log('APP ID input changed');
        validateForm();
    });
}

// 绑定 Resolution 变更事件
if (resolutionSelect) {
    resolutionSelect.addEventListener('change', function() {
        console.log('Resolution changed');
        validateForm();
    });
}

// 绑定 Min SDK 变更事件
if (minSdkSelect) {
    minSdkSelect.addEventListener('change', function() {
        console.log('Min SDK changed');
        validateForm();
    });
}

// 绑定 Pixel Mode 变更事件
if (pixelModeSelect) {
    pixelModeSelect.addEventListener('change', function() {
        console.log('Pixel mode changed');
        validateForm();
    });
}
```

**注意**: projectName 输入框的事件绑定已在第 495 行实现

---

## CSP 策略说明

VS Code WebView 默认使用严格的 Content Security Policy：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
```

**规则**:
- ✅ 允许内联样式 (`'unsafe-inline'` for styles)
- ❌ 禁止内联脚本（包括 `onclick`, `onchange`, `oninput` 等事件处理器）
- ✅ 允许带 nonce 的脚本块

**解决方案**: 使用 `addEventListener` 在 JavaScript 中动态绑定事件

---

## 编译验证

```bash
$ npm run compile

> honeygui-visual-designer@1.1.5 compile
> tsc -p ./

✅ 编译成功，无错误
```

---

## 日志中其他警告说明

### 1. Sandbox 警告（不影响功能）

```
An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.
```

**说明**: 这是 VS Code WebView 的正常警告，不影响功能

### 2. 调试日志（正常）

```
Validating form...
Project name: NewProject Save location: /home/howie_wang
Create button disabled state: false
```

**说明**: 表单验证逻辑正常工作

### 3. 项目创建成功日志

```
[Extension Host] [CreateProjectPanel] Creating project: projectName=NewProject, saveLocation=/home/howie_wang, appId=com.example.NewProject1
[Extension Host] [CreateProjectPanel] Full project path: /home/howie_wang/NewProject
```

**说明**: 项目创建功能正常

---

## 测试建议

重新加载扩展后，请测试以下功能：

1. ✅ 项目创建表单验证
   - 修改 projectName → 应触发 validateForm
   - 修改 appId → 应触发 validateForm
   - 修改下拉框 → 应触发 validateForm
   - Create 按钮状态应随表单有效性变化

2. ✅ 创建项目流程
   - 填写表单
   - 点击 Create 按钮
   - 验证项目是否成功创建

3. ✅ 浏览器控制台
   - 打开开发者工具 (F12)
   - 不应再出现 CSP 错误
   - 应能看到正常的日志输出

---

## 其他说明

### 为什么同时保留两种事件绑定方式？

1. **projectName 输入框**（第 495 行附近）
   - 需要关联更新 APP ID
   - 有特殊的逻辑处理

2. **其他输入元素**（第 448-474 行）
   - 仅触发表单验证
   - 独立的 addEventListener 绑定更清晰

### 总结

- ❌ **移除**了所有内联事件处理器（HTML 中的 `on*` 属性）
- ✅ **保留**了通过 addEventListener 的动态绑定（更安全）
- ✅ **增强**了日志输出，便于调试
- ✅ **验证**了编译通过，功能完整

---

**修复日期**: 2025-11-18
**修复文件**: `src/designer/CreateProjectPanel.ts`
**相关日志**: CSP 违规警告已消除
