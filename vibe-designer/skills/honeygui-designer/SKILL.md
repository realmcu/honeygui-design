---
name: honeygui-designer
description: |
  Generate HoneyGUI HML (XML-based UI markup) files for embedded devices from natural language descriptions.

  Use when user wants to:
  - Create/design GUI interfaces for embedded systems, wearables, or IoT devices
  - Generate HML files from descriptions like "design a settings screen" or "create a dashboard"
  - Build UI layouts for HoneyGUI projects with components like buttons, images, text, labels, etc.
  - Convert UI requirements into structured HML format

  Trigger keywords: "design", "create interface/screen/UI/page", "generate HML",
  "smart watch/wearable interface", "embedded GUI", "build UI", "make a screen",
  or any request describing GUI layouts for embedded/IoT devices.
---

# HoneyGUI Designer Skill

根据自然语言描述生成生产级的 HoneyGUI HML 文件。

## 快速开始

当用户请求 UI 设计时：

1. **理解需求**
   - 明确设备类型（智能手表、IoT 面板等）
   - 屏幕分辨率（智能手表默认：454x454）
   - 所需的关键功能/组件
   - 视觉风格偏好

2. **规划布局**
   - 在脑海中构思组件层次结构
   - 考虑嵌入式设备的人机工程学（触摸目标、可读性）
   - 如果是多屏幕，规划导航流程

3. **生成 HML**
   - 使用组件库中的适当组件
   - 遵循 HML 语法规则
   - 包含元数据信息
   - 添加事件处理器以实现交互

4. **验证 HML** ⚠️
   - **必须调用** `/api/validate-hml` 验证生成的代码
   - 检查所有 8 项约束规则（见"关键约束"章节）
   - 修复验证错误后重新验证
   - 详见"HML 验证"章节

5. **迭代优化**
   - 呈现生成的 HML
   - 接受反馈并改进
   - 基于嵌入式 UI 最佳实践提出改进建议

## HML 结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Screen Name</title>
    <description>Brief description</description>
    <project>
      <resolution>454x454</resolution>
      <pixelMode>RGB565</pixelMode>
    </project>
  </meta>
  <view id="main_view">
    <!-- Components here -->
  </view>
</hml>
```

## 组件库概览

**常用组件**：
- `hg_button` - 交互式按钮
- `hg_label` - 文本显示（静态或动态）
- `hg_image` - 支持变换的图片
- `hg_slider` - 数值滑块
- `hg_switch` - 开关切换
- `hg_progressbar` - 进度指示器
- `hg_input` - 文本输入框

**容器组件**：
- `hg_view` - 通用容器
- `hg_window` - 窗口容器
- `hg_container` - 布局容器

**高级组件**：
- `hg_list` / `hg_list_item` - 可滚动列表
- `hg_grid` - 网格布局
- `hg_tab` - 标签页导航
- `hg_canvas` - 自定义绘图
- `hg_menu_cellular` - 蜂窝菜单
- `hg_particle` - 粒子效果

**详细的组件文档**：阅读 `references/components.md`

## 关键属性

每个组件通常具有：
- `id` - 唯一标识符
- `name` - 显示名称
- `x`, `y` - 位置（像素）
- `w`, `h` - 尺寸（像素）

组件特定的属性各不相同。详见 `references/components.md`。

## 事件处理

组件支持的事件包括：
- `onClick` - 按钮按下
- `onValueChange` - 滑块/输入变化
- `onLongPress` - 长按手势

事件动作可以：
- 切换视图
- 更新组件属性
- 触发动画
- 执行自定义回调

## 嵌入式 UI 设计原则

1. **触摸目标**：按钮最小 44x44px
2. **可读性**：使用清晰的字体大小（正文 ≥16px）
3. **性能**：最小化嵌套，复用资源
4. **简洁性**：清晰的层次结构，避免过度复杂
5. **反馈**：为交互提供视觉反馈

**全面的指导方针**：阅读 `references/design-principles.md`

## 布局模式

常见模式包括：
- **仪表盘** - 状态卡片网格
- **设置** - 垂直选项列表
- **媒体控制** - 居中的播放控件
- **导航** - 顶部/底部导航栏
- **表单** - 垂直字段排列

**详细模式和示例**：阅读 `references/layout-patterns.md`

## 关键约束（必须遵守）

生成 HML 时必须遵守严格的规则。**完整约束清单**：参见 `references/constraints.md`

**最关键的 3 条规则**：

1. ⚠️ **hg_view 嵌套**：`hg_view` 不能嵌套在另一个 `hg_view` 中
2. ⚠️ **资源路径**：所有资源路径必须以 `/` 开头（如 `/font.ttf`，不能是 `font.ttf`）
3. ⚠️ **字体文件**：`hg_label` 必须设置 `fontFile` 属性，字体文件必须在 assets 文件夹中

其他约束包括：组件嵌套规则、Entry View 唯一性、组件 ID 格式、事件函数位置、文档结构等。

详见 `references/constraints.md` 查看全部 8 项约束的详细说明和示例。

## HML 验证

生成 HML 后，使用 Extension HTTP API 进行验证：

```bash
# 方法 1：验证 HML 内容字符串
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"hmlContent":"<?xml version=\"1.0\"?><hml>...</hml>"}'

