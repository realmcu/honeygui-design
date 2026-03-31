# HoneyGUI Vibe Designer

将 HoneyGUI Designer 转型为 **AI 驱动的嵌入式 UI 生成与收敛平台**，通过 MCP (Model Context Protocol) 暴露能力给 AI 编程工具（Codex, Cursor 等）。

**核心理念**：AI 生成 → Schema 约束 → 程序化校验 → 预览确认 → 导出代码

---

## 📖 快速导航

- [两大核心场景](#两大核心场景)
- [目录结构](#目录结构)
- [核心概念](#核心概念)
- [快速开始](#快速开始)
- [开发计划](#开发计划)
- [技术栈](#技术栈)
- [相关文档](#相关文档)

---

## 两大核心场景

### 场景 1：从零开始生成（AI Generation）
**描述**：用户通过自然语言描述需求，AI 生成完整的 HoneyGUI 项目。

**工作流**：
```
用户需求（自然语言）
  ↓
AI 读取 skills/honeygui-designer/ (Skill 1)
  ↓
生成 HML + 资源列表
  ↓
MCP: validate-hml → preview-ui → create-project
  ↓
输出：完整项目（HML + assets/ + project.json）
```

**关键技术**：
- Skill 1: `skills/honeygui-designer/` - HML 生成指导
- Schema: `skills/schema/hml-schema.json` - 组件定义
- MCP Tools: validate, preview, export

---

### 场景 2：设计稿转换（Design Import）
**描述**：用户提供 Figma/MasterGo 设计稿，AI 转换为 HoneyGUI 项目。

**工作流**：
```
设计稿（Figma/MasterGo URL 或 JSON）
  ↓
AI 读取 skills/honeygui-import/ (Skill 2)
  ↓
MCP: import-figma/import-mastergo
  ↓
解析设计稿 → 组件映射 → 生成 HML
  ↓
MCP: download-assets → validate-hml → preview-ui
  ↓
输出：完整项目（HML + assets/ + project.json）
```

**关键技术**：
- Skill 2: `skills/honeygui-import/` - 设计稿转换指导
- 组件映射规则：Figma/MasterGo → HoneyGUI 组件
- MCP Tools: import-figma, import-mastergo, download-assets

---

## 目录结构

```
vibe-designer/
├── README.md                    # 本文件：整体说明和开发计划
├── skills/                      # Skill 定义（软约束）
│   ├── honeygui-designer/       # Skill 1：从零生成 HML
│   │   ├── SKILL.md             # 核心工作流和快速指南
│   │   ├── README.md            # Skill 使用说明
│   │   ├── references/          # 详细参考文档
│   │   │   ├── components.md    # 组件库完整文档
│   │   │   ├── hml-syntax.md    # HML 语法规范
│   │   │   ├── design-principles.md  # 设计原则
│   │   │   └── layout-patterns.md    # 布局模式
│   │   └── assets/examples/     # HML 示例文件
│   ├── honeygui-import/         # Skill 2：设计稿转换
│   │   ├── SKILL.md             # 设计稿转换指导
│   │   ├── README.md            # 使用说明
│   │   ├── mappings/            # 组件映射规则
│   │   │   ├── figma-mapping.md      # Figma → HoneyGUI 映射
│   │   │   ├── mastergo-mapping.md   # MasterGo → HoneyGUI 映射
│   │   │   └── component-recognition.md # 组件识别规则
│   │   └── examples/            # 转换示例
│   └── schema/                  # JSON Schema 定义（硬边界）
│       ├── hml-schema.json      # HML 完整 schema
│       ├── validation-rules.json # 验证规则
│       └── design-tokens.json   # 设计 token 定义
└── mcp/                         # MCP Server 实现（能力接线）
    ├── TODO.md                  # 开发待办事项
    ├── honeygui-mcp/            # MCP Server 核心实现（待创建）
    │   ├── src/
    │   │   ├── index.ts         # MCP 入口
    │   │   ├── server.ts        # MCP Server 主逻辑
    │   │   ├── resources/       # Resources 实现
    │   │   ├── prompts/         # Prompts 实现
    │   │   ├── tools/           # Tools 实现
    │   │   ├── converters/      # 设计稿转换器（场景 2）
    │   │   └── utils/           # 工具函数
    │   └── tests/               # 单元测试
    └── docs/                    # MCP 使用文档
```

---

## 核心概念

### 1. 两个独立 Skill

| Skill | 用途 | 输入 | 输出 |
|-------|------|------|------|
| **honeygui-designer** | 从零生成 | 自然语言描述 | HML |
| **honeygui-import** | 设计稿转换 | Figma/MasterGo 数据 | HML + 资源列表 + 警告 |

**共享资源**：
- `skills/schema/` - HML JSON Schema（两个 Skill 输出相同格式）
- MCP Server - 统一的校验、预览、导出工具

---

### 2. Skill（软约束）

**定义**：告诉 AI "应该如何生成或转换 HML"

**Skill 1 - honeygui-designer**：
- 组件用法说明
- 设计原则和最佳实践
- 常见布局模式
- HML 语法规则
- 示例 HML 文件

**Skill 2 - honeygui-import**：
- Figma/MasterGo 数据结构说明
- 组件识别和映射规则
- 布局和样式转换规则
- 资源处理流程
- 警告和人工介入场景

**使用方式**：
- AI 编程工具（Codex, Cursor）加载对应 Skill
- Skill 1: 触发关键词 - 设计、创建界面、生成 HML
- Skill 2: 触发关键词 - 转换、导入、Figma、MasterGo

---

### 3. Schema（硬边界）

**定义**：程序化定义 HML 的合法边界

**内容**：
- JSON Schema 格式的组件定义
- 必需属性、可选属性、值约束
- 嵌套规则、组合规则
- 设计约束（最小尺寸、间距等）

**作用**：
- 程序化校验 AI 生成的 HML
- 提供明确的错误报告
- 防止非法组件或属性

---

### 4. MCP Server（能力接线）

**定义**：暴露 Designer 能力给 AI 工具的接口层

**内容**：
- **Resources**：规则数据（schema、templates、tokens）
- **Prompts**：生成指导（generate-ui、fix-errors）
- **Tools**：操作能力（validate、preview、export、import-figma 等）

**支持的 MCP Tools**：

| Tool | 用途 | 场景 |
|------|------|------|
| `validate-hml` | 校验 HML 结构 | 两个场景通用 |
| `preview-ui` | 生成预览截图 | 两个场景通用 |
| `create-project` | 创建完整项目 | 两个场景通用 |
| `export-code` | 导出 C 代码 | 场景 1 |
| `import-figma` | 导入 Figma 设计 | 场景 2 |
| `import-mastergo` | 导入 MasterGo 设计 | 场景 2 |
| `download-assets` | 下载设计稿资源 | 场景 2 |
| `optimize-layout` | 优化 HML 布局 | 两个场景通用 |
| `batch-edit` | 批量修改组件 | 两个场景通用 |

---

## 快速开始

### 使用场景 1：从零生成

```bash
# 1. 配置 AI 工具（Codex/Cursor）连接 MCP Server
# （MCP Server 待实现）

# 2. 在 AI 工具中描述需求
User: "创建一个智能手表设置界面，包含亮度和音量滑块"

# 3. AI 自动生成 HML 并校验
AI: [读取 honeygui-designer skill] → [生成 HML] → [校验] → [预览]

# 4. 确认后生成完整项目
AI: [创建项目目录] → [导出 C 代码]
```

---

### 使用场景 2：设计稿转换

```bash
# 1. 提供 Figma 设计稿
User: "将这个 Figma 设计稿转换为 HoneyGUI 项目：https://www.figma.com/file/abc123"

# 2. AI 解析设计稿并转换
AI: [读取 honeygui-import skill] → [import-figma] → [组件映射] → [生成 HML]

# 3. 下载资源并校验
AI: [download-assets] → [validate-hml] → [preview-ui]

# 4. 处理警告并生成项目
AI: [提示警告] → [create-project]
```

---

## 开发计划

### 当前进度

✅ **已完成**（2025-03-31）
- [x] 创建 `vibe-designer/` 目录结构
- [x] 创建 Skill 1: `honeygui-designer/`（从零生成）
- [x] 创建 Skill 2: `honeygui-import/`（设计稿转换）
- [x] 生成简化版 HML JSON Schema（4 个核心组件）
- [x] 明确两大核心场景

---

### 阶段 0：基础设施（1-2 周）

**目标**：建立 Schema 验证和 MCP 接口的基础能力

**任务清单**：

1. **Schema 测试与验证**（1-2 天，P0）
   - [ ] 创建 Schema 测试脚本
   - [ ] 准备测试用例（3 个合法 + 5 个非法）
   - [ ] 验证错误提示质量

2. **扩展 Schema 到完整组件库**（3-5 天，P1）
   - [ ] 添加交互组件（slider, switch, progressbar）
   - [ ] 添加输入组件（input, checkbox, radio）
   - [ ] 添加容器组件（window, container）
   - [ ] 添加高级组件（list, grid, canvas, tab）

3. **实现 HML Validator**（3-4 天，P0）
   - [ ] 创建 `HmlValidator` 类（`src/hml/HmlValidator.ts`）
   - [ ] 实现 Schema 验证（使用 ajv 库）
   - [ ] 实现自定义验证规则（ID 唯一性、重叠检测、边界检测等）
   - [ ] 单元测试

4. **设计 MCP 接口**（2-3 天，P0）
   - [ ] 定义 Resources（schema, components, templates, constraints）
   - [ ] 定义 Prompts（generate-ui, fix-validation-errors, optimize-layout）
   - [ ] 定义 Tools（完整列表见上文"核心概念 - MCP Server"）
   - [ ] 创建接口文档

---

### 阶段 1：MCP Server 实现（场景 1）（2-3 周）

**目标**：实现场景 1（从零生成）的 MCP Server

**任务清单**：

1. **初始化 MCP Server 项目**（1 天，P0）
   - [ ] 创建项目目录 `mcp/honeygui-mcp/`
   - [ ] 初始化 npm 项目
   - [ ] 安装依赖（@modelcontextprotocol/sdk, ajv 等）
   - [ ] 配置 TypeScript 和构建脚本

2. **实现 Resources**（2-3 天，P0）
   - [ ] Schema Resource（读取 hml-schema.json）
   - [ ] Templates Resource（读取示例 HML）
   - [ ] Components Resource（返回组件列表）
   - [ ] Constraints Resource（返回约束规则）

3. **实现 Prompts**（1-2 天，P1）
   - [ ] generate-ui Prompt（从 SKILL.md 加载）
   - [ ] fix-validation-errors Prompt
   - [ ] optimize-layout Prompt

4. **实现 Tools（场景 1 专用）**（5-7 天，P0）
   - [ ] validate-hml（调用 HmlValidator）
   - [ ] preview-ui（集成 Designer 预览引擎）
   - [ ] create-project（创建项目目录结构）
   - [ ] export-code（调用 HoneyCCodeGenerator）

5. **MCP Server 主逻辑**（1-2 天，P0）
   - [ ] 实现 `src/server.ts`（注册 Resources/Prompts/Tools）
   - [ ] 实现 `src/index.ts`（启动 MCP Server）
   - [ ] 支持 stdio 传输

---

### 阶段 1.5：设计稿转换能力（场景 2）（2-3 周）

**目标**：实现场景 2（设计稿转换）的能力

**任务清单**：

1. **Figma/MasterGo API 调研**（2-3 天，P0）
   - [ ] 注册 Figma Developer Account
   - [ ] 测试 Figma REST API（获取文件数据、导出图片）
   - [ ] 调研 MasterGo API
   - [ ] 评估技术可行性

2. **实现 Figma 转换器**（5-7 天，P0）
   - [ ] 创建 `src/converters/` 模块
   - [ ] 实现 Figma JSON 解析（递归遍历节点树）
   - [ ] 实现组件映射逻辑（FRAME→hg_view, RECTANGLE+TEXT→hg_button 等）
   - [ ] 实现布局转换（绝对坐标 → 相对坐标）
   - [ ] 实现样式转换（颜色、字体）
   - [ ] 实现资源提取（图片、图标）
   - [ ] 单元测试

3. **实现 MCP Tools（场景 2 专用）**（3-5 天，P0）
   - [ ] import-figma（调用 Figma API + 转换器）
   - [ ] import-mastergo（调用 MasterGo API + 转换器）
   - [ ] download-assets（批量下载图片/图标）

4. **MasterGo 转换器**（3-5 天，P1，可选）
   - [ ] 实现 `mastergo-converter.ts`
   - [ ] 适配 MasterGo 数据格式差异

---

### 阶段 2：集成测试（1-2 周）

**目标**：端到端测试 AI 驱动的 HML 生成和转换流程

**任务清单**：

1. **Codex/Cursor 集成**（3-5 天，P0）
   - [ ] 安装并配置 MCP Server
   - [ ] 测试 Resources、Prompts、Tools

2. **端到端测试用例**（2-3 天，P0）
   - **场景 1 测试**：
     - [ ] 简单按钮页面（需求 → 生成 → 校验 → 预览 → 导出）
     - [ ] 设置页面（错误修复流程测试）
     - [ ] 复杂仪表盘（布局合理性测试）
   - **场景 2 测试**：
     - [ ] 简单 Figma 设计稿（3 个 Frame）
     - [ ] 复杂 Figma 设计稿（Auto Layout、组件实例）
     - [ ] MasterGo 设计稿（可选）
   - **共享工具测试**：
     - [ ] 布局优化（optimize-layout）
     - [ ] 批量编辑（batch-edit）

3. **性能与稳定性测试**（1-2 天，P1）
   - [ ] 压力测试（连续生成 10 个页面）
   - [ ] 大文件测试（20+ 组件）
   - [ ] 错误恢复测试

---

### 阶段 3：增强功能（1 个月）

**目标**：提升生成质量和用户体验

**任务清单**：

1. **设计 Token 系统**（3-5 天，P1）
   - [ ] 定义 Token 结构（颜色、字体、间距）
   - [ ] 创建默认 Token 文件
   - [ ] 更新 Schema 支持 Token 引用
   - [ ] 实现 Token 解析器

2. **模板库扩展**（3-5 天，P1）
   - [ ] 补充高频页面模板（首页、配对页、设置页、音乐播放器、通知中心）
   - [ ] 每个模板包含 HML + 截图 + 说明
   - [ ] 更新 MCP Resource

3. **错误自动修复**（5-7 天，P2）
   - [ ] 实现 FixSuggestion 生成器
   - [ ] 自动修复规则（ID 格式、尺寸、颜色、缺少属性）
   - [ ] MCP Tool: `auto-fix-hml`
   - [ ] 测试自动修复质量

---

### 阶段 4：文档与发布（1 周）

**目标**：完善文档，准备发布

**任务清单**：

1. **用户文档**（2-3 天，P0）
   - [ ] 快速开始指南
   - [ ] 使用教程（从零生成 + 设计稿转换）
   - [ ] 最佳实践
   - [ ] 故障排查

2. **开发者文档**（1-2 天，P1）
   - [ ] 架构文档（架构图、数据流图）
   - [ ] API 参考
   - [ ] 扩展指南
   - [ ] 贡献指南

3. **发布准备**（1-2 天，P0）
   - [ ] 版本号管理（MCP Server v1.0.0, Schema v1.0.0）
   - [ ] CHANGELOG.md
   - [ ] NPM 发布（可选）
   - [ ] 示例项目

---

### 时间表

| 阶段 | 时长 | 关键里程碑 |
|---|---|---|
| **阶段 0** | 1-2 周 | Schema 完成 + MCP 接口设计完成 |
| **阶段 1** | 2-3 周 | MCP Server（场景 1）完成 + 单元测试通过 |
| **阶段 1.5** | 2-3 周 | 设计稿转换能力完成 + Figma 转换器可用 |
| **阶段 2** | 1-2 周 | 集成测试完成 + 两个场景闭环跑通 |
| **阶段 3** | 1 个月 | Token 系统 + 模板库 + 自动修复 |
| **阶段 4** | 1 周 | 文档完善 + 发布准备 |
| **总计** | **2.5-3.5 个月** | 完整 AI 驱动系统上线 |

---

## 技术栈

### Skill
- **格式**：Markdown
- **工具**：无需编译，直接被 AI 工具读取

### Schema
- **格式**：JSON Schema (Draft-07)
- **验证库**：ajv (JavaScript), jsonschema (Python)

### MCP Server
- **语言**：TypeScript
- **框架**：MCP SDK (@modelcontextprotocol/sdk)
- **运行时**：Node.js 18+
- **构建**：tsup / esbuild
- **测试**：vitest / jest

---

## 与 Designer 主工程的关系

MCP Server **不重复实现** Designer 已有功能，而是**调用**：

| Designer 模块 | MCP 调用方式 |
|---|---|
| `HmlParser` | 直接导入，解析 HML |
| `HmlSerializer` | 直接导入，生成 HML |
| `HoneyCCodeGenerator` | 调用生成 C 代码 |
| `HmlValidator`（待实现） | 导入校验逻辑 |
| Webview 预览引擎 | 通过进程间通信调用 |
| `AssetManager` | 查询资源路径 |

**集成方式**：Monorepo（MCP Server 作为 Designer 工程的子包）

---

## 风险与应对

| 风险 | 应对策略 |
|------|---------|
| MCP Server 性能问题 | 缓存机制、异步处理、headless 渲染优化 |
| AI 生成质量不稳定 | 强化 Skill 文档、细化 Prompt、多轮修复机制 |
| Schema 维护成本高 | 自动生成 Schema、版本管理、向后兼容 |
| 与 Designer 代码耦合 | 清晰的接口层、最小化依赖、独立测试 |

---

## 成功标准

### 技术指标
- ✅ Schema 覆盖率 ≥ 90%（所有组件）
- ✅ 校验准确率 ≥ 95%
- ✅ 预览生成时间 ≤ 2 秒
- ✅ AI 错误修复成功率 ≥ 80%（3 轮内）
- ✅ 单元测试覆盖率 ≥ 80%

### 用户体验指标
- ✅ 首次成功率 ≥ 70%（AI 首次生成即合法）
- ✅ 错误提示清晰度 ≥ 4/5（用户评分）
- ✅ 生成速度 ≤ 10 秒（从需求到预览）
- ✅ 用户满意度 ≥ 4/5

---

## 相关文档

**Skill 文档**：
- `skills/honeygui-designer/SKILL.md` - 从零生成指导
- `skills/honeygui-import/SKILL.md` - 设计稿转换指导

**MCP 文档**：
- `mcp/TODO.md` - 开发待办事项
- `mcp/docs/api-reference.md` - API 参考（待创建）
- `mcp/docs/integration-guide.md` - 集成指南（待创建）

**主项目文档**：
- `/AGENTS.md` - 项目整体说明
- `/README.md` - HoneyGUI Designer 主文档

**外部资源**：
- [MCP 官方文档](https://modelcontextprotocol.io/)
- [Figma API](https://www.figma.com/developers/api)

---

## 联系方式

- **项目负责人**：howie_wang
- **问题反馈**：https://gitee.com/realmcu/HoneyGUI/issues

---

## 许可证

与 HoneyGUI Design 主项目保持一致（MIT License）

---

**最后更新**：2025-03-31
