# 🐛 VS Code API 重复获取错误修复报告

## 问题描述

**错误信息**: `An instance of the VS Code API has already been acquired`

**发生位置**: Webview 前端代码 (src/webview/)

---

## 🎯 问题根源

### 错误原因

VS Code Webview API (`acquireVsCodeApi()`) **只能被调用一次**。在代码中，该 API 被多次调用，导致运行时抛出错误。

### 错误代码位置

```typescript
// 文件 1: src/webview/index.tsx (第 18 行)
window.vscodeAPI = window.acquireVsCodeApi?.();

// 文件 2: src/webview/App.tsx (第 32 行)
const vscodeAPI = window.acquireVsCodeApi();  // ❌ 重复调用！
```

### 错误机制

1. **index.tsx** 首先加载，调用 `acquireVsCodeApi()` 并存储到 `window.vscodeAPI`
2. **App.tsx** 稍后加载，再次调用 `acquireVsCodeApi()`
3. VS Code 检测到第二次调用，抛出错误
4. React 无法正确初始化，导致界面空白

---

## 🔧 修复方案

### 修复方法

**原则**: 只调用一次 `acquireVsCodeApi()`，然后复用该实例

### 1. src/webview/index.tsx (保持不变)

```typescript
// ✅ 这是正确的：只在入口文件中调用一次
declare global {
  interface Window {
    acquireVsCodeApi(): any;
    vscodeAPI: any;  // 定义全局属性
  }
}

// 获取 API 并存储到全局
window.vscodeAPI = window.acquireVsCodeApi?.();
```

### 2. src/webview/App.tsx (修复后)

```typescript
// ✅ 修复后：复用已获取的 API
declare global {
  interface Window {
    vscodeAPI: any;  // 只声明使用，不重新获取
  }
}

useEffect(() => {
  // 直接使用 window.vscodeAPI，不再调用 acquireVsCodeApi()
  const vscodeAPI = window.vscodeAPI;

  // ✅ 添加安全检查
  if (!vscodeAPI) {
    console.error('VSCode API not found. Make sure index.tsx calls acquireVsCodeApi() first.');
    return;
  }

  setVSCodeAPI(vscodeAPI);
  // ... 其他代码
}, [setVSCodeAPI, setComponents]);
```

### 关键改动

1. **移除**：`window.acquireVsCodeApi()` 的第二次调用
2. **使用**：直接访问 `window.vscodeAPI`
3. **添加**：空值检查和安全验证

---

## 📦 发布修复版本

### 修复版本

**版本号**: 1.1.3
**文件**: `honeygui-visual-designer-1.1.3.vsix`
**大小**: 75.23 MB

### 修复内容

- ✅ 移除重复的 `acquireVsCodeApi()` 调用
- ✅ 复用 `window.vscodeAPI` 实例
- ✅ 添加错误处理和空值检查
- ✅ 重新编译 TypeScript
- ✅ 重新打包 Webview (webpack)
- ✅ 创建新的 VSIX 安装包

---

## 🔄 安装和使用

### 步骤 1: 卸载旧版本

**方法 A - 命令行**
```bash
code --uninstall-extension honeygui.honeygui-visual-designer
```

**方法 B - UI**
1. 打开 VSCode
2. 点击扩展面板 (Ctrl+Shift+X)
3. 找到 "HoneyGUI Visual Designer"
4. 点击 "卸载"
5. 重启 VSCode

### 步骤 2: 安装新版本

**方法 A - 命令行**
```bash
cd /home/howie_wang/workspace/vscode-extension-samples/honeygui-design
code --install-extension honeygui-visual-designer-1.1.3.vsix
```

**方法 B - UI**
1. 打开 VSCode
2. 按 Ctrl+Shift+X 打开扩展面板
3. 点击右上角的 "..." 菜单
4. 选择 "从 VSIX 安装..."
5. 导航到项目目录
6. 选择 `honeygui-visual-designer-1.1.3.vsix`
7. 点击 "安装"

### 步骤 3: 重启 VSCode

安装完成后：
- 如果是命令行安装，VSCode 会提示重启
- 如果是 UI 安装，可能需要手动重启

