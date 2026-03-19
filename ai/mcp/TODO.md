# MCP Server 实现待办事项

## 核心目标
将 HoneyGUI Designer 的能力通过 MCP (Model Context Protocol) 暴露给 AI 编程工具（Codex, Cursor 等），实现 AI 驱动的嵌入式 UI 生成与收敛。

---

## P0：基础设施（立即启动）

### 1. JSON Schema 定义
- [ ] 基于 `components.md` 生成 HML JSON Schema
- [ ] 定义组件类型、必需属性、可选属性、值约束
- [ ] 包含所有组件的完整定义（基础、交互、容器、高级）
- [ ] 定义验证规则（触摸目标最小 44x44px、字体最小 16px 等）
- [ ] 输出位置：`ai/skills/schema/hml-schema.json`

### 2. HML 校验器
- [ ] 实现 `HmlValidator.ts`（可复用 Designer 现有代码）
- [ ] 输入：HML XML 字符串
- [ ] 输出：`ValidationResult { valid, errors[], warnings[], suggestions[] }`
- [ ] 校验类型：语法、结构、组件属性、设计约束
- [ ] 提供修复建议（fix hints）

### 3. MCP Server 接口设计
- [ ] 定义 Resources（规则数据）
  - `honeygui://components/schema` - 组件定义
  - `honeygui://tokens/design-system` - 设计 token
  - `honeygui://templates/[pattern-name]` - 页面模板
  - `honeygui://constraints/rules` - 约束规则
- [ ] 定义 Prompts（生成指导）
  - `generate-ui` - 生成 UI 的系统提示词
  - `fix-validation-errors` - 修复校验错误
  - `optimize-layout` - 优化布局
- [ ] 定义 Tools（操作能力）
  - `validate-hml` - 校验 HML 结构
  - `preview-ui` - 生成预览
  - `get-screenshot` - 获取截图
  - `apply-patch` - 应用修改
  - `export-code` - 导出 C 代码

---

## P1：MCP Server 实现（2 周内）

### 4. 技术栈选择
- [ ] 评估 FastMCP (Python) vs MCP SDK (TypeScript)
- [ ] 建议：TypeScript（与 Designer 代码库一致）
- [ ] 初始化项目：`ai/mcp/honeygui-mcp/`

### 5. 实现核心功能
- [ ] Resources 实现（读取 schema、templates）
- [ ] Prompts 实现（加载 SKILL.md 内容）
- [ ] Tools 实现
  - `validate-hml` - 调用 HmlValidator
  - `preview-ui` - 调用 Designer 预览引擎
  - `export-code` - 调用代码生成器

### 6. 集成 Designer 现有能力
- [ ] 复用 `HmlParser` 解析 HML
- [ ] 复用 `HoneyCCodeGenerator` 生成代码
- [ ] 复用 Webview 预览引擎（或实现 headless 预览）
- [ ] 复用 `AssetManager` 管理资源

---

## P2：闭环测试（1 个月内）

### 7. Codex/Cursor 集成测试
- [ ] 配置 MCP Server 到 Codex
- [ ] 测试完整流程：
  1. AI 读取 schema
  2. 生成 HML
  3. 调用 validate-hml
  4. 查看错误报告
  5. AI 修复错误
  6. 调用 preview-ui
  7. 确认预览
  8. 调用 export-code
- [ ] 记录问题和优化点

### 8. 错误修复流程优化
- [ ] 设计错误提示格式（AI 可消费）
- [ ] 提供自动修复建议
- [ ] 测试多轮修复收敛性

---

## P3：增强功能（中期）

### 9. 设计 Token 系统
- [ ] 定义颜色、字体、间距 token
- [ ] 支持主题切换（dark/light）
- [ ] AI 生成时优先使用 token

### 10. 模板库扩展
- [ ] 补充高频页面模板（首页、配对页、设置页）
- [ ] 每个模板包含 HML + 截图 + 说明
- [ ] 支持 AI 基于模板修改

### 11. 中间结构层（可选）
- [ ] 设计 JSON-based UI Spec（比 HML 更抽象）
- [ ] 实现 UI Spec → HML 编译器
- [ ] AI 先生成 UI Spec，再编译为 HML

---

## 技术债务与优化

- [ ] 单元测试覆盖（校验器、MCP tools）
- [ ] 性能优化（大文件校验、预览生成）
- [ ] 错误处理完善
- [ ] 日志和监控

---

## 文档输出

- [ ] MCP API 参考文档
- [ ] Codex/Cursor 集成指南
- [ ] 故障排查文档
- [ ] 最佳实践文档

---

## 当前优先级

**本周**：P0 第 1-3 项（Schema + 校验器 + 接口设计）
**下周**：P1 第 4-6 项（MCP Server 实现）
**第三周**：P2 第 7-8 项（闭环测试）

---

## 相关文档

- 方向调整文档：`/docs/方向调整共识文档（草案）.md`（待创建）
- Skill 定义：`ai/skills/honeygui-designer/SKILL.md`
- 组件参考：`ai/skills/honeygui-designer/references/components.md`