# 方法 2：通过文件路径验证 HML
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"filePath":"ui/main.hml"}'
```

**响应**：
```json
{
  "success": true,
  "data": {
    "valid": true/false,
    "errors": [...],
    "warnings": [...],
    "validationRules": [
      "内容非空检查",
      "XML 语法验证",
      "文档结构验证",
      "组件 ID 唯一性和格式验证",
      "组件嵌套规则验证",
      "hg_view 不嵌套验证",
      "资源路径格式验证",
      "Entry View 唯一性验证"
    ]
  }
}
```

**验证检查项**：
1. XML 语法和结构
2. 组件 ID 唯一性和格式正确性
3. 组件嵌套规则（容器 vs. 非容器）
4. hg_view 不能嵌套在另一个 hg_view 中
5. 资源路径必须以 `/` 开头
6. 必须有且仅有一个视图具有 `entry="true"`

**详细的 HTTP API 文档**：参见 `references/http-api.md`

## 工作流示例

**用户**："设计一个智能手表设置界面，包含亮度和音量滑块"

**步骤**：
1. 澄清需求：分辨率？其他功能？
2. 规划布局：标题标签，两个带标签的滑块，返回按钮
3. 生成 HML：完整布局的 HML 代码
4. 验证：调用 `/api/validate-hml` 检查错误
5. 呈现：显示生成的代码
6. 迭代：根据反馈调整

## 高级功能

**动画与计时器**：
- 组件支持基于计时器的动画
- 多个动画段
- 动作：尺寸、位置、不透明度、旋转、缩放等
- 计时器配置参见 `references/components.md`

**多屏幕导航**：
- 多个具有唯一 ID 的 `<view>` 元素
- 使用事件在视图之间切换
- 支持过渡动画

**自定义样式**：
- 颜色、边框、背景
- 图片变换（缩放、旋转、不透明度）
- 字体自定义

## 文件参考

- **`references/components.md`** - 完整的组件文档，包含所有属性和示例
- **`references/hml-syntax.md`** - HML XML 语法规则和最佳实践
- **`references/layout-patterns.md`** - 常见 UI 模式及代码示例
- **`references/design-principles.md`** - 嵌入式 UI 设计指南
- **`references/constraints.md`** - 全部 8 项 HML 约束规则详细说明
- **`references/http-api.md`** - Extension HTTP API 完整文档
- **`references/common-mistakes.md`** - 常见错误和修复方法

## 使用提示

- **从简单开始**：先完成基本布局，再逐步增加复杂性
- **边做边验证**：确保 ID 唯一，属性有效
- **考虑嵌入式特性**：电池寿命、有限资源、手指友好的 UI
- **快速迭代**：生成 → 反馈 → 改进

## 示例文件

参考 `assets/examples/` 中的完整示例获取设计灵感：

| 示例文件 | 用途 | 适用场景 |
|---------|------|---------|
| `simple_watch_home.hml` | 简单的手表主屏幕 | 入门示例：时间显示 + 基础按钮 |
| `dashboard.hml` | 健康数据仪表盘 | 网格布局：多个状态卡片（2x2 网格） |
| `settings_screen.hml` | 设置界面 | 列表布局：垂直选项列表 + 开关/滑块 |
| `music_player.hml` | 音乐播放器控制 | 媒体控制：专辑封面 + 播放控制按钮 |

所有示例都遵循 HML 约束规则，可以直接作为生成代码的参考模板。
