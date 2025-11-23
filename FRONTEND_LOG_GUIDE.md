# 前端LOG查看指南

## ⚡ 快速开始（3步搞定）

如果你只想快速查看前端日志，按这3步操作：

```
1️⃣ 打开 .hml 文件（使用HoneyGUI设计器）
2️⃣ 按 Ctrl+Shift+P，输入 "webview"，选择 "Developer: Open Webview Developer Tools"
3️⃣ 在弹出窗口点击 "Console" 标签，查看日志
```

**就这么简单！** 👇 下面是详细说明。

---

## 📋 前端LOG检查结果

### ✅ LOG实现状态

经过检查，前端LOG实现**工作正常**，包括：

1. **初始化日志** - VSCode API初始化状态
2. **数据加载日志** - HML文件加载和组件数据
3. **保存日志** - 组件保存到文件
4. **错误日志** - 全局错误和Promise rejection
5. **调试日志** - 拖放操作（可通过开关控制）

---

## 🔍 如何查看前端LOG

### 方法一：打开Webview开发者工具（推荐）

这是查看前端LOG的**主要方法**，因为前端代码运行在VSCode的Webview中。

> ⚠️ **重要**: 前端日志在 **Webview开发者工具** 中，不是VSCode的输出面板！

#### 步骤：

1. **打开HoneyGUI设计器**
   - 在VSCode资源管理器中找到 `.hml` 文件
   - 右键点击文件
   - 选择 "使用HoneyGUI设计器打开"
   - 等待设计器完全加载（看到画布和组件库）

2. **打开开发者工具**
   
   **方式A - 使用命令面板（推荐）**：
   ```
   Ctrl+Shift+P (Windows/Linux) 或 Cmd+Shift+P (Mac)
   输入: Developer: Open Webview Developer Tools
   回车
   ```
   
   **方式B - 使用快捷键**：
   ```
   Ctrl+Shift+I (Windows/Linux)
   Cmd+Option+I (Mac)
   ```
   注意：需要确保焦点在设计器Webview上
   
   **方式C - 使用菜单**：
   ```
   菜单栏 → 帮助 → 切换开发人员工具
   ```

3. **查看Console标签**
   - 在开发者工具中点击 "Console" 标签
   - 这里会显示所有前端日志

#### 示例日志输出：

```
[HoneyGUI] VSCode API initialized successfully
[HoneyGUI App] Using existing VSCode API instance
[HoneyGUI App] 发送ready消息请求数据...
========== [Webview App] loadHml 消息处理开始 ==========
[Webview App] 接收到的组件数量: 3
[Webview App] 接收到的组件详情: hg_screen(id=screen_1), hg_view(id=view_1), hg_button(id=button_1)
[Webview App] 设置配置前，当前组件数: 0
[Webview App] 配置已设置
[Webview App] 背景色已设置
[Webview App] 准备设置组件...
[Webview App] setComponents 调用完成
[Webview App] 验证：当前store中的组件数量: 3
[Webview App] 验证：组件列表: hg_screen(id=screen_1), hg_view(id=view_1), hg_button(id=button_1)
========== [Webview App] loadHml 消息处理完成 ==========
```

---

### 方法二：查看后端日志（VSCode输出面板）

后端日志显示扩展主机的日志，不包含前端Webview的日志。

#### 步骤：

1. 打开VSCode输出面板
   ```
   Ctrl+Shift+U (Windows/Linux) 或 Cmd+Shift+U (Mac)
   或者: 菜单 → 查看 → 输出
   ```

2. 在输出面板右上角的下拉菜单中选择 **"HoneyGUI"**

3. 这里显示的是**后端日志**（扩展主机），例如：
   ```
   [2025-11-23 10:30:45] [INFO] HoneyGUI Visual Designer 正在激活...
   [2025-11-23 10:30:46] [INFO] DesignerPanel 开始加载文件 test.hml
   [2025-11-23 10:30:46] [DEBUG] 文件内容长度: 1234 字符
   ```

**注意**: 这里**看不到**前端Webview的 `console.log`，必须使用方法一。

---

## 🎯 不同场景的LOG查看

### 场景1: 检查设计器是否正常加载

**查看位置**: Webview开发者工具 Console

**关键日志**:
```javascript
[HoneyGUI] VSCode API initialized successfully
[HoneyGUI App] Using existing VSCode API instance
[Webview App] loadHml 消息处理开始
[Webview App] 接收到的组件数量: X
```

**如果看不到这些日志**:
- 检查是否打开了正确的开发者工具（必须是Webview的，不是主窗口的）
- 尝试刷新设计器（关闭重新打开）

---

### 场景2: 检查组件保存

