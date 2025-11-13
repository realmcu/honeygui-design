# 开发文档

本文档详细介绍HoneyGUI Design插件的开发架构、核心组件和开发流程，帮助开发者理解项目结构和扩展功能。

## 项目架构

HoneyGUI Design采用模块化设计，主要包含以下核心模块：

### 1. 扩展主模块（Extension）
- 负责VSCode扩展的激活和命令注册
- 管理设计器面板的生命周期
- 提供命令和事件处理

### 2. 设计器面板（DesignerPanel）
- 实现Webview面板，提供可视化设计界面
- 处理与Webview的消息通信
- 管理HML文件的加载和保存

### 3. HML控制器（HmlController）
- 负责HML文件的解析和序列化
- 管理组件模型数据
- 处理组件的增删改查操作

### 4. 代码生成器（CodeGenerator）
- 提供代码生成的抽象接口
- 实现C++和C语言的代码生成器
- 支持代码保护区的合并

### 5. Webview UI
- 实现设计器的前端界面
- 提供组件库和属性编辑器
- 处理用户交互和事件

## 目录结构

```
├── src/
│   ├── extension.ts         # 扩展主入口
│   ├── hml/                 # HML解析和控制器
│   │   ├── HmlController.ts
│   │   ├── Component.ts
│   │   └── index.ts
│   ├── designer/            # 设计器实现
│   │   ├── DesignerPanel.ts
│   │   └── webview/         # Webview UI文件
│   │       ├── designer.html
│   │       ├── designer.css
│   │       └── designer.js
│   ├── codegen/             # 代码生成器
│   │   ├── CodeGenerator.ts
│   │   └── cpp/             # C++/C代码生成器
│   │       └── CppCodeGenerator.ts
│   └── utils/               # 工具函数
│       └── index.ts
├── test/                    # 测试文件
├── package.json             # 扩展配置
├── tsconfig.json            # TypeScript配置
└── README.md                # 项目说明
```

## 核心API

### Extension API

#### 命令
- `honeygui.openDesigner` - 打开设计器面板
- `honeygui.newProject` - 创建新项目
- `honeygui.importProject` - 导入项目
- `honeygui.generateCode` - 生成代码

### HmlController API

```typescript
// 创建控制器实例
const controller = new HmlController();

// 从文件加载HML
await controller.loadFromFile(filePath);

// 保存到文件
await controller.saveToFile(filePath);

// 添加组件
controller.addComponent(component);

// 删除组件
controller.removeComponent(componentId);

// 更新组件
controller.updateComponent(componentId, properties);

// 获取所有组件
const components = controller.getComponents();

// 导出为HML字符串
const hmlContent = controller.exportToHml();

// 从HML字符串导入
controller.importFromHml(hmlContent);
```

### CodeGenerator API

```typescript
// 创建代码生成器
const generator = CodeGeneratorFactory.createGenerator('cpp');

// 设置生成选项
const options: CodeGeneratorOptions = {
  enableProtectedAreas: true,
  generateDebugInfo: true,
  outputPath: 'output/directory'
};

// 生成代码
const result = await generator.generate(components, options);

// 检查结果
if (result.success) {
  console.log('Code generated to:', result.outputPath);
} else {
  console.error('Generation failed:', result.errors);
}
```

## 消息通信

设计器面板与Webview之间通过消息机制通信：

### 从扩展到Webview的消息
- `loadHml` - 加载HML内容到设计器
- `showMessage` - 显示普通消息
- `error` - 显示错误消息
- `codegenProgress` - 显示代码生成进度
- `codegenComplete` - 通知代码生成完成

### 从Webview到扩展的消息
- `save` - 保存当前设计
- `codegen` - 生成代码
- `addComponent` - 添加组件
- `removeComponent` - 删除组件
- `updateComponent` - 更新组件
- `notify` - 通知扩展某些事件

## 开发流程

### 1. 设置开发环境

```bash
# 克隆仓库
git clone <repository-url>
cd honeygui-design

# 安装依赖
npm install

# 编译项目
npm run compile

# 运行扩展（F5在VSCode中启动调试）
npm run watch  # 监视文件变化并自动编译
```

### 2. 扩展功能

#### 添加新组件
1. 在`src/hml/Component.ts`中定义组件类型和属性
2. 在`src/designer/webview/designer.html`中添加组件的渲染逻辑
3. 在代码生成器中添加组件的代码生成支持

#### 添加新的代码生成器
1. 创建一个继承自`CodeGenerator`的新类
2. 实现必要的方法，如`generate`、`generateMainWindow`等
3. 在`CodeGeneratorFactory`中注册新的生成器

### 3. 测试

- 单元测试位于`test/unit/`目录
- 集成测试位于`test/integration/`目录
- 使用`npm test`运行测试

### 4. 调试技巧

- 使用`console.log`在Webview中打印调试信息
- 使用VSCode的扩展调试功能调试扩展代码
- 检查`View > Output > HoneyGUI Design`查看扩展日志

## 发布流程

1. 更新`package.json`中的版本号
2. 运行`npm run compile`确保代码编译正确
3. 运行`vsce package`生成VSIX包
4. 发布到VSCode扩展市场或提供VSIX文件供用户安装

## 贡献指南

1. Fork项目仓库
2. 创建功能分支
3. 提交更改
4. 创建Pull Request
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