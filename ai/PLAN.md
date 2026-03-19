# HoneyGUI AI 集成开发计划

## 项目概述

将 HoneyGUI Designer 转型为 **AI 驱动的嵌入式 UI 生成与收敛平台**，通过 MCP (Model Context Protocol) 暴露能力给 AI 编程工具（Codex, Cursor 等）。

**核心理念**：AI 生成 → Schema 约束 → 程序化校验 → 预览确认 → 导出代码

---

## 当前进度

### ✅ 已完成（2025-03-19）

- [x] 创建 `ai/` 目录结构
- [x] 移动 Skill 到 `ai/skills/honeygui-designer/`
- [x] 创建 MCP 待办事项文档 (`ai/mcp/TODO.md`)
- [x] 创建整体规划文档 (`ai/README.md`)
- [x] 生成简化版 HML JSON Schema (`ai/skills/schema/hml-schema.json`)
  - 包含 4 个核心组件：hg_button, hg_label, hg_image, hg_view
  - 实现 P0 级别约束（必需属性、尺寸、格式）

---

## 阶段 0：基础设施（1-2 周）

### 目标
建立 Schema 验证和 MCP 接口的基础能力。

### 任务清单

#### 1. Schema 测试与验证（1-2 天）

**优先级**：P0

**任务**：
- [ ] 创建 Schema 测试脚本
  - 位置：`ai/skills/schema/test-schema.js` (Node.js) 或 `test-schema.py` (Python)
  - 功能：加载 Schema，验证合法/非法 HML JSON
- [ ] 准备测试用例
  - 合法用例 3 个：按钮、标签、完整页面
  - 非法用例 5 个：ID 格式错误、尺寸过小、颜色格式错误、缺少必需属性、资源路径错误
- [ ] 验证错误提示质量
  - 检查错误信息是否清晰
  - 检查错误路径是否准确
- [ ] 文档：记录测试结果和问题

**交付物**：
- `ai/skills/schema/test-schema.js`
- `ai/skills/schema/test-cases/` 目录（包含测试 JSON 文件）
- 测试报告（Markdown）

---

#### 2. 扩展 Schema 到完整组件库（3-5 天）

**优先级**：P1

**任务**：
- [ ] 添加交互组件（3 个）
  - hg_slider - 滑块
  - hg_switch - 开关
  - hg_progressbar - 进度条
- [ ] 添加输入组件（3 个）
  - hg_input - 文本输入
  - hg_checkbox - 复选框
  - hg_radio - 单选框
- [ ] 添加容器组件（2 个）
  - hg_window - 窗口容器
  - hg_container - 通用容器
- [ ] 添加高级组件（4 个）
  - hg_list / hg_list_item - 列表
  - hg_grid - 网格
  - hg_canvas - 画布
  - hg_tab - 标签页

**交付物**：
- `ai/skills/schema/hml-schema.json` v0.2.0+
- 每个新组件的测试用例

---

#### 3. 实现 HML Validator（3-4 天）

**优先级**：P0

**任务**：
- [ ] 创建 `HmlValidator` 类
  - 位置：`src/hml/HmlValidator.ts`
  - 功能：调用 JSON Schema + 自定义验证规则
- [ ] 实现 Schema 验证
  - 使用 `ajv` 库
  - 加载 `hml-schema.json`
  - 返回 Schema 错误列表
- [ ] 实现自定义验证规则
  - ✅ ID 唯一性检查（跨所有组件）
  - ✅ 组件重叠检测（警告）
  - ✅ 超出父容器检测
  - ✅ 超出屏幕边界检测
  - ✅ 嵌套深度检查（≤ 4-5 层）
  - ⚠️ 资源文件存在性（可选）
  - ⚠️ 颜色对比度计算（可选）
