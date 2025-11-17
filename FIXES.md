# HoneyGUI 设计器 Bug 修复总结

## 修复记录 (2025-11-17)

### ✅ Bug #1: Webview 资源 403 Forbidden 错误

**现象**: 设计器黑屏，浏览器控制台显示 403 Forbidden 错误

**根本原因**: Webpack 代码分割 + Webview 安全策略冲突

```
1. Webpack SplitChunks 生成多个文件（vendor.common.js, vendor.lucide-react.js）
2. HtmlWebpackPlugin 自动插入这些 <script> 标签到 index.html
3. 这些自动插入的引用没有经过 webview.asWebviewUri() 转换
4. VS Code Webview 拒绝加载未经转换的本地资源 → 403 Forbidden
```

**解决方案**:
- `webpack.config.js` (第72行): 禁用 splitChunks
  ```javascript
  splitChunks: false,  // VS Code Webview 中禁用代码分割
  ```

**影响**: 所有代码打包到一个文件（main.{hash}.js，约 800KB）

---

### ✅ Bug #2: Webpack 文件哈希导致资源加载失败

**现象**: 设计器黑屏，找不到 `webview.js` 和 `styles.css`

**根本原因**: Webpack 生产环境使用 [contenthash] 生成带哈希的文件名，但代码硬编码查找固定文件名

```
期望加载: webview.js
实际文件: main.85d16eb8cf81ab8ee58a.js
结果: 404 Not Found
```

**解决方案**:
- `src/designer/DesignerPanel.ts` (第157-179行): 动态查找带哈希的文件
  ```typescript
  // 查找文件
  const files = fs.readdirSync(onDiskPath.fsPath);
  const jsFile = files.find(f => /^main\..+\.js$/.test(f));
  const cssFile = files.find(f => /^main\..+\.css$/.test(f));

  // 转换为 Webview URI
  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, cssFile));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, jsFile));
  ```

---

### ✅ Bug #3: index.html 中重复的 CSS/JS 引用

**现象**: 403 Forbidden（即使禁用代码分割后仍然出现）

**根本原因**: HtmlWebpackPlugin 保留模板中的占位符，同时插入带哈希的版本

```html
<!-- index.html 内容 -->
<link href="styles.css" rel="stylesheet">           <!-- 模板中的占位符 -->
<link href="main.e8d0ba9d6541e612aed7.css" rel="stylesheet">  <!-- Webpack 插入的 -->

<!-- 替换后 -->
<link href="https://.../main.e8d0ba9d6541e612aed7.css" rel="stylesheet">  <!-- 已转换 -->
<link href="main.e8d0ba9d6541e612aed7.css" rel="stylesheet">  <!-- 未转换 → 403 -->
```

**解决方案**:
- `src/designer/DesignerPanel.ts` (第174-175行): 删除 Webpack 自动插入的引用
  ```typescript
  // 删除 Webpack 插入的带哈希引用
  htmlContent = htmlContent.replace(/<link href="main\..+\.css"[^>]*>/g, '');
  htmlContent = htmlContent.replace(/<script defer="defer" src="main\..+\.js"><\/script>/g, '');
  ```

---

### ✅ Bug #4: generateId 函数 TypeError

**现象**: `Uncaught TypeError: (0 , a.generateId) is not a function`

**根本原因**: Zustand store 初始化时调用 generateId()，但模块导入/导出可能未完成，导致函数未定义

**调用栈**:
```
createDefaultScreen() → generateId() → undefined
在 store 初始化时发生，早于正常的模块加载流程
```

**解决方案**:
- `src/webview/store.ts` (第60-62行): 内联简化版 ID 生成器
  ```typescript
  const createDefaultScreen = (): Component => {
    // 内联简化版ID生成器，避免store初始化时的模块依赖问题
    const generateSimpleId = (): string => `screen_0`;

    return {
      id: generateSimpleId(),  // 使用内联函数
      // ...
    };
  };
  ```

**修改前**:
```typescript
const id = generateId();  // 外部导入的函数
return { id: 'screen_0', ... }  // 生成的ID未使用
```

**修改后**:
```typescript
const generateSimpleId = (): string => `screen_0`;
return { id: generateSimpleId(), ... }  // 内联函数，避免依赖
```

---

## 构建和测试流程

### 完整构建命令

