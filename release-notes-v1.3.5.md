## HoneyGUI Visual Designer v1.3.5 发布

这是一个重要的修正版本，解决了之前v1.3.4版本中将源代码而非VS Code插件包作为发行附件的问题。

### 重要变更
- 修正了发行版本附件，现在提供正确的VS Code插件包(.vsix文件)
- 修复了package.json中的仓库URL配置

### 新特性
- 改进了可视化设计器的性能
- 增强了组件库管理功能
- 优化了代码生成器的稳定性
- 提升了HML文件编辑体验

### 修复的问题
- 修复了ResourceManager组件相关的bug
- 解决了构建过程中的警告问题
- 优化了Webpack配置以提高构建速度
- 修正了发行版本附件内容（之前错误地包含了源码而非插件包）

### 技术改进
- 代码结构优化和重构
- 统一了命名规范
- 移除了未使用的组件和冗余资源
- 添加了Webpack缓存配置以提高二次构建速度

### 安装说明
1. 下载本版本提供的 `.vsix` 文件
2. 在VS Code中，按 `Ctrl+Shift+P` 打开命令面板
3. 输入 `Extensions: Install from VSIX...` 并选择该命令
4. 选择下载的 `.vsix` 文件进行安装
5. 安装完成后重启VS Code

这个版本进一步提升了HoneyGUI Visual Designer作为VS Code插件的稳定性和用户体验。