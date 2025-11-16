# HoneyGUI Designer 测试和调试指南

## 🔍 问题诊断

如果打开设计器后界面空白，请按照以下步骤诊断：

### 1. 检查扩展日志

在 VSCode 中打开输出面板 (Ctrl+Shift+U)，选择 "扩展主机" 查看是否有错误信息。

### 2. 检查 React Bundle 是否存在

```bash
# 在终端运行
ls -lh /home/howie_wang/workspace/vscode-extension-samples/honeygui-design/out/designer/webview/

# 应该看到:
# - index.html (1.8K)
# - styles.css (24K)
# - webview.js (791K)
```

### 3. 重新构建 React Bundle

如果文件不存在或需要更新：

```bash
cd /home/howie_wang/workspace/vscode-extension-samples/honeygui-design
npm run build:webview
```

### 4. 重新编译 TypeScript

```bash
npm run compile
```

如果编译失败，请查看具体的 TypeScript 错误并修复。

### 5. 重新打包 VSIX

```bash
vsce package --out honeygui-visual-designer-1.1.1.vsix
```

### 6. 重新安装扩展

1. 卸载旧版本扩展
2. 从 VSIX 安装新版本
3. 重启 VSCode

---

## 🧪 测试步骤

### 步骤 1: 安装最新版本

文件名: `honeygui-visual-designer-1.1.1.vsix`
大小: 76 MB

### 步骤 2: 打开扩展控制台

1. 打开 VSCode 命令面板 (Ctrl+Shift+P)
2. 输入 "开发人员: 显示日志文件"
3. 打开扩展日志查看器

### 步骤 3: 执行命令

打开命令面板并执行：

```
HoneyGUI: Open Designer
```

### 步骤 4: 查看输出

在控制台应该看到以下日志：

```
[HoneyGUI Designer Extension] Opening designer...
[HoneyGUI Designer Extension] React bundle found at: /path/to/honeygui-design/out/designer/webview/index.html
[HoneyGUI Designer Extension] Designer opened successfully
[HoneyGUI Designer] Webview URIs:
  Styles: vscode-webview-resource://xxx/out/designer/webview/styles.css
  Script: vscode-webview-resource://xxx/out/designer/webview/webview.js
  Webview Base: vscode-webview-resource://xxx/out/designer/webview/
```

### 步骤 5: 检查 Webview

1. 打开开发人员工具 (帮助 > 切换开发人员工具)
2. 查看 Console 标签页
3. 应该看到：
   ```
   [HoneyGUI Designer] Page loaded
   ```

如果有错误，请截图错误信息。

---

## 🐛 常见问题

### 问题 1: "React bundle 未找到"

**解决方案**: 运行 `npm run build:webview` 构建前端

### 问题 2: 界面空白，控制台无错误

**可能原因**: CSP 配置问题

**解决方案**: 下载最新的 VSIX 版本 (1.1.1)，已修复 CSP

### 问题 3: "Cannot read property 'hasChildNodes' of null"

**可能原因**: index.html 格式错误

**解决方案**: 确保 index.html 中有 `<div id="root"></div>`

### 问题 4: "vscode-resource: 路径错误"

**可能原因**: Webview URI 生成错误

**解决方案**: 确保 DesignerPanel.ts 使用 webview.asWebviewUri() 正确生成 URI

---

## 📊 预期行为

### 正常加载时

当你打开设计器时，应该看到：

```
┌─────────────────────────────────────────────────────────────┐
│ [保存] [撤销] [重做] | [选择] [移动] | [网格] | 100% [+] [适应] | [生成代码] [预览] │
├──────────┬──────────────────────────────────────────────────┬───────────┤
│          │                                                  │           │
│ 📦 组件库│                                                  │  属性     │
│ 🔘 按钮  │                                                  │  ───────── │
│ 🏷️ 标签  │                  画布区域                          │  名称:     │
│ 📝 输入框│                                                  │  [输入框]  │
│ 📄 文本  │                                                  │            │
│ 🖼️ 图片  │                                                  │  X: [0]    │
│ ☑️ 复选框│                                                  │  Y: [0]    │
│ ⭕ 单选框│                                                  │            │
│ 📦 容器  │                                                  │  样式      │
│ 🪟 面板  │                                                  │  背景色:   │
│          │                                                  │  [颜色选择]│
│ ─────────│                                                  │            │
│ 📂 控件树│                                                  │  [🖼️] 图片 │
│ 📦 root  │                                                  │  图片路径: │
│  ├─ 🏷️ label│                                              │  [_______] │
│  └─ 🔘 button│                                              │            │
│          │                                                  │  事件      │
│          │                                                  │  OnClick:  │
│          │                                                  │  [_______] │
└──────────┴──────────────────────────────────────────────────┴───────────┘
```

---

## 🔄 如果仍然空白

请提供以下信息：

1. **VSCode 版本** (帮助 > 关于)
2. **操作系统** (Windows/Linux/Mac)
3. **扩展日志** (输出 > 扩展主机)
4. **Webview 控制台截图** (Ctrl+Shift+I 打开)
5. **文件列表截图** (运行 `ls -lh out/designer/webview/`)

---

## ✅ 验证检查清单

在报告问题前，请确认：

- [ ] 运行了 `npm run build:webview`
- [ ] 运行了 `npm run compile` (无错误)
- [ ] 重新打包了 VSIX
- [ ] 卸载并重新安装了扩展
- [ ] 重启了 VSCode
- [ ] 检查了扩展日志
- [ ] 检查了 Webview 控制台

---

## 📝 当前版本信息

**VSIX 文件**: `honeygui-visual-designer-1.1.1.vsix`
**大小**: 76 MB
**包含文件**:
- out/designer/webview/index.html (1.8K)
- out/designer/webview/styles.css (24K)
- out/designer/webview/webview.js (791K)

**修复内容** (vs 1.1.0):
1. ✅ 修复了资源 URL 生成 (使用 webview.asWebviewUri)
2. ✅ 添加了 CSP nonce
3. ✅ 添加了详细日志
4. ✅ 添加了错误处理
5. ✅ 移除了重复的函数

---

**最后更新**: 2025-11-13
**版本**: 1.1.1