- [ ] 定义 ValidationResult 接口
  ```typescript
  interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions?: string[];
  }
  
  interface ValidationError {
    type: 'schema' | 'structure' | 'constraint' | 'unsupported';
    component?: string;
    property?: string;
    path: string;
    message: string;
    value?: any;
    fix?: FixSuggestion;
  }
  
  interface FixSuggestion {
    action: 'replace' | 'add' | 'remove';
    path: string;
    oldValue?: any;
    newValue?: any;
  }
  ```
- [ ] 单元测试
  - 测试 Schema 验证
  - 测试自定义规则
  - 测试错误格式

**交付物**：
- `src/hml/HmlValidator.ts`
- `src/hml/HmlValidator.test.ts`
- 验证器使用文档

---

#### 4. 设计 MCP 接口（2-3 天）

**优先级**：P0

**任务**：
- [ ] 定义 Resources（规则数据）
  - `honeygui://components/schema` - 返回 hml-schema.json
  - `honeygui://components/list` - 返回组件列表
  - `honeygui://templates/{template-name}` - 返回页面模板
  - `honeygui://tokens/design-system` - 返回设计 token（待实现）
  - `honeygui://constraints/rules` - 返回约束规则列表
- [ ] 定义 Prompts（生成指导）
  - `generate-ui` - 生成 UI 的系统提示词
    - 输入：需求描述、分辨率
    - 输出：生成 HML 的详细指导
  - `fix-validation-errors` - 修复校验错误的提示词
    - 输入：错误列表
    - 输出：修复步骤指导
  - `optimize-layout` - 优化布局的提示词
    - 输入：当前 HML
    - 输出：优化建议
- [ ] 定义 Tools（操作能力）
  - `validate-hml` - 校验 HML 结构
    - 输入：`{ hml: string }` (XML 字符串)
    - 输出：`ValidationResult`
  - `preview-ui` - 生成预览
    - 输入：`{ hml: string }`
    - 输出：`{ imageBase64: string, width: number, height: number }`
  - `get-screenshot` - 获取截图
    - 输入：`{ hml: string, componentId?: string }`
    - 输出：`{ imageBase64: string }`
  - `apply-patch` - 应用修改
    - 输入：`{ hml: string, patches: Patch[] }`
    - 输出：`{ hml: string }`
  - `export-code` - 导出 C 代码
    - 输入：`{ hml: string, projectRoot: string }`
    - 输出：`{ files: { path: string, content: string }[] }`
- [ ] 创建接口文档
  - 每个 Resource/Prompt/Tool 的详细说明
  - 输入输出格式
  - 使用示例

**交付物**：
- `ai/mcp/docs/api-reference.md` - MCP API 参考文档
- `ai/mcp/docs/resources.md` - Resources 详细说明
- `ai/mcp/docs/prompts.md` - Prompts 详细说明
- `ai/mcp/docs/tools.md` - Tools 详细说明

---

## 阶段 1：MCP Server 实现（2-3 周）

### 目标
实现完整的 MCP Server，暴露 Designer 能力。

### 任务清单

#### 1. 初始化 MCP Server 项目（1 天）

**优先级**：P0

**任务**：
- [ ] 创建项目目录
  - 位置：`ai/mcp/honeygui-mcp/`
- [ ] 初始化 npm 项目
  ```bash
  cd ai/mcp/honeygui-mcp
  npm init -y
  ```
- [ ] 安装依赖
  ```bash
  npm install @modelcontextprotocol/sdk
  npm install --save-dev typescript @types/node tsup
  ```
- [ ] 配置 TypeScript (`tsconfig.json`)
- [ ] 配置构建脚本 (`package.json`)
  - `"build": "tsup src/index.ts --format esm,cjs --dts"`
  - `"dev": "tsup src/index.ts --format esm,cjs --dts --watch"`
- [ ] 创建基础目录结构
  ```
  src/
  ├── index.ts          # 入口文件
  ├── server.ts         # MCP Server 主逻辑
  ├── resources/        # Resources 实现
  ├── prompts/          # Prompts 实现
  ├── tools/            # Tools 实现
  └── utils/            # 工具函数
  ```

