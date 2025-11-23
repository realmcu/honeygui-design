# 快速LOG查看指南

## 前端日志（Webview）

### 3步查看前端日志

```
1. 打开 .hml 文件（使用HoneyGUI设计器）
2. 按 Ctrl+Shift+P，输入 "webview"
3. 选择 "Developer: Open Webview Developer Tools"
```

### 常见日志

```javascript
// 初始化
[HoneyGUI] VSCode API initialized successfully

// 加载数据
[Webview App] 接收到的组件数量: 3

// 保存
[Webview Store] 准备保存到文件

// 错误
[HoneyGUI Designer] Global error: ...
```

---

## 后端日志（扩展主机）

### 查看后端日志

```
1. 按 Ctrl+Shift+U（打开输出面板）
2. 在右上角下拉菜单选择 "HoneyGUI"
```

### 常见日志

```
[INFO] HoneyGUI Visual Designer 正在激活...
[DEBUG] 文件内容长度: 1234 字符
[ERROR] 保存失败: ...
```

---

## 区别

| 类型 | 位置 | 内容 |
|------|------|------|
| **前端日志** | Webview开发者工具 | React组件、UI交互、拖放操作 |
| **后端日志** | VSCode输出面板 | 文件操作、HML解析、代码生成 |

---

## 故障排除

### 问题：右键没有"检查元素"

**解决**: 使用命令面板（`Ctrl+Shift+P` → `Developer: Open Webview Developer Tools`）

### 问题：看不到日志

**检查**:
1. 是否打开了Webview开发者工具（不是主窗口的）
2. 是否点击了Console标签
3. 是否有日志级别过滤

### 问题：找不到命令

**确保**:
1. 设计器已打开
2. VSCode版本 >= 1.80.0
3. 输入完整命令或部分匹配

---

## 详细文档

完整指南请查看: [FRONTEND_LOG_GUIDE.md](FRONTEND_LOG_GUIDE.md)