```bash
# 1. 清理旧构建
rm -rf out/

# 2. 编译扩展代码
npm run compile

# 3. 构建 Webview
npm run build:webview

# 4. 验证输出
ls -lh out/designer/webview/
# 应该只有3个文件：
# - index.html (410 bytes)
# - main.{hash}.js (约 800KB)
# - main.{hash}.css (约 24KB)

# 5. 在 VS Code 中测试
# 按 F5 启动扩展调试
# 运行命令: "HoneyGUI: Open Designer"
```

### 预期输出

```
out/designer/webview/
├── index.html                    (410 bytes)
├── main.6e60148ff77837a99a99.js  (799KB, 带哈希)
├── main.6e60148ff77837a99a99.js.map (2.7MB, source map)
├── main.6e60148ff77837a99a99.js.LICENSE.txt (1.2KB)
├── main.e8d0ba9d6541e612aed7.css (24KB, 带哈希)
└── main.e8d0ba9d6541e612aed7.css.map (37KB)
```

---

## 修改的文件清单

1. ✅ `webpack.config.js` - 禁用代码分割
2. ✅ `src/designer/DesignerPanel.ts` - 动态加载带哈希文件 + 删除重复引用
3. ✅ `src/webview/store.ts` - 内联 generateId 避免模块依赖问题

---

## 核心架构改动

### Webpack 配置

```javascript
// 修改前
splitChunks: {
  chunks: 'all',
  cacheGroups: { /* ... */ }
}

// 修改后
splitChunks: false  // VS Code Webview 中禁用
```

**原因**: VS Code Webview 要求所有资源必须经过 `webview.asWebviewUri()` 转换

### DesignerPanel 资源加载

```typescript
// 修改前 - 硬编码
const stylesUri = webview.asWebviewUri(...'styles.css');
const scriptUri = webview.asWebviewUri(...'webview.js');

// 修改后 - 动态查找
const files = fs.readdirSync(path);
const jsFile = files.find(f => /^main\..+\.js$/.test(f));
const cssFile = files.find(f => /^main\..+\.css$/.test(f));
const stylesUri = webview.asWebviewUri(...cssFile);
const scriptUri = webview.asWebviewUri(...jsFile);
```

**原因**: Webpack 生产环境使用 [contenthash] 生成文件名

### 错误处理改进

在 `DesignerPanel.ts` 中添加了详细的错误日志：
- Webview URIs 输出到控制台
- 错误时返回友好的错误页面
- 清晰的构建说明

---

## 测试验证

### ✅ 已验证的场景

- [x] 扩展编译无错误 (`npm run compile`)
- [x] Webview 构建无错误 (`npm run build:webview`)
- [x] 资源文件正确生成（JS + CSS + HTML）
- [x] DesignerPanel 正确加载资源
- [x] generateId 函数错误修复
- [x] Store 初始化正常

---

## 性能影响

### 包大小分析

| 文件 | 大小 | 说明 |
|------|------|------|
| main.{hash}.js | 799 KB | 所有代码打包在一起 |
| main.{hash}.css | 24 KB | 所有样式 |
| **总计** | **823 KB** | 单次下载 |

**权衡**: 禁用代码分割 → 文件较大，但兼容性更好

**优化建议**:
- 按需加载组件库（动态 import）
- 使用 React.lazy() 分割 UI 组件
- 优化 vendor 库（只引入需要的图标）

---

## 经验教训

### VS Code Webview 开发要点

1. **所有本地资源必须经过 `webview.asWebviewUri()` 转换**
   ```typescript
   // ✅ 正确
   const uri = webview.asWebviewUri(vscode.Uri.file(...));

   // ❌ 错误
   const uri = 'file:///path/to/file.js';
   ```

2. **避免使用 Webpack SplitChunks**
   - 自动生成引用无法转换
   - 建议：禁用 splitChunks 或手动处理所有引用

3. **动态处理文件哈希**
   - 生产环境文件名会变化
   - 使用正则表达式匹配：`/^main\..+\.js$/`

4. **Store 初始化注意模块依赖**
   - 避免在 store 初始化时调用外部模块函数
   - 内联简单工具函数

---

## 下一步优化建议

### 短期
- [ ] 添加构建验证脚本（检查文件是否存在）
- [ ] 添加版本号到日志（便于调试）
- [ ] 优化错误页面样式

### 中期
- [ ] 按需加载组件库（减少包大小）
- [ ] 实现 Webview 热重载（开发体验）
- [ ] 添加 E2E 测试

### 长期
- [ ] 代码分割优化（研究 webview 方式）
- [ ] 性能监控和优化
- [ ] 支持主题定制

---

**修复日期**: 2025-11-17
**修复版本**: 1.1.5
**状态**: ✅ 已完成，可正常工作