**交付物**：
- `ai/mcp/honeygui-mcp/package.json`
- `ai/mcp/honeygui-mcp/tsconfig.json`
- `ai/mcp/honeygui-mcp/src/` 目录结构

---

#### 2. 实现 Resources（2-3 天）

**优先级**：P0

**任务**：
- [ ] 实现 Schema Resource
  - 文件：`src/resources/schema.ts`
  - 功能：读取 `hml-schema.json`，返回完整 schema
- [ ] 实现 Templates Resource
  - 文件：`src/resources/templates.ts`
  - 功能：读取 `assets/examples/*.hml`，返回模板列表或单个模板
- [ ] 实现 Components Resource
  - 文件：`src/resources/components.ts`
  - 功能：返回组件列表及简要说明
- [ ] 实现 Constraints Resource
  - 文件：`src/resources/constraints.ts`
  - 功能：返回约束规则列表（触摸目标、字体、嵌套等）
- [ ] 注册所有 Resources 到 MCP Server

**交付物**：
- `src/resources/*.ts`
- 每个 resource 的单元测试

---

#### 3. 实现 Prompts（1-2 天）

**优先级**：P1

**任务**：
- [ ] 实现 generate-ui Prompt
  - 文件：`src/prompts/generate-ui.ts`
  - 内容：从 `SKILL.md` 加载生成指导
  - 支持变量替换（分辨率、组件列表等）
- [ ] 实现 fix-validation-errors Prompt
  - 文件：`src/prompts/fix-errors.ts`
  - 内容：根据错误类型生成修复指导
- [ ] 实现 optimize-layout Prompt
  - 文件：`src/prompts/optimize-layout.ts`
  - 内容：布局优化建议
- [ ] 注册所有 Prompts 到 MCP Server

**交付物**：
- `src/prompts/*.ts`
- Prompts 模板文件

---

#### 4. 实现 Tools（5-7 天）

**优先级**：P0

**任务**：

##### Tool 1: validate-hml（2 天）
- [ ] 创建 `src/tools/validate.ts`
- [ ] 集成 HmlValidator
  - 解析 XML → JSON
  - 调用 Schema 验证
  - 调用自定义验证规则
  - 返回 ValidationResult
- [ ] 错误格式化
  - 将 ajv 错误转换为用户友好格式
  - 添加修复建议
- [ ] 单元测试

##### Tool 2: preview-ui（2-3 天）
- [ ] 创建 `src/tools/preview.ts`
- [ ] 集成 Designer 预览引擎
  - 方案 A：启动 Designer Webview（进程间通信）
  - 方案 B：实现 headless 渲染（puppeteer）
- [ ] 生成截图
  - 渲染 HML 到画布
  - 转换为 base64 图片
- [ ] 缓存优化

##### Tool 3: export-code（1-2 天）
- [ ] 创建 `src/tools/export.ts`
- [ ] 集成 HoneyCCodeGenerator
  - 调用现有代码生成器
  - 返回生成的文件列表
- [ ] 文件路径处理

##### Tool 4: apply-patch（可选，1 天）
- [ ] 创建 `src/tools/patch.ts`
- [ ] 实现 JSON Patch 应用
- [ ] XML 更新逻辑

##### Tool 5: get-screenshot（可选，与 preview-ui 合并）

**交付物**：
- `src/tools/*.ts`
- 每个 tool 的单元测试
- 集成测试

---

#### 5. MCP Server 主逻辑（1-2 天）

**优先级**：P0

**任务**：
- [ ] 实现 `src/server.ts`
  - 初始化 MCP Server
  - 注册 Resources
  - 注册 Prompts
  - 注册 Tools
  - 错误处理
  - 日志记录
