# HoneyGUI 调试速查表

> **当你遇到问题时，这是最快的信息收集方法**

---

## 🚨 遇到问题？按这个顺序收集信息

### 第一步：查看扩展日志（最重要！）

1. 打开 VS Code **输出面板** (Ctrl+Shift+U)
2. 在下拉菜单中选择 **"HoneyGUI Design"**
3. 查看最后的错误消息（红色或 WARN 级别的）

**快速命令：**
```
Ctrl+Shift+P → "HoneyGUI: Show Logs"
```

---

### 第二步：查看 Webview 调试器

如果设计器界面空白或有问题：

1. 打开设计器
2. 按 **Ctrl+Shift+I** 打开开发者工具
3. 切换到 **Console** 标签
4. 截图所有红色错误消息

---

### 第三步：复制相关信息给 AI

使用以下格式发送信息给 AI：

```markdown
✅ **问题简述：** [一句话描述]

✅ **复现步骤：**
1. [第一步]
2. [第二步]
3. [出现问题]

✅ **扩展日志（最后10-20行）：**
```
[在这里粘贴日志]
```

✅ **环境：** [Windows/Mac/Linux], VS Code [版本]
```

---

## 📋 常见场景：需要收集什么

### 场景 1：扩展无法启动

需要提供：
- [ ] 扩展输出日志（完整）
- [ ] VS Code 版本
- [ ] 运行 `npm run compile` 的输出

**快速诊断：**
```bash
# 在终端运行
npm run compile
```
如果有错误，复制完整输出给 AI。

---

### 场景 2：设计器打开后空白

需要提供：
- [ ] 扩展日志
- [ ] Webview Console 截图（Ctrl+Shift+I）
- [ ] 是否运行了 `npm run serve:webview`？（开发模式）

**快速修复尝试：**
```bash
# 在终端1
npm run serve:webview

# 在终端2
npm run watch
```
然后按 F5 重新启动调试。

---

### 场景 3：项目创建失败

需要提供：
- [ ] 完整的扩展日志
- [ ] 项目路径和名称
- [ ] 当前工作区信息

---

### 场景 4：代码生成失败

需要提供：
- [ ] 扩展日志中的错误信息
- [ ] HML 文件内容（如果有）
- [ ] 目标输出目录

---

### 场景 5：预览不工作

需要提供：
- [ ] 扩展日志
- [ ] PreviewService 相关日志
- [ ] HoneyGUI Runner 路径配置

---

## 🔍 如何获取这些信息

### 获取扩展日志

**方法 1：**
```
Ctrl+Shift+P → "HoneyGUI: Copy Logs"
```
日志会自动复制到剪贴板

**方法 2：**
```
Ctrl+Shift+P → "HoneyGUI: Export Logs" → 保存文件
```

**方法 3（手动）：**
1. Ctrl+Shift+U 打开输出面板
2. 选择 "HoneyGUI Design"
3. 全选 (Ctrl+A) 并复制 (Ctrl+C)

---

### 获取 Webview Console 日志

1. 打开 HoneyGUI 设计器
2. 按 **Ctrl+Shift+I**（Windows/Linux）或 **Cmd+Option+I**（Mac）
3. 切换到 **Console** 标签
4. 右键点击错误消息 → "Save as..." 保存日志

或者：
- 截图错误消息
- 右键复制错误堆栈

---

### 获取 VS Code 版本

```
菜单 → Help → About
```

或者：
```
Ctrl+Shift+P → "About"
```

---

### 获取扩展信息

```
Ctrl+Shift+P → "HoneyGUI: Show Extension Info"
```

会显示：
- 扩展版本
- 安装路径
- Node.js 版本
- 平台信息

---

## 🛠️ 常用调试命令