**查看位置**: Webview开发者工具 Console

**关键日志**:
```javascript
[Webview Store] 准备保存到文件
[Webview Store] 当前组件数量: 3
[Webview Store] 当前组件详情: hg_screen(id=...), hg_view(id=...), ...
```

**触发方式**:
- 在设计器中添加/修改/删除组件
- 点击保存按钮
- 自动保存触发

---

### 场景3: 调试拖放操作

**查看位置**: Webview开发者工具 Console

**启用调试日志**:
1. 打开 `src/webview/App.tsx`
2. 修改第16行：
   ```typescript
   const DEBUG_DROP = true;  // 改为true
   ```
3. 重新构建：`npm run build:webview`
4. 重启设计器

**调试日志示例**:
```javascript
========== [拖放] handleCanvasDrop 开始 ==========
[拖放] ⚠️ 如果看不到日志，请右键设计器画布 → 检查元素，打开Webview开发者工具
[拖放] 组件类型: hg_button
[拖放] 当前选中: 无
[拖放] ========== 开始查找目标容器 ==========
[拖放] 鼠标画布坐标: (150, 200)
[拖放] 当前组件总数: 2
[拖放] 检查组件: hg_screen(screen_1)
[拖放]   绝对位置: (50, 50), 尺寸: 800x480
[拖放]   范围: X[50 - 850], Y[50 - 530]
[拖放]   鼠标在X范围内: true, 在Y范围内: true
[拖放]   ✓ 鼠标在此组件范围内
[拖放]   ✓ 设置为目标容器 (面积: 384000)
```

**注意**: 默认 `DEBUG_DROP = false`，生产环境不输出拖放日志以提高性能。

---

### 场景4: 检查错误

**查看位置**: Webview开发者工具 Console

**错误类型**:

1. **全局错误**:
   ```javascript
   [HoneyGUI Designer] Global error: TypeError: Cannot read property 'x' of undefined
   ```
   - 同时会在页面顶部显示红色错误条

2. **Promise rejection**:
   ```javascript
   [HoneyGUI Designer] Unhandled promise rejection: Error: Failed to load
   ```

3. **API不可用**:
   ```javascript
   [HoneyGUI] VSCode API not available, cannot send message: {command: 'save', ...}
   ```

---

## 🎬 视频教程式步骤

### 完整流程（从零开始）

```
第1步: 打开项目
├─ 在VSCode中打开包含 .hml 文件的项目
└─ 确保可以在资源管理器中看到 .hml 文件

第2步: 打开设计器
├─ 右键点击 .hml 文件
├─ 选择 "使用HoneyGUI设计器打开"
└─ 等待设计器加载完成（约2-3秒）

第3步: 打开开发者工具
├─ 按 Ctrl+Shift+P (打开命令面板)
├─ 输入: webview
├─ 选择: Developer: Open Webview Developer Tools
└─ 回车

第4步: 查看日志
├─ 在弹出的开发者工具窗口中
├─ 点击 "Console" 标签
└─ 看到前端日志输出

第5步: 触发操作查看日志
├─ 在设计器中拖放组件
├─ 保存文件
├─ 修改属性
└─ 观察Console中的日志变化
```

---

## 🛠️ 常见问题

### Q1: 打开开发者工具后看不到日志？

**原因**: 可能打开的是主窗口的开发者工具，而不是Webview的。

**解决方法**:

**方法1 - 使用命令面板（最可靠）**:
1. 关闭当前的开发者工具
2. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
3. 输入: `Developer: Open Webview Developer Tools`
4. 回车

**方法2 - 确保焦点正确**:
1. 点击设计器画布，确保焦点在Webview上
2. 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (Mac)
3. 如果打开的是主窗口的开发者工具，关闭它
4. 使用方法1

**方法3 - 重启设计器**:
1. 关闭设计器
2. 重新打开 `.hml` 文件
3. 使用方法1打开开发者工具

---

### Q2: 日志太多，如何过滤？

**方法1 - 使用Console过滤器**:
```
在Console顶部的过滤框中输入:
[Webview App]     # 只看App相关日志
[拖放]            # 只看拖放日志
error             # 只看错误
```

**方法2 - 使用Console级别过滤**:
- 点击Console左侧的级别按钮
- 取消勾选不需要的级别（Info, Debug等）
- 只保留Error和Warning

**方法3 - 清空日志**:
- 点击Console左上角的 🚫 图标清空
- 或按 `Ctrl+L`

---

### Q3: 如何保存日志？

**方法1 - 右键保存**:
1. 在Console中右键
2. 选择 "Save as..."
3. 保存为文本文件

**方法2 - 复制日志**:
1. 在Console中选择日志
2. `Ctrl+C` 复制
3. 粘贴到文本编辑器