- [ ] 实现 `src/index.ts`
  - 启动 MCP Server
  - 支持 stdio 传输
  - 支持 HTTP 传输（可选）
- [ ] 配置文件支持
  - 读取项目根目录
  - 读取分辨率配置

**交付物**：
- `src/server.ts`
- `src/index.ts`
- 启动脚本

---

## 阶段 2：集成测试（1-2 周）

### 目标
端到端测试 AI 驱动的 HML 生成流程。

### 任务清单

#### 1. Codex/Cursor 集成（3-5 天）

**优先级**：P0

**任务**：
- [ ] 安装 MCP Server
  ```bash
  cd ai/mcp/honeygui-mcp
  npm run build
  ```
- [ ] 配置 Codex/Cursor
  - 编辑 MCP 配置文件
  - 添加 honeygui-mcp server
  ```json
  {
    "mcpServers": {
      "honeygui": {
        "command": "node",
        "args": ["path/to/ai/mcp/honeygui-mcp/dist/index.js"]
      }
    }
  }
  ```
- [ ] 测试 Resources
  - AI 读取 schema
  - AI 读取 templates
  - AI 读取 components
- [ ] 测试 Prompts
  - AI 使用 generate-ui prompt
  - AI 使用 fix-errors prompt
- [ ] 测试 Tools
  - AI 调用 validate-hml
  - AI 调用 preview-ui
  - AI 调用 export-code

**交付物**：
- MCP 配置文件示例
- 集成测试报告

---

#### 2. 端到端测试用例（2-3 天）

**优先级**：P0

**任务**：
- [ ] 测试用例 1：简单按钮页面
  - 需求：创建一个只有一个按钮的页面
  - 流程：需求 → 生成 → 校验 → 预览 → 导出
  - 验证：HML 合法、预览正确、C 代码可编译
- [ ] 测试用例 2：设置页面
  - 需求：亮度和音量滑块
  - 流程：需求 → 生成（错误）→ 校验（捕获错误）→ 修复 → 预览 → 导出
  - 验证：AI 能根据错误报告自动修复
- [ ] 测试用例 3：复杂仪表盘
  - 需求：4 个状态卡片（步数、心率、卡路里、睡眠）
  - 流程：需求 → 生成 → 校验 → 预览 → 导出
  - 验证：布局合理、组件不重叠
- [ ] 测试用例 4：从模板修改
  - 需求：基于 music_player 模板修改标题
  - 流程：加载模板 → AI 修改 → 校验 → 预览
  - 验证：模板正确加载、修改准确
- [ ] 测试用例 5：错误修复循环
  - 需求：故意让 AI 生成错误 HML
  - 流程：生成（错误）→ 校验（多个错误）→ AI 修复 → 校验 → 通过
  - 验证：AI 能在 2-3 轮内修复所有错误

**交付物**：
- 测试用例文档
- 测试结果记录
- 问题列表和改进建议

---

#### 3. 性能与稳定性测试（1-2 天）

**优先级**：P1

**任务**：
- [ ] 压力测试
  - 连续生成 10 个页面
  - 验证内存泄漏
  - 验证响应时间
- [ ] 大文件测试
  - 生成包含 20+ 组件的页面
  - 验证校验速度
  - 验证预览生成速度
- [ ] 错误恢复测试
  - MCP Server 崩溃恢复
  - 网络中断处理
  - 超时处理

**交付物**：
- 性能测试报告
- 稳定性问题列表

---

## 阶段 3：增强功能（1 个月）

### 目标
提升生成质量和用户体验。

### 任务清单

#### 1. 设计 Token 系统（3-5 天）

**优先级**：P1

**任务**：
- [ ] 定义 Token 结构
  ```json
  {
    "colors": {
      "primary": "#00FF88",
      "secondary": "#6688FF",
      "background": "#000000",
      "text": "#FFFFFF"
    },
    "fonts": {
      "title": { "size": 24, "weight": "bold" },
      "body": { "size": 16, "weight": "regular" }
    },
    "spacing": {
      "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32
    },
    "sizes": {
      "button": { "min": 44, "recommended": 60 },
      "icon": 32
    }
  }
  ```