### 步骤 4: 测试修复

**测试步骤**:
```bash
# 1. 打开 VSCode

# 2. 打开输出面板 (Ctrl+Shift+U)
# 选择 "扩展主机"

# 3. 打开命令面板 (Ctrl+Shift+P)
# 输入: "HoneyGUI: Open Designer"

# 4. 查看输出面板日志
# 应该看到:
# [info] HoneyGUI Visual Designer 扩展已激活

# 5. 查看设计器
# 应该看到三栏界面：
# - 左侧：组件库
# - 中间：画布
# - 右侧：属性面板

# 6. 检查开发者工具 (Ctrl+Shift+I)
# 查看 Console 标签
# 不应该有错误
```

---

## ✅ 验证清单

安装新版本后，请验证：

- [ ] 扩展激活成功（输出面板）
- [ ] 没有 "An instance of the VS Code API has already been acquired" 错误
- [ ] 设计器界面正常显示
- [ ] 组件库显示正常
- [ ] 可以拖拽组件到画布
- [ ] 属性面板正常工作
- [ ] 撤销/重做功能正常
- [ ] 没有控制台错误

---

## 🐛 如果仍然存在问题

### 检查项 1: 确认安装的是正确版本

```bash
# 在 VSCode 扩展目录检查
cat ~/.vscode/extensions/honeygui.honeygui-visual-designer-*/package.json | grep version

# 应该显示: "version": "1.1.3"
```

### 检查项 2: 查看详细日志

1. 打开输出面板 (Ctrl+Shift+U)
2. 选择 "扩展主机"
3. 搜索 "HoneyGUI"
4. 查看是否有错误信息

### 检查项 3: 检查 Webview 控制台

1. 打开 HoneyGUI 设计器
2. 打开开发者工具 (Ctrl+Shift+I)
3. 查看 Console 标签
4. 截图错误信息（如果有）

### 检查项 4: 验证文件完整性

```bash
cd ~/.vscode/extensions/honeygui.honeygui-visual-designer-*/out/designer/webview/

# 检查文件是否存在
ls -lh

# 应该包含:
# - index.html
# - styles.css
# - webview.js
```

---

## 📊 版本对比

| 版本 | 状态 | 问题 | 解决方案 |
|-----|------|------|---------|
| 1.0.0 | ❌ 有 bug | API 重复获取 | 已修复 |
| 1.1.0 | ❌ 有 bug | API 重复获取 | 已修复 |
| 1.1.1 | ❌ 有 bug | API 重复获取 | 已修复 |
| 1.1.2 | ❌ 有 bug | API 重复获取 | 已修复 |
| **1.1.3** | ✅ **推荐** | **已修复** | **使用此版本** |

---

## 📝 技术细节

### VS Code Webview API 规范

**官方文档**: https://code.visualstudio.com/api/extension-guides/webview

**关键规则**:

```typescript
// ✅ 正确用法
const vscodeApi = acquireVsCodeApi();  // 只调用一次

// 在其他地方复用
vscodeApi.postMessage({/* ... */});

// ❌ 错误用法
const api1 = acquireVsCodeApi();
const api2 = acquireVsCodeApi();  // 抛出错误！
```

**设计原因**:
- VS Code API 是单例模式
- 防止多个实例竞争资源
- 确保消息传递的一致性

---

## 🎉 总结

**问题**: VS Code API 被重复调用

**影响**: Webview 空白，React 无法渲染

**修复**: 只调用一次 API，全局复用

**版本**: 1.1.3（已修复）

**状态**: ✅ 可投入使用

---

## 📞 支持

如果安装 1.1.3 版本后仍然遇到问题，请提供：

1. **VSCode 版本** (帮助 → 关于)
2. **操作系统** (Windows/Mac/Linux)
3. **扩展版本** (package.json 中的 version)
4. **错误截图**
5. **日志文件** (输出面板 → 扩展主机)

**联系方式**: 在项目中提交 issue

---

**修复时间**: 2025-11-13 14:15
**修复版本**: 1.1.3
**修复者**: Claude Code 🤖
