# HoneyGUI Vibe Designer

将 HoneyGUI Designer 转型为 **AI 驱动的嵌入式 UI 生成平台**，通过 Skills + Extension HTTP API 让 AI 工具（Claude Code 等）能够生成和验证 HoneyGUI 项目。

**核心理念**：AI 生成 → Schema 约束 → 程序化校验 → 预览确认 → 导出代码

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
通过 Bash tool 调用 Extension HTTP API
  - POST /api/validate-hml → 验证语法
  - POST /api/preview-ui → 在 VSCode 中预览
  - POST /api/create-project → 创建新项目（模式 1）
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
│   McpBridgeService (port 38912)     │
│   ├─ POST /api/validate-hml         │  → HmlValidator
│   ├─ POST /api/preview-ui           │  → Webview 预览
│   ├─ POST /api/create-project       │  → ProjectTemplate
│   └─ POST /api/export-code          │  → CodeGenerationService
│                                      │
│ - HmlValidator (语法验证)            │
│ - CodeGenerationService (生成 C 代码)│
│ - Webview (在 VSCode 中预览)         │
│ - ProjectTemplate (创建项目结构)     │
└─────────────────────────────────────┘
```

### 设计原则

1. **VSCode 内执行**：所有功能在 VSCode Extension 中执行，开发过程不离开 VSCode
2. **Skills 指导**：通过 Skills 文档教 AI 如何调用 HTTP API
3. **HTTP 解耦**：Extension 暴露通用的 HTTP API，任何 AI 工具都可以调用
4. **简单直接**：无需 MCP Server，减少中间层，降低维护成本

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
├── skills/                      # Skills 定义（AI 学习材料）
│   ├── honeygui-designer/       # AI 辅助生成和编辑 HML 的指导文档
│   │   ├── SKILL.md             # 核心工作流和快速指南
│   │   ├── README.md            # Skill 使用说明
│   │   ├── references/          # 详细参考文档
│   │   │   ├── components.md    # 组件库完整文档
│   │   │   ├── hml-syntax.md    # HML 语法规范
│   │   │   ├── design-principles.md  # 设计原则
│   │   │   ├── layout-patterns.md    # 布局模式
│   │   │   └── http-api.md      # HTTP API 调用指南（新增）
│   │   └── assets/examples/     # HML 示例文件
│   └── schema/                  # JSON Schema 定义（验证规则）
│       ├── hml-schema.json      # HML 完整 schema
│       └── README.md            # Schema 说明
```

**说明**：
- `skills/` - AI 学习如何生成 HML 的文档
- `schema/` - 程序化验证 HML 的 JSON Schema
- 无 `mcp/` 目录 - 不使用 MCP Server

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

**支持的 API 端点**：

| 端点 | 方法 | 功能 | 输入 | 输出 |
|------|------|------|------|------|
| `/health` | GET | 健康检查 | 无 | `{"status":"ok"}` |
| `/api/validate-hml` | POST | 验证 HML 语法 | `{hml: string}` | `{valid: boolean, errors: [...]}` |
| `/api/preview-ui` | POST | 在 VSCode 中预览 | `{hml: string}` | `{success: boolean}` |
| `/api/create-project` | POST | 创建完整项目 | `{name, hml, outputDir}` | `{success, projectPath, files}` |
| `/api/export-code` | POST | 导出 C 代码 | `{hml: string}` | `{success, code: {...}}` |

---

## 快速开始

### 前置条件

1. 安装并启动 VSCode
2. 安装 HoneyGUI Designer Extension
3. Extension 自动启动 HTTP Server（端口 38912）

### 测试 Extension HTTP API

```bash
# 1. 检查 Extension 是否运行
curl http://localhost:38912/health
# 预期输出：{"status":"ok","port":38912}

# 2. 验证 HML
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"hml":"<?xml version=\"1.0\"?><hml><view id=\"view_main\"></view></hml>"}'
# 预期输出：{"valid":true}

# 3. 创建项目
curl -X POST http://localhost:38912/api/create-project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_project",
    "hml": "<?xml version=\"1.0\"?>...",
    "outputDir": "/tmp"
  }'
```

### 在 Claude Code 中使用

Claude Code 会自动读取 `skills/honeygui-designer/` 中的 Skills 文档，并根据文档中的 HTTP API 调用示例来执行操作。

**示例 1：创建新项目**
```
User: 创建一个智能手表界面，包含一个确认按钮

Claude Code:
1. 读取 skills/honeygui-designer/
2. 生成 HML
3. 使用 Bash tool 调用：
   curl -X POST http://localhost:38912/api/validate-hml ...
4. 如果验证通过，调用：
   curl -X POST http://localhost:38912/api/create-project ...
5. 在 VSCode 中自动打开项目
```

