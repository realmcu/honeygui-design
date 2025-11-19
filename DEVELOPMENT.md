# 开发文档

本文档提供HoneyGUI Design插件的核心开发信息。

## 项目架构

HoneyGUI Design采用模块化设计，主要包含以下核心模块：

- **扩展主模块**：负责VSCode扩展的激活和命令注册
- **设计器面板**：提供可视化设计界面，处理与Webview的通信
- **HML控制器**：负责HML文件的解析和序列化
- **代码生成器**：提供代码生成功能，支持代码保护区
- **Webview UI**：实现设计器的前端界面和用户交互

## 核心开发命令

```bash
# 完整构建（扩展 + webview）
npm run compile && npm run build:webview

# 开发模式
npm run watch         # 监听扩展代码变化
npm run watch:webview # 监听webview代码变化
npm run serve:webview # 启动webview开发服务器
```

## 快速开发流程

1. 安装依赖：`npm install`
2. 启动监听：`npm run watch` 和 `npm run serve:webview`
3. 在VS Code中按F5启动调试
4. 开发webview时访问 http://localhost:3000 查看实时效果

## 添加新UI组件

1. 在`src/webview/types.ts`中添加组件类型定义
2. 在`ComponentLibrary.tsx`中添加组件到组件库
3. 在`DesignerCanvas.tsx`中实现组件渲染
4. 在`CppCodeGenerator.ts`中添加代码生成支持

## 调试技巧

- **扩展端**：设置断点后按F5启动调试
- **Webview端**：开发模式下访问http://localhost:3000使用浏览器调试
- **查看日志**：在VS Code中查看"Output > HoneyGUI Design"通道

## 发布流程

1. 更新版本号
2. 运行完整构建：`npm run compile && npm run build:webview`
3. 生成VSIX包：`vsce package`
5. 等待代码审查

## 代码规范

- 使用TypeScript的严格模式
- 遵循ESLint规则
- 为公共API添加文档注释
- 编写单元测试
- 保持代码风格一致

## 性能优化

- 避免在Webview中进行大量DOM操作
- 使用缓存减少重复计算
- 对于大文件，实现增量加载
- 优化组件渲染，避免不必要的重绘

## 常见问题

### 设计器加载缓慢
- 检查是否有大量组件或复杂的层级结构
- 考虑优化组件渲染逻辑

### 代码生成失败
- 检查HML文件格式是否正确
- 查看扩展输出窗口中的错误信息
- 确认输出目录存在且有写入权限

### 代码保护区不工作
- 确保保护区注释格式正确
- 检查标识符是否唯一
- 确保保护区在可识别的代码块内