**方法3 - 截图**:
- 使用截图工具截取Console内容

---

### Q4: 拖放日志看不到？

**原因**: `DEBUG_DROP` 默认为 `false`

**解决**:
```typescript
// src/webview/App.tsx 第16行
const DEBUG_DROP = true;  // 临时改为true

// 重新构建
npm run build:webview

// 重启设计器
```

**记得调试完改回 `false`**！

---

### Q5: 如何同时查看前端和后端日志？

**推荐布局**:

1. **左侧**: VSCode编辑器
2. **右上**: Webview开发者工具（前端日志）
3. **右下**: VSCode输出面板（后端日志）

**操作步骤**:
1. 打开设计器
2. 打开Webview开发者工具（`Ctrl+Shift+P` → `Developer: Open Webview Developer Tools`）
3. 打开输出面板（`Ctrl+Shift+U`）
4. 调整窗口布局

---

### Q6: 右键菜单没有"检查元素"选项？

**原因**: VSCode的Webview可能禁用了右键菜单，或者右键菜单被自定义了。

**解决**: 使用命令面板方法（最可靠）

```
步骤：
1. Ctrl+Shift+P (Windows/Linux) 或 Cmd+Shift+P (Mac)
2. 输入: webview
3. 选择: Developer: Open Webview Developer Tools
4. 回车
```

这个方法**100%可靠**，不依赖右键菜单。

---

### Q7: 命令面板找不到 "Developer: Open Webview Developer Tools"？

**可能原因**:
1. VSCode版本太旧
2. 没有打开Webview（设计器未打开）
3. 命令输入错误

**解决**:

**方法1 - 确保设计器已打开**:
```
1. 先打开 .hml 文件（使用HoneyGUI设计器打开）
2. 等待设计器完全加载
3. 再打开命令面板
4. 输入: Developer: Open Webview Developer Tools
```

**方法2 - 使用部分匹配**:
```
只输入: webview dev
或: open webview
系统会自动匹配
```

**方法3 - 检查VSCode版本**:
```
帮助 → 关于
确保版本 >= 1.80.0
```

**方法4 - 使用快捷键**:
```
点击设计器画布（确保焦点在Webview上）
按 Ctrl+Shift+I
```

---

## 📊 LOG分类总结

| LOG类型 | 位置 | 前缀 | 用途 |
|---------|------|------|------|
| 初始化 | Webview Console | `[HoneyGUI]` | API初始化状态 |
| 应用生命周期 | Webview Console | `[HoneyGUI App]` | 应用启动、消息处理 |
| 数据加载 | Webview Console | `[Webview App]` | HML加载、组件设置 |
| 数据保存 | Webview Console | `[Webview Store]` | 组件保存 |
| 拖放操作 | Webview Console | `[拖放]` | 拖放调试（需启用） |
| 错误 | Webview Console | `[HoneyGUI Designer]` | 全局错误 |
| 后端日志 | VSCode输出面板 | `[INFO]` `[ERROR]` 等 | 扩展主机日志 |

---

## 🎓 最佳实践

### 开发时
1. ✅ 始终打开Webview开发者工具
2. ✅ 使用Console过滤器聚焦关键日志
3. ✅ 遇到问题时启用 `DEBUG_DROP`
4. ✅ 同时查看前端和后端日志

### 调试时
1. ✅ 先看错误日志（红色）
2. ✅ 再看警告日志（黄色）
3. ✅ 最后看信息日志（蓝色）
4. ✅ 使用时间戳追踪事件顺序

### 生产环境
1. ✅ 确保 `DEBUG_DROP = false`
2. ✅ 只保留必要的日志
3. ✅ 错误日志始终保留
4. ✅ Webpack会自动移除部分console（见配置）

---

## 🔗 相关文档

- [RECENT_FIXES.md](RECENT_FIXES.md) - LOG修复记录
- [DEVELOPMENT.md](DEVELOPMENT.md) - 开发指南
- [webpack.config.js](webpack.config.js) - 构建配置（console清理规则）

---

## 📝 快速参考

### 打开Webview开发者工具
```
推荐方法: Ctrl+Shift+P → Developer: Open Webview Developer Tools
备用方法: Ctrl+Shift+I (确保焦点在Webview上)
菜单方法: 帮助 → 切换开发人员工具
```

### 启用拖放调试
```typescript
// src/webview/App.tsx
const DEBUG_DROP = true;
```

### 过滤日志
```
Console过滤框输入: [Webview App]
或: error
或: warning
```

### 清空日志
```
点击 🚫 图标
或: Ctrl+L
```

---

**最后更新**: 2025-11-23
