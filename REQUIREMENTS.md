# HoneyGUI Visual Designer - 设计需求文档

**文档版本**: 1.0.0
**最后更新**: 2025-11-16
**作者**: Claude Code

---

## 📋 文档概述

本文档详细描述了 HoneyGUI Visual Designer 项目的设计需求、功能规格、技术架构和实现规划。作为项目的核心指导文档，它定义了插件的目标、范围、技术栈和详细功能需求。

## 📖 目录

1. [项目背景](#项目背景)
2. [项目目标](#项目目标)
3. [功能需求](#功能需求)
4. [非功能需求](#非功能需求)
5. [技术架构](#技术架构)
6. [模块设计](#模块设计)
7. [界面设计](#界面设计)
8. [性能指标](#性能指标)
9. [兼容性要求](#兼容性要求)
10. [开发路线图](#开发路线图)

---

## 🎯 项目背景

### 1.1 问题陈述

在嵌入式设备GUI开发中，开发者面临以下挑战：

- **手写UI代码繁琐**: 需要手动编写大量重复的UI布局代码
- **缺乏可视化工具**: 没有专门用于HoneyGUI框架的可视化设计器
- **代码维护困难**: UI修改需要手动更新代码，容易出错
- **开发效率低**: 无法直观预览界面效果，调试周期长

### 1.2 目标用户

- **嵌入式系统开发者**: 使用HoneyGUI框架开发设备界面
- **UI/UX设计师**: 需要快速原型设计和界面迭代
- **项目经理**: 需要可视化工具进行需求评审和演示

### 1.3 项目愿景

创建一个集成在VS Code中的可视化设计工具，让HoneyGUI界面开发变得简单、直观、高效，将UI设计时间缩短50%以上。

---

## 🎯 项目目标

### 2.1 核心目标

- [x] **可视化设计器**: 提供拖放式界面设计功能
- [x] **HML文件支持**: 支持HoneyGUI Markup Language格式
- [x] **代码生成**: 自动生成C++/C代码
- [x] **代码保护区**: 保留用户自定义代码
- [x] **实时预览**: 在设计器中实时查看界面效果
- [ ] **项目管理**: 完整的项目创建和管理功能

### 2.2 次要目标

- [ ] **资源管理**: 管理图片、字体等资源文件
- [ ] **主题支持**: 支持多套UI主题
- [ ] **团队协作**: 支持多人协作开发
- [ ] **插件扩展**: 支持第三方组件库

### 2.3 成功标准

- 设计器启动时间 < 2秒
- 组件拖拽响应时间 < 100ms
- 代码生成成功率 > 99%
- 用户满意度 > 8/10

---

## 📱 功能需求

### 3.1 核心功能模块

#### 3.1.1 可视化设计器

**功能描述**: 提供一个可视化的拖放界面设计环境

**详细需求**:

- ✅ **组件库面板** (左侧)
  - 显示可用组件列表（Button、Label、Input、Checkbox、Radio、Panel、ProgressBar等）
  - 组件分类和搜索功能
  - 组件预览图标

- ✅ **设计画布** (中间)
  - 支持组件拖拽放置
  - 支持组件选择和移动
  - 显示网格和对齐线
  - 支持缩放（25% - 800%）
  - 支持撤销/重做（50步历史）
  - 键盘快捷键支持

- ✅ **属性面板** (右侧)
  - 显示选中组件的属性
  - 支持编辑组件属性（位置、大小、文本、颜色等）
  - 属性验证和错误提示

- ✅ **组件树** (可选面板)
  - 显示组件层级结构
  - 支持重命名、删除组件
  - 支持组件锁定/解锁

#### 3.1.2 HML文件支持

**功能描述**: 支持HoneyGUI Markup Language文件格式

**详细需求**:

- ✅ **HML文件格式**: 基于XML的自定义格式
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <hone:HoneyGUI xmlns:hone="http://www.honeygui.com">
      <HoneyGUI version="1.0">
          <Window width="800" height="600" title="Main Window">
              <Button id="button1" x="100" y="50" width="120" height="40" text="Click Me"/>
          </Window>
      </HoneyGUI>
  </hone:HoneyGUI>
  ```

- ✅ **HML解析**: 将HML文件解析为内部组件模型
- ✅ **HML生成**: 将组件模型序列化为HML格式
- ✅ **语法验证**: 验证HML文件语法正确性
- ✅ **自动补全**: 在代码编辑器中提供HML标签补全

#### 3.1.3 代码生成

**功能描述**: 将设计转换为可执行的C++/C代码

**详细需求**:

- ✅ **C++代码生成**: 生成C++17兼容代码
- ✅ **C代码生成**: 生成C99兼容代码（可选）
- **生成文件结构**:
  ```
  output/
  ├── include/
  │   ├── main_window.h
  │   └── app.h
  ├── src/
  │   ├── main.cpp
  │   ├── main_window.cpp
  │   └── app.cpp
  └── resources/
  ```

- ✅ **代码保护区**: 识别并保留自定义代码
  ```cpp
  // HONEYGUI PROTECTED START [unique-id]
  // 用户自定义代码
  int customVariable = 42;
  // HONEYGUI PROTECTED END [unique-id]
  ```

- **代码格式化**: 生成符合Google C++ Style的代码
- **注释生成**: 自动生成文档注释

#### 3.1.4 项目管理

**功能描述**: 完整的项目生命周期管理

**详细需求**:

- ✅ **创建项目**:
  - 项目向导（选择模板、项目名称、位置）
  - 生成标准项目结构
  - 创建默认HML文件

- ✅ **打开项目**: 加载现有HML文件到设计器
- ✅ **保存项目**: 保存当前设计到HML文件
- ✅ **最近项目**: 显示和快速打开最近项目（最多10个）

### 3.2 扩展功能模块

#### 3.2.1 撤销/重做系统

- ✅ **命令模式实现**: 使用设计模式实现撤销/重做
- ✅ **支持的操作**: 添加、删除、移动、修改组件
- ✅ **历史记录**: 最多50步历史
- ✅ **快捷键**: Ctrl+Z (撤销), Ctrl+Shift+Z/Ctrl+Y (重做)

#### 3.2.2 键盘快捷键

- ✅ **标准快捷键**: Ctrl+S (保存), Ctrl+A (全选)
- ✅ **编辑快捷键**: Delete (删除), Ctrl+D (复制)
- ✅ **移动快捷键**: 方向键 (微调1px), Shift+方向键 (快速移动10px)

#### 3.2.3 资源管理器

- **资源浏览**: 浏览项目资源文件（图片、字体、配置）
- **资源预览**: 预览图片资源
- **拖拽导入**: 拖拽资源到设计器使用

#### 3.2.4 设置和配置

- **全局设置**:
  - 代码生成选项（语言、输出路径、C++版本）
  - UI选项（网格大小、自动保存间隔）
  - 预览选项（自动刷新、端口配置）

- **项目配置**:
  - 项目元数据（名称、版本、作者）
  - 编译选项
  - 调试选项

---

## 🔧 非功能需求

### 4.1 性能需求

| 指标 | 目标值 | 优先级 |
|------|--------|--------|
| 设计器启动时间 | < 2秒 | P0 (必须) |
| 组件拖拽响应时间 | < 100ms | P0 (必须) |
| 代码生成时间 | < 5秒 (100个组件) | P1 (重要) |
| HML文件加载时间 | < 1秒 (100个组件) | P1 (重要) |
| 内存占用 | < 500MB | P2 (期望) |

### 4.2 可用性需求

- **易用性**: 直观的三栏布局，无需培训即可使用
- **一致性**: 遵循VS Code设计规范
- **可访问性**: 支持键盘导航
- **错误处理**: 友好的错误提示和恢复建议

### 4.3 可靠性需求

- **代码生成成功率**: > 99%
- **数据完整性**: HML文件100%可恢复
- **崩溃率**: < 0.1%
- **自动保存**: 每30秒自动保存

### 4.4 可维护性需求

- **代码质量**: ESLint检查，无严重警告
- **测试覆盖率**: > 80% (核心功能)
- **文档完整**: 每个公共API都有JSDoc注释
- **模块清晰**: 高内聚低耦合的模块设计

---

## 🏗️ 技术架构

### 5.1 技术栈

#### 5.1.1 后端/扩展端

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.3 | 主要开发语言 |
| Node.js | 18+ | 运行时 |
| VS Code Extension API | ^1.80.0 | 扩展开发框架 |
| fs | Node内置 | 文件系统操作 |
| crypto | Node内置 | 唯一标识生成 |

#### 5.1.2 前端/Webview

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI框架 |
| React DOM | 18.2 | React渲染器 |
| TypeScript | 5.3 | 类型检查 |
| Zustand | 5.0.8 | 状态管理 |
| Lucide React | 0.453.0 | 图标库 |
| CSS3 | - | 样式 |

#### 5.1.3 构建工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Webpack | 5.102.1 | Webview打包 |
| ts-loader | ^9.5.1 | TypeScript加载器 |
| CSS Loader | ^6.10.0 | CSS加载器 |
| Terser | ^5.31.6 | 代码压缩 |

### 5.2 架构设计

#### 5.2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Extension Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Commands  │  │  Documents  │  │   Events    │         │
│  │ Management │  │ Management │  │ Management │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  HmlCtrl   │  │   Designer  │  │   CodeGen   │         │
│  │            │  │   Panel     │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   HML       │  │ Components │  │  Project   │         │
│  │  Parser    │  │  Models    │  │  Config    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.2 扩展通信机制

**扩展 → Webview**:
```typescript
panel.webview.postMessage({
  command: 'loadHml',
  data: hmlContent
});
```

**Webview → 扩展**:
```typescript
window.vscodeAPI.postMessage({
  command: 'save',
  data: { components: updatedComponents }
});
```

### 5.3 模块设计

#### 5.3.1 HmlController（HML控制器）

**职责**: HML文件的解析、序列化和组件管理

**主要接口**:
```typescript
class HmlController {
  loadFromFile(filePath: string): Promise<Component[]>;
  saveToFile(filePath: string, components: Component[]): Promise<void>;
  parseHml(hmlContent: string): Component[];
  serializeHml(components: Component[]): string;
  validateHml(hmlContent: string): ValidationResult;
}
```

#### 5.3.2 DesignerPanel（设计器面板）

**职责**: 管理Webview面板的生命周期和通信

**主要接口**:
```typescript
class DesignerPanel {
  static createOrShow(context: ExtensionContext, filePath?: string): DesignerPanel;
  loadHml(filePath: string): Promise<void>;
  saveHml(): Promise<void>;
  dispose(): void;
}
```

#### 5.3.3 CppCodeGenerator（C++代码生成器）

**职责**: 将组件模型转换为C++代码

**主要接口**:
```typescript
class CppCodeGenerator {
  generate(components: Component[], options: CodeGenOptions): CodeGenResult;
  generateMainWindow(components: Component[]): string;
  parseProtectedAreas(existingCode: string): ProtectedArea[];
  mergeProtectedAreas(generated: string, protected: ProtectedArea[]): string;
}
```

---

## 🎨 界面设计

### 6.1 主界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Toolbar] 保存 | 撤销 | 重做 | 清空 | 生成代码 | 预览      │
├──────────────┬────────────────────────┬─────────────────────┤
│              │                        │                     │
│  Component   │                        │                     │
│   Library    │     Design Canvas      │   Properties Panel  │
│  (Left)      │      (Center)          │      (Right)        │
│              │                        │                     │
│  • Button    │                        │                     │
│  • Label     │  [Grid Area]           │  • Position         │
│  • Input     │                        │  • Size             │
│  • Checkbox  │  Drag & Drop           │  • Text             │
│  • Radio     │                        │  • Color            │
│  • Panel     │                        │  • Font             │
│  • ...       │                        │                     │
│              │                        │                     │
└──────────────┴────────────────────────┴─────────────────────┘
```

### 6.2 组件设计

#### 6.2.1 组件类型

| 组件 | 描述 | 属性 |
|------|------|------|
| Button | 按钮控件 | text, x, y, width, height, color |
| Label | 文本标签 | text, x, y, width, height, font |
| Input | 输入框 | placeholder, x, y, width, height |
| Checkbox | 复选框 | text, checked, x, y |
| Radio | 单选按钮 | text, selected, x, y |
| Panel | 容器面板 | x, y, width, height, background |
| ProgressBar | 进度条 | value, max, x, y, width, height |

#### 6.2.2 组件属性

**通用属性** (所有组件):
- `id`: 唯一标识符
- `x`, `y`: 位置坐标
- `width`, `height`: 尺寸
- `visible`: 可见性

**特定属性** (按组件类型):
- **Button/Label**: `text` (显示文本), `fontSize`, `color`
- **Input**: `placeholder`, `maxLength`, `readOnly`
- **Checkbox/Radio**: `checked`, `text`
- **Panel**: `backgroundColor`, `border`
- **ProgressBar**: `value`, `max`, `showPercentage`

### 6.3 主题和样式

**默认主题**: 跟随VS Code主题
- 使用VS Code CSS变量
- 自动适配暗色/亮色主题

**自定义主题** (未来功能):
- 预设主题包
- 自定义颜色配置
- 字体和大小配置

---

## 📊 性能指标

### 7.1 性能目标

| 场景 | 目标 | 测量方式 |
|------|------|----------|
| 扩展激活时间 | < 1秒 | 从VS Code启动到扩展激活完成 |
| 设计器打开时间 | < 2秒 | 从点击命令到设计器完全显示 |
| 组件拖拽响应 | < 100ms | 从拖拽开始到组件放置完成 |
| 属性更新响应 | < 50ms | 属性修改到画布更新 |
| HML文件加载 | < 1秒 (100个组件) | 文件加载到显示完成 |
| 代码生成时间 | < 5秒 (100个组件) | 生成C++代码总时间 |
| 内存占用峰值 | < 500MB | VS Code整体内存使用 |

### 7.2 性能优化策略

- **组件虚拟化**: 大量组件时使用虚拟滚动
- **增量渲染**: 只更新变更的部分
- **防抖处理**: 属性编辑器使用防抖减少更新频率
- **Web Worker**: 复杂计算使用Web Worker避免阻塞UI
- **缓存机制**: 缓存解析结果和生成的代码

---

## 🔌 兼容性要求

### 8.1 平台兼容性

| 平台 | 最低版本 | 支持状态 |
|------|---------|---------|
| Windows | Windows 10 | ✅ 完全支持 |
| Linux | Ubuntu 18.04+ | ✅ 完全支持 |
| macOS | macOS 11+ | ✅ 完全支持 |

### 8.2 VS Code兼容性

- **最低版本**: VS Code 1.74.0
- **推荐版本**: VS Code 1.85+
- **API版本**: ^1.80.0

### 8.3 HoneyGUI框架兼容性

- **最低版本**: HoneyGUI 1.0
- **推荐版本**: HoneyGUI 1.1+
- **支持特性**: 所有核心UI组件

---

## 🗂️ 数据格式

### 9.1 HML文件格式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hone:HoneyGUI xmlns:hone="http://www.honeygui.com"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:schemaLocation="http://www.honeygui.com honeygui.xsd">
    <HoneyGUI version="1.0">
        <Plugin name="com.honeygui.designer" version="1.1.0"/>
        <Window width="800" height="600" title="Main Window">
            <Button id="button1" x="100" y="50" width="120" height="40" text="Click Me"/>
            <Label id="label1" x="100" y="120" width="200" height="30" text="Hello HoneyGUI"/>
        </Window>
    </HoneyGUI>
</hone:HoneyGUI>
```

### 9.2 项目配置文件

```json
{
  "project": {
    "name": "MyApp",
    "version": "1.0.0",
    "author": "Developer",
    "description": "HoneyGUI Application"
  },
  "honeygui": {
    "version": "1.0",
    "target": "embedded"
  },
  "codegen": {
    "language": "cpp",
    "cppVersion": "c++17",
    "outputDir": "src/ui",
    "enableProtectedAreas": true
  }
}
```

---

## 📅 开发路线图

### Phase 1: MVP (最小可行产品) ✅

**时间**: 2025-11-01 到 2025-11-15

**完成功能**:
- ✅ 可视化设计器（三栏布局）
- ✅ 8种基础组件
- ✅ HML文件解析和序列化
- ✅ C++代码生成
- ✅ 撤销/重做系统
- ✅ 键盘快捷键

### Phase 2: 增强功能 🚧

**时间**: 2025-11-16 到 2025-11-30

**计划功能**:
- [ ] 资源管理器
- [ ] 属性面高级编辑
- [ ] 组件分组和容器
- [ ] 主题切换
- [ ] 代码预览面板
- [ ] C代码生成器

### Phase 3: 高级功能 📋

**时间**: 2025-12-01 到 2025-12-15

**计划功能**:
- [ ] 复杂组件（列表、表格）
- [ ] 数据绑定
- [ ] 事件处理编辑
- [ ] 多窗口支持
- [ ] 导入/导出模板
- [ ] 团队协作功能

### Phase 4: 优化和完善 📋

**时间**: 2025-12-16 以后

**计划功能**:
- [ ] 性能优化
- [ ] 测试覆盖率提升 > 80%
- [ ] 用户文档完善
- [ ] 示例项目
- [ ] 社区支持

---

## 🛡️ 安全和可靠性

### 11.1 数据安全

- **文件完整性**: HML文件包含校验和
- **备份机制**: 自动备份（最多3个版本）
- **恢复机制**: 支持从备份恢复
- **权限控制**: 遵循VS Code文件权限

### 11.2 错误处理

- **语法错误**: 友好的错误提示和建议
- **运行时错误**: 详细的堆栈跟踪
- **网络错误**: 离线模式支持
- **文件系统错误**: 权限检查和提示

### 11.3 质量保证

- **单元测试**: 核心模块 > 80% 覆盖率
- **集成测试**: 关键流程测试（加载、保存、生成）
- **性能测试**: 性能基准测试套件
- **用户测试**: Beta版本测试反馈收集

---

## 📞 联系和支持

### 12.1 文档资源

- **开发指南**: `DEVELOPMENT.md`
- **调试指南**: `docs/debugging/DEBUG_GUIDE.md`
- **测试指南**: `docs/testing/TESTING_GUIDE.md`
- **快速参考**: `docs/debugging/DEBUG_QUICK_REF.md`
- **AI助手指南**: `CLAUDE.md`

### 12.2 问题反馈

- **GitHub Issues**: 提交bug报告和功能建议
- **AI助手**: 使用Claude Code获取帮助
- **日志收集**: 按照调试指南收集日志

---

## 📝 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| HML | HoneyGUI Markup Language，HoneyGUI标记语言 |
| Webview | VS Code中嵌入的Web视图组件 |
| Extension | VS Code扩展插件 |
| Component | UI组件（按钮、标签等） |
| Protected Area | 代码保护区，保留用户自定义代码 |
| CodeGen | 代码生成 |

### B. 缩写词

| 缩写 | 全称 |
|------|------|
| IDE | Integrated Development Environment |
| UI | User Interface |
| UX | User Experience |
| API | Application Programming Interface |
| DOM | Document Object Model |

---

## 📜 变更历史

| 版本 | 日期 | 变更描述 | 作者 |
|------|------|---------|------|
| 1.0.0 | 2025-11-16 | 初始版本，包含完整需求 | Claude Code |

---

**文档结束**