- [ ] 创建默认 Token 文件
  - `ai/skills/schema/design-tokens.json`
- [ ] 更新 Schema 支持 Token 引用
  - `"color": "@token/primary"`
- [ ] 实现 Token 解析器
  - 展开 Token 引用为实际值
- [ ] MCP Resource: `honeygui://tokens/design-system`

**交付物**：
- `design-tokens.json`
- Token 解析器
- 文档

---

#### 2. 模板库扩展（3-5 天）

**优先级**：P1

**任务**：
- [ ] 补充高频页面模板
  - 首页（时间 + 快捷按钮）
  - 配对页（蓝牙配对界面）
  - 设置页（亮度、音量、WiFi）
  - 音乐播放器（专辑、控制）
  - 通知中心（消息列表）
- [ ] 每个模板包含
  - HML 文件
  - 预览截图（PNG）
  - 说明文档（用途、适用场景）
- [ ] 更新 MCP Resource
  - 支持按类型筛选模板
  - 支持搜索模板
- [ ] 模板变量支持
  - 允许 AI 修改模板参数（如分辨率、颜色）

**交付物**：
- 5+ 个高质量模板
- 模板文档
- MCP Resource 更新

---

#### 3. 错误自动修复（5-7 天）

**优先级**：P2

**任务**：
- [ ] 实现 FixSuggestion 生成器
  - 根据错误类型生成修复建议
  - 支持自动修复简单错误
- [ ] 自动修复规则
  - ID 格式错误 → 自动添加前缀
  - 尺寸过小 → 自动调整为最小值
  - 颜色格式错误 → 自动转换为 hex
  - 缺少必需属性 → 自动添加默认值
- [ ] MCP Tool: `auto-fix-hml`
  - 输入：HML + ValidationResult
  - 输出：修复后的 HML + 修复日志
- [ ] 测试自动修复质量
  - 修复成功率
  - 修复是否引入新错误

**交付物**：
- 自动修复器
- `auto-fix-hml` tool
- 修复规则文档

---

#### 4. 中间结构层（可选，7-10 天）

**优先级**：P3

**任务**：
- [ ] 设计 UI Spec（JSON 格式）
  ```json
  {
    "type": "page",
    "resolution": "454x454",
    "components": [
      {
        "type": "button",
        "id": "confirm",
        "layout": { "x": 177, "y": 350, "w": 100, "h": 44 },
        "content": { "text": "Confirm" },
        "style": { "color": "@token/primary" }
      }
    ]
  }
  ```
- [ ] 实现 UI Spec → HML 编译器
  - 读取 UI Spec
  - 生成 HML XML
- [ ] 更新工作流
  - AI 生成 UI Spec（更简洁）
  - 编译为 HML
  - 校验 HML
- [ ] 优势评估
  - 是否比直接生成 HML 更稳定？
  - 是否更易于修改？

**交付物**：
- UI Spec Schema
- UI Spec → HML 编译器
- 对比报告

---

## 阶段 4：文档与发布（1 周）

### 目标
完善文档，准备发布。

### 任务清单

#### 1. 用户文档（2-3 天）

**优先级**：P0

**任务**：
- [ ] 快速开始指南
  - 安装 MCP Server
  - 配置 Codex/Cursor
  - 生成第一个 HML
- [ ] 使用教程
  - 从零开始生成页面
  - 使用模板
  - 处理校验错误
  - 导出代码
- [ ] 最佳实践
  - 如何描述需求
  - 如何选择组件
  - 如何调试生成结果
- [ ] 故障排查
  - 常见错误及解决方法
  - MCP Server 连接问题
  - 校验失败处理

