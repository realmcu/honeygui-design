# HoneyGUI Designer Skill

这是一个 Claude Code Skill，用于通过自然语言生成 HoneyGUI HML（XML-based UI markup）文件。

## Skill 结构

```
honeygui-designer/
├── SKILL.md                      # 核心技能文档（包含工作流程和快速指南）
├── references/                   # 参考文档（按需加载）
│   ├── components.md            # 完整组件库文档
│   ├── hml-syntax.md           # HML 语法规范
│   ├── layout-patterns.md      # 常见布局模式和示例
│   └── design-principles.md    # 嵌入式 GUI 设计原则
├── assets/
│   └── examples/               # 高质量示例 HML 文件
│       ├── simple_watch_home.hml
│       ├── settings_screen.hml
│       ├── music_player.hml
│       └── dashboard.hml
└── scripts/                    # 工具脚本（当前为空）
```

## 使用方式

### 方式 1: 隐式触发（自动识别）

当用户的描述包含以下关键词时，Claude 会自动加载此 skill：

- "设计"、"创建界面/屏幕/UI/页面"
- "生成 HML"
- "智能手表/可穿戴设备界面"
- "嵌入式 GUI"
- "构建 UI"、"制作一个屏幕"

示例：
```
用户: "帮我设计一个智能手表的设置界面，有亮度调节、音量控制"
Claude: [自动加载 honeygui-designer skill] → 生成 HML 代码
```

### 方式 2: 显式触发（手动指定）

用户可以明确指定使用此 skill：

```
用户: "/honeygui-designer 创建一个音乐播放器界面"
Claude: [加载 skill] → 生成 HML 代码
```

## Skill 功能

1. **理解需求** - 从自然语言描述中提取 UI 需求
2. **规划布局** - 根据嵌入式设备特性规划组件层次
3. **生成 HML** - 输出符合规范的 HML XML 代码
4. **迭代优化** - 根据反馈调整和改进设计

## 参考文档

- **SKILL.md** - 核心工作流程，Claude 加载后首先阅读
- **references/components.md** - 当需要了解具体组件属性时阅读
- **references/hml-syntax.md** - 当需要了解 HML 语法细节时阅读
- **references/layout-patterns.md** - 当需要参考常见布局模式时阅读
- **references/design-principles.md** - 当需要设计指导原则时阅读

## 示例

查看 `assets/examples/` 目录下的示例 HML 文件，了解高质量的 HML 代码结构。

## 技术栈

- **HML**: HoneyGUI Markup Language (基于 XML)
- **目标设备**: 嵌入式设备、智能手表、IoT 面板等
- **分辨率**: 常见 454x454 (圆形表盘), 368x448 (方形), 等

## 打包和分发

使用 skill-creator 的打包脚本：

```bash
python scripts/package_skill.py honeygui-designer
```

这将生成 `honeygui-designer.skill` 文件，可以分发给用户安装。
