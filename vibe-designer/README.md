# HoneyGUI Vibe Designer

本目录包含 HoneyGUI Designer 的 AI 驱动能力，包括 Skill 定义和 MCP Server 实现。

---

## 目录结构

```
vibe-designer/
├── README.md                    # 本文件：整体规划和说明
├── skills/                      # Skill 定义（软约束）
│   ├── honeygui-designer/       # 主 Skill：HML 生成指导
│   │   ├── SKILL.md             # 核心工作流和快速指南
│   │   ├── README.md            # Skill 使用说明
│   │   ├── references/          # 详细参考文档
│   │   │   ├── components.md    # 组件库完整文档
│   │   │   ├── hml-syntax.md    # HML 语法规范
│   │   │   ├── design-principles.md  # 设计原则
│   │   │   └── layout-patterns.md    # 布局模式
│   │   ├── assets/              # 示例和资源
│   │   │   └── examples/        # HML 示例文件
│   │   └── scripts/             # 工具脚本
│   └── schema/                  # JSON Schema 定义（硬边界）
│       ├── hml-schema.json      # HML 完整 schema
│       ├── components/          # 组件 schema（按类型分）
│       │   ├── basic.json
│       │   ├── interactive.json
│       │   ├── container.json
│       │   └── advanced.json
│       ├── validation-rules.json # 验证规则
│       └── design-tokens.json   # 设计 token 定义
└── mcp/                         # MCP Server 实现（能力接线）
    ├── TODO.md                  # 开发待办事项
    ├── honeygui-mcp/            # MCP Server 核心实现
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts         # MCP 入口
    │   │   ├── server.ts        # MCP Server 主逻辑
    │   │   ├── resources/       # Resources 实现
    │   │   │   ├── schema.ts    # 提供 schema 资源
    │   │   │   ├── templates.ts # 提供模板资源
    │   │   │   └── tokens.ts    # 提供 token 资源
    │   │   ├── prompts/         # Prompts 实现
    │   │   │   ├── generate-ui.ts
    │   │   │   ├── fix-errors.ts
    │   │   │   └── optimize-layout.ts
    │   │   ├── tools/           # Tools 实现
    │   │   │   ├── validate.ts  # 校验 HML
    │   │   │   ├── preview.ts   # 生成预览
    │   │   │   ├── export.ts    # 导出代码
    │   │   │   └── patch.ts     # 应用修改
    │   │   └── utils/           # 工具函数
    │   │       ├── hml-parser.ts
    │   │       ├── validator.ts
    │   │       └── logger.ts
    │   ├── tests/               # 单元测试
    │   └── README.md
    └── docs/                    # MCP 使用文档
        ├── api-reference.md     # API 参考
        ├── integration-guide.md # 集成指南
        ├── examples/            # 使用示例
        └── troubleshooting.md   # 故障排查
```

---

## 核心概念

### 1. Skill（软约束）

**定义**：告诉 AI "应该如何生成 HML"

**位置**：`vibe-designer/skills/honeygui-designer/`

**内容**：
- 组件用法说明
- 设计原则和最佳实践
- 常见布局模式
- HML 语法规则
- 示例 HML 文件

**作用**：
- 指导 AI 生成符合规范的 HML
- 提供参考模板和示例
- 传达设计理念和约束

**使用方式**：
- AI 编程工具（Codex, Cursor）加载 Skill
- AI 根据 Skill 内容生成 HML
- 触发关键词：设计、创建界面、生成 HML、嵌入式 GUI 等

---

### 2. Schema（硬边界）

**定义**：程序化定义 HML 的合法边界

**位置**：`vibe-designer/skills/schema/`

**内容**：
- JSON Schema 格式的组件定义
- 必需属性、可选属性、值约束
- 嵌套规则、组合规则
- 设计约束（最小尺寸、间距等）

**作用**：
- 程序化校验 AI 生成的 HML
- 提供明确的错误报告
- 防止非法组件或属性

**使用方式**：
- MCP Server 加载 schema
- AI 生成 HML 后调用校验
- 返回错误列表和修复建议

---

### 3. MCP Server（能力接线）

**定义**：暴露 Designer 能力给 AI 工具的接口层

**位置**：`vibe-designer/mcp/honeygui-mcp/`

**内容**：
- **Resources**：规则数据（schema、templates、tokens）
- **Prompts**：生成指导（generate-ui、fix-errors）
- **Tools**：操作能力（validate、preview、export）

**作用**：
- 让 Codex/Cursor 能够调用 Designer 能力
- 提供标准化的 MCP 接口
- 集成 Designer 现有功能

**使用方式**：
- AI 工具通过 MCP 协议调用
- 支持 stdio、HTTP、WebSocket 等传输方式

---

## 工作流程

### AI 驱动的 HML 生成流程