**交付物**：
- `ai/mcp/docs/quick-start.md`
- `ai/mcp/docs/user-guide.md`
- `ai/mcp/docs/best-practices.md`
- `ai/mcp/docs/troubleshooting.md`

---

#### 2. 开发者文档（1-2 天）

**优先级**：P1

**任务**：
- [ ] 架构文档
  - 整体架构图
  - 组件交互流程
  - 数据流图
- [ ] API 参考
  - Resources 详细说明
  - Prompts 详细说明
  - Tools 详细说明
- [ ] 扩展指南
  - 如何添加新组件
  - 如何添加新约束
  - 如何扩展 Schema
- [ ] 贡献指南
  - 代码规范
  - 测试要求
  - PR 流程

**交付物**：
- `ai/mcp/docs/architecture.md`
- `ai/mcp/docs/api-reference.md`
- `ai/mcp/docs/extension-guide.md`
- `ai/mcp/docs/contributing.md`

---

#### 3. 发布准备（1-2 天）

**优先级**：P0

**任务**：
- [ ] 版本号管理
  - MCP Server: v1.0.0
  - Schema: v1.0.0
- [ ] 发布说明
  - CHANGELOG.md
  - 功能列表
  - 已知问题
- [ ] NPM 发布（可选）
  - 发布 MCP Server 到 NPM
  - 提供安装命令：`npm install -g @honeygui/mcp-server`
- [ ] 示例项目
  - 创建完整示例项目
  - 展示 AI 生成 → 编译 → 仿真流程

**交付物**：
- CHANGELOG.md
- 发布说明
- 示例项目

---

## 时间表

| 阶段 | 时长 | 关键里程碑 |
|---|---|---|
| **阶段 0** | 1-2 周 | Schema 完成 + MCP 接口设计完成 |
| **阶段 1** | 2-3 周 | MCP Server 实现完成 + 单元测试通过 |
| **阶段 2** | 1-2 周 | 集成测试完成 + 闭环跑通 |
| **阶段 3** | 1 个月 | Token 系统 + 模板库 + 自动修复 |
| **阶段 4** | 1 周 | 文档完善 + 发布准备 |
| **总计** | **2-3 个月** | 完整 AI 驱动系统上线 |

---

## 风险与应对

### 风险 1：MCP Server 性能问题
- **风险**：预览生成慢、校验慢
- **应对**：缓存机制、异步处理、headless 渲染优化

### 风险 2：AI 生成质量不稳定
- **风险**：AI 不遵守规则、生成错误多
- **应对**：强化 Skill 文档、细化 Prompt、多轮修复机制

### 风险 3：Schema 维护成本高
- **风险**：每次新增组件需要更新 Schema
- **应对**：自动生成 Schema、版本管理、向后兼容

### 风险 4：与 Designer 代码耦合
- **风险**：MCP Server 依赖 Designer 内部实现
- **应对**：清晰的接口层、最小化依赖、独立测试

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

- **整体规划**：`ai/README.md`
- **MCP 待办**：`ai/mcp/TODO.md`
- **Schema 说明**：`ai/skills/schema/README.md`
- **方向调整文档**：（需创建）

---

## 更新日志

### 2025-03-19
- ✅ 创建项目目录结构
- ✅ 生成简化版 HML JSON Schema (v0.1.0)
- ✅ 创建开发计划文档

---

## 下一步行动

### 本周（Week 1）
1. ✅ Schema 测试脚本
2. ✅ 扩展 Schema 到 10+ 组件
3. ⏳ 实现 HmlValidator（开始）

### 下周（Week 2）
4. ⏳ 完成 HmlValidator
5. ⏳ 设计 MCP 接口
6. ⏳ 初始化 MCP Server 项目

### 第三周（Week 3）
7. ⏳ 实现 Resources
8. ⏳ 实现 Tools（validate-hml）
9. ⏳ 开始集成测试

---

**计划维护者**：howie_wang
**最后更新**：2025-03-19