**示例 2：修改已有项目**
```
User: 在 main.hml 中添加一个返回按钮，位置在左上角

Claude Code:
1. 读取 skills/honeygui-designer/
2. 读取 ui/main.hml 文件
3. 分析现有布局，生成新的 HML（添加返回按钮）
4. 使用 Bash tool 调用：
   curl -X POST http://localhost:38912/api/validate-hml ...
5. 如果验证通过：
   - 保存修改后的 HML 到 ui/main.hml
   - 调用 POST /api/preview-ui 预览效果
```

**示例 3：批量调整**
```
User: 把所有按钮的高度改为 50px

Claude Code:
1. 读取 ui/main.hml
2. 查找所有 hg_button 组件
3. 修改 h 属性为 50
4. 验证 → 保存 → 预览
```

---

## Extension HTTP API

### 实现计划

**文件**：`src/services/McpBridgeService.ts`

**关键代码**：
```typescript
import * as http from 'http';
import * as vscode from 'vscode';
import { HmlValidator } from '../validators/HmlValidator';
import { CodeGenerationService } from './CodeGenerationService';

export class McpBridgeService implements vscode.Disposable {
    private server: http.Server | undefined;
    private port: number = 38912;

    async start(context: vscode.ExtensionContext) {
        this.server = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            try {
                if (req.method === 'GET' && req.url === '/health') {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ status: 'ok', port: this.port }));
                }
                else if (req.method === 'POST' && req.url === '/api/validate-hml') {
                    const body = await this.readBody(req);
                    const result = await this.validateHml(body.hml);
                    res.statusCode = 200;
                    res.end(JSON.stringify(result));
                }
                // ... 其他端点
            } catch (error: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        return new Promise<void>((resolve, reject) => {
            this.server!.listen(this.port, () => {
                console.log(`HTTP Server listening on http://localhost:${this.port}`);
                vscode.window.showInformationMessage(`HoneyGUI HTTP Server started on port ${this.port}`);
                resolve();
            });
            this.server!.on('error', reject);
        });
    }

    private async validateHml(hml: string) {
        const validator = new HmlValidator();
        return await validator.validate(hml);
    }

    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}
```

**在 Extension 入口启动**：
```typescript
// src/extension.ts
import { McpBridgeService } from './services/McpBridgeService';

export async function activate(context: vscode.ExtensionContext) {
    // ... 现有代码 ...
    
    // 启动 HTTP Server
    const httpServer = new McpBridgeService();
    try {
        await httpServer.start(context);
        context.subscriptions.push(httpServer);
    } catch (error) {
        console.error('Failed to start HTTP Server:', error);
        vscode.window.showErrorMessage('Failed to start HoneyGUI HTTP Server');
    }
}
```

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

---

### 阶段 1：Extension HTTP Server 实现（1 周）

**目标**：实现 Extension HTTP Server，暴露 4 个核心 API

**任务清单**：

1. **创建 McpBridgeService**（2-3 天，P0）
   - [x] 创建 `src/services/McpBridgeService.ts`
   - [ ] 实现 HTTP Server（Node.js http 模块）
   - [ ] 实现 `/health` 端点
   - [ ] 实现 `/api/validate-hml` 端点
   - [ ] 实现 `/api/preview-ui` 端点（调用 Webview）
   - [ ] 实现 `/api/create-project` 端点
   - [ ] 实现 `/api/export-code` 端点
   - [ ] 错误处理和日志

2. **集成到 Extension**（1 天，P0）
   - [ ] 在 `src/extension.ts` 中启动 McpBridgeService
   - [ ] 添加必要的 VSCode 命令（preview、create-project）
   - [ ] 测试 Extension 启动流程

3. **测试 HTTP API**（1-2 天，P0）
   - [ ] 使用 curl 测试所有端点
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

| 阶段 | 时长 | 关键里程碑 |
|------|------|-----------|
| **阶段 1** | 1 周 | Extension HTTP Server 完成 + API 测试通过 |
| **阶段 2** | 3-5 天 | Skills 文档完善 + HTTP API 指南完成 |
| **阶段 3** | 1 周 | Schema 扩展完成 + 测试通过 |
| **阶段 4** | 1 周 | 集成测试完成 + Claude Code 可用 |
| **总计** | **3-4 周** | 完整 AI 驱动系统上线 |

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

Extension HTTP Server **不重复实现** Designer 已有功能，而是**调用**：

| Designer 模块 | HTTP API 调用方式 |
|--------------|------------------|
| `HmlParser` | 直接导入，解析 HML |
| `HmlSerializer` | 直接导入，生成 HML |
| `HmlValidator` | 直接导入，校验 HML |
| `CodeGenerationService` | 直接导入，生成 C 代码 |
| `ProjectTemplate` | 直接导入，创建项目 |
| Webview 预览引擎 | 通过 VSCode 命令调用 |

**集成方式**：Extension 内部模块，无需额外集成

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