| 命令 | 作用 | 快捷键 |
|------|------|--------|
| `HoneyGUI: Show Logs` | 显示日志输出通道 | Ctrl+Shift+P → 输入命令 |
| `HoneyGUI: Clear Logs` | 清空日志 | Ctrl+Shift+P → 输入命令 |
| `HoneyGUI: Copy Logs` | 复制日志到剪贴板 | Ctrl+Shift+P → 输入命令 |
| `HoneyGUI: Export Logs` | 导出日志到文件 | Ctrl+Shift+P → 输入命令 |
| `HoneyGUI: Set Log Level` | 设置日志详细程度 | Ctrl+Shift+P → 输入命令 |
| `Developer: Reload Window` | 重启扩展 | Ctrl+Shift+P → 输入命令 |
| `Developer: Toggle Developer Tools` | 打开 VS Code 开发者工具 | Ctrl+Shift+P → 输入命令 |

---

## 📤 发送信息给 AI 的最佳格式

### 推荐格式（Markdown）

````markdown
## 问题报告

**描述：**
[用一句话描述问题]

**复现步骤：**
1. [第一步]
2. [第二步]
3. [触发问题]

**预期结果：**
[描述期望发生什么]

**实际结果：**
[描述实际发生了什么]

**扩展日志：**
```
[粘贴日志内容]
```

**环境信息：**
- OS: [Windows 10 / macOS / Ubuntu]
- VS Code: [版本号]
- Extension: [版本号]
- Node.js: [node --version]

**附加信息：**
- [截图]
- [相关文件]
- [其他信息]
`````

---

## ⚡ 快速响应模板

### 模板 1：扩展无法启动

````markdown
**问题：** 扩展启动失败

**日志：**
```
[paste extension logs here]
```

**npm run compile 输出：**
```
[paste compile output]
```

**环境：** [Your OS], VS Code [version]
`````

### 模板 2：功能异常

````markdown
**问题：** [Feature] 无法正常工作

**复现：**
1. [Step 1]
2. [Step 2]
3. [Error occurs]

**日志片段：**
```
[paste relevant log lines]
```

**截图：** [Attach screenshot if applicable]
`````

---

## 🎯 最少必需信息

如果时间紧急，至少提供：

1. **问题描述**（一句话）
2. **扩展日志**（最后 10-20 行）
3. **环境**（操作系统 + VS Code 版本）

**示例：**
```markdown
**问题：** 点击 "Open Designer" 后没有任何反应

**日志：**
```
[2025-01-16 10:30:15] HoneyGUI 启动
[2025-01-16 10:30:20] 错误：无法加载 webview
```

**环境：** Windows 11, VS Code 1.85.0
```

---

## 💡 专业提示

### 在问题发生前启用详细日志

```
Ctrl+Shift+P → "HoneyGUI: Set Log Level" → "Debug"
```

然后再复现问题，这样可以获得更多信息。

### 捕获完整的错误堆栈

在日志中查找：
- `ERROR` 或 `WARN` 级别的消息
- JavaScript 堆栈跟踪（以 `at` 开头的行）
- 文件名和行号（如 `DesignerPanel.ts:156`）

### 一次性收集所有信息

运行以下命令序列：

```
1. Ctrl+Shift+P → "HoneyGUI: Clear Logs"
2. 复现问题
3. Ctrl+Shift+P → "HoneyGUI: Copy Logs"
4. 粘贴到报告
```

---

## ❌ 不要发送的信息

- ❌ 超过 500 行的完整日志（除非特别要求）
- ❌ 与问题无关的其他扩展日志
- ❌ 不包含时间戳的日志片段
- ❌ 模糊不清的问题描述（如"不工作"、"出错了"）

---

## ✅ 信息质量检查清单

在发送给 AI 之前，检查：

- [ ] 问题描述是否清晰具体？
- [ ] 复现步骤是否详细可执行？
- [ ] 日志是否包含错误消息？
- [ ] 是否包含了时间戳？
- [ ] 是否说明了环境和版本？
- [ ] 是否提供了实际的错误消息 vs. "出错了"？
- [ ] 是否包含相关截图或代码？

---

## 🆘 紧急问题

如果扩展完全无法使用：

```
1. 收集扩展日志
2. 运行: npm run compile
3. 复制任何错误消息
4. 提供环境信息
5. 说明是首次安装还是更新后出现问题
```

---

**记住：** 信息越详细，AI 就能越快定位和解决问题！