```
1. 用户描述需求
   ↓
2. AI 读取 Skill（软约束）
   ↓
3. AI 读取 Schema（硬边界）via MCP resources
   ↓
4. AI 生成初始 HML
   ↓
5. AI 调用 MCP tool: validate-hml
   ↓
6. MCP 返回校验结果（errors, warnings, suggestions）
   ↓
7. AI 根据错误报告修复 HML
   ↓
8. AI 调用 MCP tool: preview-ui
   ↓
9. MCP 返回预览截图
   ↓
10. 用户确认 → AI 调用 MCP tool: export-code
   ↓
11. 生成最终 C 代码
```

---

## 与 Designer 主工程的关系

### 复用 Designer 现有能力

MCP Server **不重复实现** Designer 已有功能，而是**调用**：

| Designer 模块 | MCP 调用方式 |
|---|---|---|
| `HmlParser` | 直接导入，解析 HML |
| `HmlSerializer` | 直接导入，生成 HML |
| `HoneyCCodeGenerator` | 调用生成 C 代码 |
| `HmlValidator`（待实现） | 导入校验逻辑 |
| Webview 预览引擎 | 通过进程间通信调用 |
| `AssetManager` | 查询资源路径 |

### 集成方式

**方案 A：Monorepo**（推荐）
- MCP Server 作为 Designer 工程的子包
- 共享 TypeScript 代码
- 统一构建和测试

**方案 B：独立仓库**
- MCP Server 独立部署
- 通过 HTTP/RPC 调用 Designer 能力
- 更松耦合，但需要额外通信层

**当前采用**：方案 A（Monorepo）

---

## 开发路线图

### 阶段 0：基础设施（1-2 周）

- [x] 创建 `vibe-designer/` 目录结构
- [x] 移动现有 Skill 到 `vibe-designer/skills/`
- [ ] 生成 HML JSON Schema
- [ ] 实现 HML 校验器
- [ ] 设计 MCP 接口（resources/prompts/tools）

### 阶段 1：MCP Server 实现（2-3 周）

- [ ] 初始化 MCP Server 项目
- [ ] 实现 Resources（schema、templates）
- [ ] 实现 Prompts（生成指导）
- [ ] 实现 Tools（validate、preview、export）
- [ ] 单元测试

### 阶段 2：集成测试（1-2 周）

- [ ] 配置 Codex/Cursor 连接 MCP Server
- [ ] 端到端测试：需求 → 生成 → 校验 → 修复 → 预览 → 导出
- [ ] 优化错误提示格式
- [ ] 记录问题和改进点

### 阶段 3：增强功能（1 个月）

- [ ] 设计 Token 系统
- [ ] 扩展模板库
- [ ] 错误自动修复
- [ ] 性能优化

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

## 使用指南

### 开发者（扩展 Skill）

1. 编辑 `vibe-designer/skills/honeygui-designer/references/*.md`
2. 添加新组件文档到 `components.md`
3. 更新 `vibe-designer/skills/schema/hml-schema.json`
4. 重新构建 MCP Server

### AI 工具用户（Codex/Cursor）

1. 安装 MCP Server：
   ```bash
   cd vibe-designer/mcp/honeygui-mcp
   npm install
   npm run build
   ```

2. 配置 AI 工具：
   ```json
   {
     "mcpServers": {
       "honeygui": {
         "command": "node",
         "args": ["path/to/vibe-designer/mcp/honeygui-mcp/dist/index.js"]
       }
     }
   }
   ```

3. 使用：
   ```
   User: "Create a smartwatch settings screen with brightness and volume sliders"
   AI: [reads skill] → [generates HML] → [validates] → [previews] → [exports]
   ```

---

## 贡献指南

### 添加新组件

1. 在 `vibe-designer/skills/honeygui-designer/references/components.md` 添加文档
2. 在 `vibe-designer/skills/schema/components/*.json` 添加 schema 定义
3. 更新 MCP Server 的 resources 映射
4. 添加测试用例

### 添加新模板

1. 创建 HML 文件到 `vibe-designer/skills/honeygui-designer/assets/examples/`
2. 截图并添加到 `assets/screenshots/`
3. 在 `references/layout-patterns.md` 添加说明
4. 更新 MCP Server 的 templates resource

---

## 相关文档

- **方向调整文档**：`/docs/方向调整共识文档.md`（待创建）
- **MCP 待办事项**：`vibe-designer/mcp/TODO.md`
- **Designer 主文档**：`/AGENTS.md`, `/README.md`
- **MCP 官方文档**：https://modelcontextprotocol.io/

---

## 联系方式

- **项目负责人**：howie_wang
- **问题反馈**：https://gitee.com/realmcu/HoneyGUI/issues
- **讨论组**：（待建立）

---

## 许可证

与 HoneyGUI Design 主项目保持一致（MIT License）
