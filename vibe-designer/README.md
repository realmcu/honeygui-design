# HoneyGUI Vibe Designer

将 HoneyGUI Designer 转型为 **AI 驱动的嵌入式 UI 生成平台**，通过 Skills + Extension HTTP API 让 AI 工具（Claude Code 等）能够生成和验证 HoneyGUI 项目。

**核心理念**：
- **AI 生成** → Schema 约束 → 程序化校验 → 预览确认 → 导出代码
- **一级端点**：每个功能独立的 HTTP 端点，清晰直观（如 `/api/codegen`）
- **统一复用**：所有端点调用同一个 `executeCommand()`，零冗余，功能对齐有保证

---

## 📖 快速导航

- [核心场景](#核心场景)
- [架构设计](#架构设计)
- [目录结构](#目录结构)
- [核心概念](#核心概念)
- [快速开始](#快速开始)
- [Extension HTTP API](#extension-http-api)
- [开发计划](#开发计划)
- [技术栈](#技术栈)

---

## 核心场景

### 自然语言驱动的 UI 开发

**描述**：用户通过自然语言描述需求，AI 辅助生成或修改 HoneyGUI 项目。

**支持的工作模式**：

#### 模式 1：创建新项目
```
用户：创建一个智能手表设置界面，包含亮度和音量滑块
  ↓
AI 生成完整 HML → 验证 → 预览 → 创建项目
```

#### 模式 2：修改已有项目
```
用户：在现有项目中添加一个返回按钮
  ↓
AI 读取现有 HML → 生成修改后的 HML → 验证 → 预览 → 更新文件
```

#### 模式 3：优化和调整
```
用户：调整按钮间距为 20px，所有标签字号改为 18
  ↓
AI 批量修改 HML → 验证 → 预览
```

**工作流**：
```
用户需求（自然语言）
  ↓
Claude Code 读取 skills/honeygui-designer/
  ↓
AI 生成/修改 HML
  ↓
通过 Bash tool 调用 Extension HTTP API（一级端点）
  - POST /api/validate-hml → 验证 HML 内容
  - POST /api/codegen → 代码生成
  - POST /api/simulation/run → 运行仿真
  - POST /api/environment/refresh → 刷新环境
  - 或直接保存文件 → 更新已有项目（模式 2/3）
  ↓
输出：完整项目或更新后的文件
```

**关键技术**：
- Skill: `skills/honeygui-designer/` - HML 生成指导（包含 HTTP API 调用示例）
- Schema: `skills/schema/hml-schema.json` - 组件定义和验证规则
- Extension HTTP API: VSCode Extension 暴露的 REST API（端口 38912）

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────┐
│ Claude Code CLI                     │
│ - 用户输入自然语言                  │
│ - 读取 Skills 文档                  │
│ - 使用 Bash tool 调用 HTTP API     │
└────────────┬────────────────────────┘
             │ HTTP (curl/fetch)
             │
             ↓
┌─────────────────────────────────────┐
│ VSCode Extension (HTTP Server)      │  ← 所有功能在这里执行 ✅
│   ExtensionApiService (port 38912)  │
│                                      │
│ 一级 API 端点（每个功能独立）：      │
│   ├─ GET  /health                   │  → 健康检查
│   ├─ GET  /api/version              │  → 版本信息
│   ├─ POST /api/new-project          │  → 新建项目
│   ├─ POST /api/validate-hml         │  → 验证 HML 内容
│   ├─ POST /api/codegen              │  → 代码生成
│   ├─ POST /api/simulation/run       │  → 运行仿真
│   └─ POST /api/simulation/stop      │  → 停止仿真
│                                      │
│ 内部统一复用 vscode.commands：       │
│   每个端点 → executeCommand()        │
│            → 对应的 VSCode 命令      │
└─────────────────────────────────────┘
```

### 设计原则

1. **VSCode 内执行**：所有功能在 VSCode Extension 中执行，开发过程不离开 VSCode
2. **一级端点设计**：每个功能一个独立的 HTTP 端点，URL 清晰直观（如 `/api/codegen`）
3. **统一复用核心**：所有端点调用同一个 `executeCommand()` 方法，零冗余
4. **功能完全对齐**：HTTP API 直接复用 VSCode 命令，行为完全一致
5. **Skills 指导**：通过 Skills 文档教 AI 如何调用 HTTP API
6. **简单直接**：无需 MCP Server，减少中间层，降低维护成本

### 为什么不用 MCP Server？

**原因**：
- Claude Code CLI 支持 Bash tool，可以直接调用 HTTP API（curl/fetch）
- Skills 文档可以包含 HTTP API 调用示例，AI 能够理解和执行
- 减少一层协议适配器（MCP Server），架构更简单

**优势**：
- ✅ 更简单：只需实现 Extension HTTP Server
- ✅ 更直接：AI 直接调用 HTTP API
- ✅ 更灵活：Skills 可以随时更新 API 调用方式
- ✅ 维护成本低：只需维护 Extension + Skills

---

## 目录结构

```
vibe-designer/
├── README.md                    # 本文件：整体说明和架构设计
└── skills/                      # Skills 定义（AI 学习材料）
    └── honeygui-designer/       # AI 辅助生成和编辑 HML 的指导文档
        ├── SKILL.md             # 核心工作流和快速指南
        ├── README.md            # Skill 使用说明
        ├── references/          # 详细参考文档
        │   ├── components.md    # 组件库完整文档
        │   ├── hml-syntax.md    # HML 语法规范
        │   ├── design-principles.md  # 设计原则
        │   ├── layout-patterns.md    # 布局模式
        │   └── http-api.md      # HTTP API 调用指南（新增）
        ├── schema/              # JSON Schema 定义（验证规则）
        │   ├── hml-schema.json  # HML 完整 schema
        │   └── README.md        # Schema 说明
        └── assets/examples/     # HML 示例文件
```

**说明**：
- `skills/honeygui-designer/` - 完整的 skill，包含文档、schema 和示例
- 无 `mcp/` 目录 - 不使用 MCP Server，采用 Skills + Extension HTTP API 方式

---

## 核心概念

### 1. Skills（软约束）

**定义**：告诉 AI "应该如何生成 HML 以及如何调用 Extension API"

**内容**：
- 组件用法说明
- 设计原则和最佳实践
- 常见布局模式
- HML 语法规则
- 示例 HML 文件
- **HTTP API 调用指南**（新增）

**使用方式**：
- AI 工具（Claude Code）加载 Skill
- Skill 触发关键词：设计、创建界面、生成 HML
- AI 根据 Skill 生成 HML，并调用 HTTP API 验证和创建项目

---

### 2. Schema（硬边界）

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

### 3. Extension HTTP API（能力暴露）

**定义**：VSCode Extension 暴露的 REST API，让 AI 工具能够调用 Extension 功能

**端口**：`localhost:38912`

**支持的 API 端点**（一级命令设计）：

| 端点 | 方法 | 分类 | 功能 | 输入 | 复用命令 | 测试示例 |
|------|------|------|------|------|---------|---------|
| `/health` | GET | 基础 | 健康检查 | 无 | 无 | **请求**: `curl http://localhost:38912/health`<br>**响应**: `{"status":"ok","service":"HoneyGUI Extension API","port":38912,"timestamp":"..."}` |
| `/api/version` | GET | 基础 | 获取版本信息 | 无 | 无 | **请求**: `curl http://localhost:38912/api/version`<br>**响应**: `{"success":true,"data":{"name":"HoneyGUI Visual Designer","version":"1.6.65",...}}` |
| `/api/new-project` | POST | 项目 | 创建新项目 | 无 | `honeygui.newProject` | **请求**: `curl -X POST http://localhost:38912/api/new-project`<br>**响应**: `{"success":true,"command":"honeygui.newProject","data":...}` |
| `/api/validate-hml` | POST | 验证 | 验证 HML XML 内容 | `{hmlContent}` 或 `{filePath}` | 无（直接调用 HmlValidationService） | **方式1（内容）**: `curl -X POST http://localhost:38912/api/validate-hml -H "Content-Type: application/json" -d '{"hmlContent":"<?xml version=\"1.0\"?><hml>...</hml>"}'`<br>**方式2（文件）**: `curl -X POST http://localhost:38912/api/validate-hml -H "Content-Type: application/json" -d '{"filePath":"ui/main.hml"}'`<br>**响应**: `{"success":true,"data":{"valid":true,"errors":[],"warnings":[],"validationRules":[...]}}` |
| `/api/codegen` | POST | 代码生成 | 生成 C 代码 | 无 | `honeygui.codegen` | **请求**: `curl -X POST http://localhost:38912/api/codegen`<br>**响应**: `{"success":true,"command":"honeygui.codegen","data":...}` |
| `/api/simulation/run` | POST | 仿真 | 运行仿真 | 无 | `honeygui.simulation` | **请求**: `curl -X POST http://localhost:38912/api/simulation/run`<br>**响应**: `{"success":true,"command":"honeygui.simulation","data":...}` |
| `/api/simulation/stop` | POST | 仿真 | 停止仿真 | 无 | `honeygui.simulation.stop` | **请求**: `curl -X POST http://localhost:38912/api/simulation/stop`<br>**响应**: `{"success":true,"command":"honeygui.simulation.stop","data":...}` |

**设计原则**：
- ✅ **一级端点**：每个功能一个独立的 HTTP 端点，URL 直观清晰
- ✅ **内部复用**：所有端点统一调用 `executeCommand()` 方法，复用 VSCode 命令
- ✅ **功能对齐**：HTTP API 和 VSCode 命令完全一致，零冗余
- ✅ **即测即用**：每个端点都有完整的 curl 测试示例

---

## 快速开始

### 前置条件

1. 安装并启动 VSCode
2. 安装 HoneyGUI Designer Extension
3. Extension 自动启动 HTTP Server（端口 38912）

验证 Extension 是否启动：
```bash
curl http://localhost:38912/health
```
预期输出：`{"status":"ok",...}`

**更多测试示例见下方 API 端点表格的"测试示例"列。**

### 快速测试

所有端点的测试示例已整合在上表的"测试示例"列中。以下是常见的响应格式：

**基础端点响应示例**：
```bash
# /health
{"status":"ok","service":"HoneyGUI Extension API","port":38912,"timestamp":"2026-04-20T..."}

# /api/version
{"success":true,"data":{"name":"HoneyGUI Visual Designer","version":"1.6.65",...}}

# /api/commands
{"success":true,"data":{"total":15,"commands":[{endpoint,command,title,...}]}}
```

**功能端点响应示例**：
```bash
# 成功
{"success":true,"command":"honeygui.codegen","data":...}

# 失败
{"success":false,"command":"honeygui.codegen","error":{"code":"COMMAND_EXECUTION_ERROR","message":"..."}}
```

### 在 Claude Code 中使用

Claude Code 会自动读取 `skills/honeygui-designer/` 中的 Skills 文档，并根据文档中的 HTTP API 调用示例来执行操作。

**示例 1：验证 HML 内容**
```
User: 验证这个 HML 文件是否正确

Claude Code:
1. 读取 HML 文件内容
2. 调用验证端点：
   curl -X POST http://localhost:38912/api/validate-hml \
     -H "Content-Type: application/json" \
     -d '{"hmlContent":"<?xml version=\"1.0\"?><hml>...</hml>"}'
3. 返回验证结果（包含 8 个验证规则的执行情况）
```

**示例 2：生成代码**
```
User: 生成 C 代码

Claude Code:
1. 调用一级端点：
   curl -X POST http://localhost:38912/api/codegen
2. 复用 honeygui.codegen 命令，零冗余
```

**示例 2：运行仿真**
```
User: 运行仿真

Claude Code:
1. 调用一级端点：
   curl -X POST http://localhost:38912/api/simulation/run
2. 在 VSCode 中启动仿真终端
```

**示例 3：刷新环境**
```
User: 检查开发环境

Claude Code:
1. 调用一级端点：
   curl -X POST http://localhost:38912/api/environment/refresh
2. 复用现有的环境检查逻辑
```

**示例 4：打开设计器**
```
User: 在设计器中打开 ui/main.hml

Claude Code:
1. 调用一级端点（带参数）：
   curl -X POST http://localhost:38912/api/open-designer \
     -H "Content-Type: application/json" \
     -d '{"filePath":"ui/main.hml"}'
2. 在 VSCode 中打开可视化设计器
```

---

## Extension HTTP API

### 实现说明

**核心文件**：`src/services/ExtensionApiService.ts`

**设计原则**：
1. **一级端点**：每个功能一个独立的 HTTP 端点，URL 直观清晰
2. **内部复用**：所有端点统一调用 `executeCommand()` 方法
3. **零冗余**：不重复实现任何功能逻辑
4. **功能对齐**：HTTP API 和 VSCode 命令完全一致

**架构设计**：
```typescript
// 路由分发 - 一级端点
private async handleRequest(req, res) {
    const url = req.url || '';
    
    if (url === '/api/codegen') {
        return this.handleCodegen(req, res);
    }
    if (url === '/api/simulation/run') {
        return this.handleSimulationRun(req, res);
    }
    // ... 其他端点
}

// 每个端点的处理器
private async handleCodegen(req, res) {
    await this.executeCommand('honeygui.codegen', res);
}

// 核心复用方法 - 所有端点最终都调用这里
private async executeCommand(command: string, res, args = []) {
    const result = await vscode.commands.executeCommand(command, ...args);
    res.end(JSON.stringify({ success: true, command, data: result }));
}
```

**优势**：
- ✅ URL 清晰：`/api/codegen` 比 `/api/command {"command":"honeygui.codegen"}` 更直观
- ✅ 内部复用：所有端点共享 `executeCommand()` 方法，零冗余
- ✅ 易于扩展：新增命令只需添加路由和处理器

**启动方式**：
- Extension 激活时自动启动 HTTP Server（端口 38912）
- 见 `src/extension.ts` 中的 `activate()` 函数

---

## 开发计划

### 当前进度

✅ **已完成**（2026-04-20）
- [x] 创建 `vibe-designer/` 目录结构
- [x] 创建 Skill: `honeygui-designer/`（AI 辅助生成和编辑）
- [x] 生成简化版 HML JSON Schema（4 个核心组件）
- [x] 明确架构设计（Skills + Extension HTTP）
- [x] 删除 MCP 相关内容
- [x] 删除设计稿转换相关内容
- [x] **实现 ExtensionApiService（一级端点设计）**
  - [x] 创建 `src/services/ExtensionApiService.ts`
  - [x] 实现 HTTP Server（Node.js http 模块）
  - [x] 实现核心端点：
    - [x] 基础端点：health, version
    - [x] 项目：new-project
    - [x] 验证：validate-hml
    - [x] 代码生成：codegen
    - [x] 仿真：simulation/run, simulation/stop
  - [x] 实现统一的 `executeCommand()` 复用方法
  - [x] 在 `src/extension.ts` 中集成启动
  - [x] 测试核心功能（health, version, validate-hml）

---

### 阶段 1：Extension HTTP Server 增强（剩余工作）

**目标**：完善 HTTP API 功能和错误处理

**任务清单**：

1. **错误处理增强**（1 天，P0）
   - [ ] 完善错误响应格式
   - [ ] 添加请求日志
   - [ ] 处理边界情况（大请求体、超时等）

2. **测试和验证**（1-2 天，P0）
   - [x] 使用 curl 测试基础端点
   - [ ] 测试所有 HoneyGUI 命令
   - [ ] 验证错误处理
   - [ ] 性能测试

---

### 阶段 2：Skills 文档完善（3-5 天）

**目标**：在 Skills 中添加 HTTP API 调用指南

**任务清单**：

1. **创建 HTTP API 文档**（1-2 天，P0）
   - [ ] 创建 `skills/honeygui-designer/references/http-api.md`
   - [ ] 记录所有 API 端点的调用方式
   - [ ] 提供 curl 和 Node.js fetch 示例
   - [ ] 说明错误处理方式

2. **更新 SKILL.md**（1 天，P0）
   - [ ] 在工作流中加入 HTTP API 调用步骤
   - [ ] 提供完整的端到端示例

3. **添加示例代码**（1-2 天，P1）
   - [ ] 在 `assets/examples/` 中添加更多示例 HML
   - [ ] 包含常见错误和修复示例

---

### 阶段 3：Schema 扩展（1 周）

**目标**：扩展 Schema 到完整组件库

**任务清单**：

1. **添加更多组件**（3-5 天，P1）
   - [ ] 交互组件（slider, switch, progressbar）
   - [ ] 输入组件（input, checkbox, radio）
   - [ ] 容器组件（window, container）
   - [ ] 高级组件（list, grid, canvas, tab）

2. **Schema 测试**（1-2 天，P0）
   - [ ] 创建测试用例（合法 + 非法）
   - [ ] 验证错误提示质量
   - [ ] 边界情况测试

---

### 阶段 4：集成测试（1 周）

**目标**：端到端测试 AI 驱动的 HML 生成流程

**任务清单**：

1. **Claude Code 集成测试**（3-5 天，P0）
   - [ ] 在 Claude Code 中加载 Skills
   - [ ] 测试简单界面生成（单个按钮）
   - [ ] 测试复杂界面生成（设置页面）
   - [ ] 测试错误修复流程
   - [ ] 测试项目创建和预览

2. **质量验证**（1-2 天，P0）
   - [ ] 首次成功率统计
   - [ ] 错误修复成功率统计
   - [ ] 生成速度测试
   - [ ] 用户体验评估

---

### 时间表

| 阶段 | 时长 | 关键里程碑 | 状态 |
|------|------|-----------|------|
| **阶段 1** | ~~1 周~~ 实际 1 天 | Extension HTTP Server 完成 + 7 个核心端点实现 | ✅ 100% 完成 |
| **阶段 2** | 3-5 天 | Skills 文档完善 + HTTP API 指南完成 | ⏳ 待开始 |
| **阶段 3** | 1 周 | Schema 扩展完成 + 测试通过 | ⏳ 待开始 |
| **阶段 4** | 1 周 | 集成测试完成 + Claude Code 可用 | ⏳ 待开始 |
| **总计** | **2-3 周**（比原计划快） | 完整 AI 驱动系统上线 | 进行中 |

**加速原因**：
- 一级端点设计：URL 清晰直观，易于理解和使用
- 统一复用方法：所有端点共享 `executeCommand()`，代码量大幅减少
- 功能对齐保证：直接复用 VSCode 命令，无需重复实现业务逻辑

---

## 技术栈

### Skills
- **格式**：Markdown
- **工具**：无需编译，直接被 AI 工具读取

### Schema
- **格式**：JSON Schema (Draft-07)
- **验证库**：ajv (JavaScript)

### Extension HTTP Server
- **语言**：TypeScript
- **框架**：Node.js http 模块
- **端口**：38912
- **运行环境**：VSCode Extension Host

### 复用的 Extension 模块
- `HmlValidator` - HML 语法验证
- `HmlParser` - HML 解析
- `HmlSerializer` - HML 序列化
- `CodeGenerationService` - C 代码生成
- `ProjectTemplate` - 项目模板
- Webview - 预览界面

---

## 与 Designer 主工程的关系

Extension HTTP Server **完全复用** Designer 已有功能：

### 复用架构

```
HTTP 端点层（一级）
  ↓
POST /api/codegen
  ↓
executeCommand() 方法（复用核心）
  ↓
vscode.commands.executeCommand('honeygui.codegen')
  ↓
CommandManager（现有实现）
  ↓
CodeGenerationService（现有业务逻辑）
```

### 端点与命令映射

| HTTP 端点 | VSCode 命令 | 复用模块 |
|----------|------------|---------|
| `GET /health` | 无 | ExtensionApiService（健康检查） |
| `GET /api/version` | 无 | ExtensionApiService（版本信息） |
| `POST /api/new-project` | `honeygui.newProject` | CommandManager → CreateProjectPanel |
| `POST /api/validate-hml` | 无 | HmlValidationService（HML 验证） |
| `POST /api/codegen` | `honeygui.codegen` | CommandManager → CodeGenerationService |
| `POST /api/simulation/run` | `honeygui.simulation` | CommandManager → SimulationRunner |
| `POST /api/simulation/stop` | `honeygui.simulation.stop` | CommandManager → SimulationRunner |

### 核心原则

1. **一级端点设计**：每个功能一个独立的 HTTP 端点
2. **统一复用方法**：所有端点调用 `executeCommand()`
3. **零冗余代码**：不重复实现任何业务逻辑
4. **功能完全对齐**：HTTP API 和 VSCode 命令行为一致

---

## 成功标准

### 技术指标
- ✅ Schema 覆盖率 ≥ 90%（所有组件）
- ✅ 校验准确率 ≥ 95%
- ✅ HTTP API 响应时间 ≤ 500ms
- ✅ 预览生成时间 ≤ 2 秒
- ✅ AI 错误修复成功率 ≥ 80%（3 轮内）

### 用户体验指标
- ✅ 首次成功率 ≥ 70%（AI 首次生成即合法）
- ✅ 错误提示清晰度 ≥ 4/5（用户评分）
- ✅ 生成速度 ≤ 10 秒（从需求到预览）
- ✅ 所有操作在 VSCode 内完成（不离开 VSCode）
- ✅ 用户满意度 ≥ 4/5

---

## 相关文档

**Skills 文档**：
- `skills/honeygui-designer/SKILL.md` - AI 辅助生成和编辑指导
- `skills/honeygui-designer/references/http-api.md` - HTTP API 调用指南（待创建）

**主项目文档**：
- `/AGENTS.md` - 项目整体说明
- `/README.md` - HoneyGUI Designer 主文档
- `/CLAUDE.md` - Claude Code 开发指南

---

## 联系方式

- **项目负责人**：howie_wang
- **问题反馈**：https://gitee.com/realmcu/HoneyGUI/issues

---

## 许可证

与 HoneyGUI Design 主项目保持一致（MIT License）

---

**最后更新**：2026-04-20
