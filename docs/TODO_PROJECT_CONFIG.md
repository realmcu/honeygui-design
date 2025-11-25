# 项目配置重构 TODO

## 已完成
- ✅ 创建 ProjectConfig 类型定义
- ✅ 创建 ProjectUtils 工具类
- ✅ DesignerPanel: localResourceRoots 使用 ProjectUtils
- ✅ DesignerPanel: generateCode 使用 ProjectUtils

## 待修复的地方

### DesignerPanel.ts
- [ ] Line 1013: `createNewHmlInWorkspace` - 创建新HML文件
- [ ] Line 1065: `generateAllCode` - 批量生成代码
- [ ] Line 1313: `_handleLoadAssets` - 加载资源列表
- [ ] Line 1406: `_handleOpenAssetsFolder` - 打开assets文件夹
- [ ] Line 1438: `_handleSaveImageToAssets` - 保存图片到assets

### CommandManager.ts
- [ ] Line 224: `createNewHmlInWorkspace` - 创建新HML文件

### CreateProjectPanel.ts
- [ ] Line 747-750: 创建项目目录结构
- [ ] Line 761: 创建main.hml文件

### PreviewService.ts
- [ ] Line 197: 预览服务的assets路径

### HmlTemplateManager.ts
- [ ] Line 203: HML模板路径
- [ ] Line 220: 项目文件路径

### TemplateManager.ts
- [ ] Line 150: UI目录
- [ ] Line 163: 源码目录

## 优先级
1. 高优先级：DesignerPanel中的资源和代码生成相关
2. 中优先级：CommandManager中的创建文件
3. 低优先级：模板和预览相关（这些在创建新项目时使用，可以保持硬编码）
