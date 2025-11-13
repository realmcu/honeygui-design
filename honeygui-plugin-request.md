# HoneyGUI Visual Designer 设计需求文档（最终版 v1.0 草案）

## 文档元信息
- 产品名称：HoneyGUI Visual Designer（VS Code 插件）
- 市场 ID：honeygui.visual-designer
- 文档版本：v1.0-final-draft
- 文档所有者：王浩（howie_wang@realsil.com.cn）
- 最近更新：2025-11-12
- 适用读者：产品、前端（Webview/React）、扩展（TypeScript/VS Code API）、代码生成、仿真/Runner、测试、技术文档、运营
- 参考资料
  - HoneyGUI 官方文档：https://gitee.com/realmcu/HoneyGUI
  - VS Code 插件开发文档：https://code.visualstudio.com/api
- 技术栈与工具
  - TypeScript：VS Code 扩展核心
  - React：Webview UI（画布/控件树/属性面板）
  - Node.js：文件与工程操作、外部进程管理
  - Webpack：构建与资源打包（分离 Webview 资源）
  - 推荐版本：Node.js ≥ 18 LTS，TypeScript ≥ 5.x，React ≥ 18，Webpack ≥ 5
  - 目标平台：Windows、Linux、macOS（x64/arm64 以 VS Code 支持为准）

## 术语与关键原则
- HML（Honey Markup Language）：HoneyGUI 的界面描述文件格式，作为单一事实源（Single Source of Truth）。
- 单一事实源：设计器编辑、保存、预览、代码生成均以 .hml 为主源。
- 代码保护区：在生成的 C/C++ 文件中保留开发者自定义逻辑的标记区域，二次生成不覆盖。
- Workspace Trust：仅在受信任的工作区启用文件操作与外部进程。
- 遥测合规：遵循 VS Code 遥测开关，仅采集匿名行为事件，不采集源码/资源内容与绝对路径。

## 1. 产品概述
### 1.1 Elevator Pitch
- 在 VS Code 内提供“可视化界面设计 + HML 主源 + C/C++ 代码生成 + 实时预览与仿真”的一体化体验，显著提升 HoneyGUI 嵌入式 UI 的开发效率、一致性与可维护性。

### 1.2 背景与问题
- 现状：以 C/C++ API 手工开发为主，设计—开发—预览流程分散，效率低、出错率高。
- 短板：缺乏 VS Code 深度集成的可视化设计器、统一工程骨架、预览与资源管理能力。
- 解决：在 VS Code 中打通“创建—设计（HML）—生成—预览—资源管理”闭环。

### 1.3 目标用户
- 主要：HoneyGUI 嵌入式 UI 工程师、嵌入式应用开发人员。
- 次要：嵌入式设备 UI 设计师（布局/动效验证）、产品经理（原型验证/演示）。

### 1.4 目标与成功指标
- 产品目标
  - 将 HoneyGUI 界面开发效率提升 ≥ 50%。
  - 降低学习门槛，使非专业 UI 开发者快速上手。
  - 上线 3 个月累计安装量 ≥ 5000。
- 关键指标
  - 安装量、激活率（7 日激活/7 日新增 ≥ 65%）。
  - 核心功能采用率（设计/生成/预览）与 DAU/WAU/MAU。
  - 预览成功率 ≥ 98%，TTFP（首次预览达成时间）≤ 10 分钟。
  - 评分 ≥ 4.5/5，3 个月评论 ≥ 30 条。
  - 标准任务平均用时缩短 ≥ 50%（对照纯手工 C/C++）。
- 度量来源：Marketplace 数据 + 匿名遥测（遵循 VS Code 总开关）。

### 1.5 核心功能与范围
- 可视化界面编辑器（画布/控件树/属性面板/工具栏）。
- HML 主源的保存与校验、文件监听与合并。
- C/C++ 代码生成（保护区、差异合并、幂等）。
- 实时预览与仿真（Runner 下载与管理、热重载、日志与诊断）。
- 项目模板与快速创建（工程骨架、向导）。
- 资源管理（缩略、引用校验、导入/替换、未使用提示）。
- 文档与帮助（快速上手、打开官方文档）。
- XML → HML 迁移向导（一次性迁移）。

### 1.6 版本规划与范围边界
- V1.0（MVP）：创建—设计（HML）—生成（C/C++）—预览—资源管理闭环。
- V1.1：复杂控件/动效增强、字体子集化与资源打包、更多模板。
- 暂不包含：设备端远程部署与联调、复杂时间线动画编辑器、云端协作。

## 2. 用户旅程与用例
### 2.1 首次体验（TTFP）
- 安装插件 → 命令“新建 HoneyGUI 项目” → 选择模板 → 填写向导 → 生成骨架 → 打开设计器 → 一键预览（Runner 首次下载）。

### 2.2 日常开发
- 拖拽组件/调整布局/改属性 → 保存（序列化为 HML）→ 代码生成（C/C++）→ 预览（热重载）→ 资源导入/替换 → 迭代。

### 2.3 维护与调试
- 修改控件树与页面属性 → 预览回归 → 输出通道查看日志 → 错误定位与一键修复/重试。

### 2.4 核心用例清单
- 新建项目、打开设计器、组件拖拽与布局、属性编辑。
- 控件树管理（选中/高亮/锁定/隐藏/分组/重命名）。
- HML 保存与校验、外部变更监听与合并。
- C/C++ 生成与保护区保留、差异合并。
- 预览启动/停止/重启、热重载、日志查看。
- 资源浏览/引用校验/导入替换、缺失修复。
- XML → HML 迁移向导与只读兼容提示。
- 帮助与文档。

## 3. 功能需求规格
### 3.1 可视化界面编辑器
- 画布
  - 缩放：25%~800%，平移，显示安全边距。
  - 吸附：对齐线、栅格（可配置）、控件边缘吸附。
  - 多选、框选、组合/解组、层级调整。
- 控件树
  - 树形层级展示，拖拽调整层级，锁定/隐藏、重命名、定位到画布。
- 属性面板
  - 通用：id、位置（x/y）、尺寸（w/h）、可见性、启用状态、命名。
  - 样式：颜色、字体、圆角、边框、间距等（以 HoneyGUI 能力为准）。
  - 数据：文本、图片引用、资源键。
- 工具栏与快捷键
  - 撤销/重做（≥ 50 步）、对齐/分布、保存、预览、缩放。
  - 方向键微移 1px，Shift+方向键 10px，Ctrl+滚轮缩放。
- 校验与提示
  - id 唯一性、命名合法性；越界/重叠提示。
  - 资源引用存在性校验与一键修复建议。
  - 保存前执行结构校验，失败回滚并定位错误。
- 文件与同步（HML）
  - 主源：.hml；编辑器保存即写回 HML。
  - 监听外部 .hml 变更，提示刷新或尝试结构性合并。
  - 可选只读兼容：检测 .xml 且无 .hml 时只读打开并提示迁移。

### 3.2 HML 序列化与校验
- 解析：将 .hml 解析为内部 UI 模型（与画布状态一致）。
- 序列化：从模型稳定输出 .hml（稳定排序与缩进，避免无意义 diff）。
- 校验：结构/属性/引用合法性校验；错误定位到具体节点与属性。
- 注意：HML 语法与属性以 HoneyGUI 官方规范为准（本文件示例为示意）。

### 3.3 多语言代码生成（C/C++）
- 输入：HML 解析后的 UI 模型。
- 输出：C/C++ 控制器模板、初始化/绑定、事件回调占位。
- 策略
  - 幂等生成；稳定排序与一致格式化。
  - 差异合并：保留“代码保护区”，默认不覆盖。
  - 冲突处理：提供“预览差异/覆盖/取消”。
  - 可配置输出路径与命名规范。
- 性能：单页面生成 ≤ 500ms（普通），大型页面 ≤ 2s。
- 保护区标记示例（C++）
```cpp
// <honeygui-protect-begin:onClick>
void LoginButton_OnClick() {
  // TODO: 用户自定义逻辑
}
// <honeygui-protect-end:onClick>
```

### 3.4 实时预览与仿真（PC）
- 能力：预览当前页面/全应用；热重载优先；展示控制台日志、错误堆栈与资源警告。
- 运行与依赖
  - 首次使用引导下载 Runner（缓存、断点续传、代理/离线包）。
  - Node.js 子进程 spawn Runner，注入 HML 路径、资源路径与参数。
- 可靠性与回退
  - 启动超时默认 10s，自动重试 1 次；错误码与建议措施。
  - 预览成功率目标 ≥ 98%。
- 权限与安全：仅在可信工作区启动外部进程。
- 日志与诊断：VS Code 输出通道“HoneyGUI”，一键复制诊断信息。

### 3.5 项目模板与快速创建
- 模板（V1.0）：空项目、登录页、信息页、列表页（可扩展）。
- 向导字段
  - 项目名称、路径（必填）；屏幕分辨率（默认值可选）。
  - 主题/颜色深度（可选）；是否生成示例页面。
- 工程骨架
  - 目录：ui/*.hml、src/、assets/images/、.vscode/、README.md。
  - 生成 VS Code 任务：预览、代码生成、打开设计器。
- 完成后：提供“立即打开设计器”“立即预览”入口。

### 3.6 资源管理
- 浏览：png/jpg/jpeg 缩略图，按文件夹展示。
- 引用校验：扫描 HML/C/C++ 中的资源引用是否存在。
- 快速修复：缺失资源一键替换或重命名联动更新。
- 辅助：未使用资源提示；资源体积预警（阈值可配）。
- 操作：导入/替换、打开所在文件夹、复制相对路径。

### 3.7 文档与帮助
- 快速上手、常见问题、错误码与排障指南。
- 一键打开 HoneyGUI 官方文档。

### 3.8 迁移（XML → HML）
- 触发：检测到 ui/*.xml 且无对应 .hml 时提示迁移。
- 向导步骤：选择待迁移文件 → 预览差异 → 执行迁移 → 结果报告。
- 策略：尽力保持控件 id/层级/属性一致；迁移失败给出定位与手工指引。
- 目标：迁移成功率 ≥ 95%，单页面迁移中位耗时 ≤ 30 秒。
- 可选：迁移完成后将 .xml 置为备份（.bak.xml）或移至 backup/ 目录。

## 4. 非功能性需求
- 性能
  - 设计器首开 ≤ 2s（不含 Runner 首次下载）。
  - 预览冷启动 ≤ 10s、热重载 ≤ 2s。
- 稳定性与可靠性
  - 预览成功率 ≥ 98%；生成失败不破坏现有文件。
  - 设计器操作具备撤销/重做与异常回滚。
- 跨平台：Windows/Linux/macOS；路径分隔、权限与大小写敏感适配。
- 可用性：TTFP ≤ 10 分钟；清晰错误提示与可执行修复。
- 安全与隐私：Workspace Trust；最小权限原则；仅匿名遥测。
- 国际化：默认中文，支持 en-US 文案扩展。
- 可访问性：键盘完整可达；ARIA 标签；对比度达标。
- 可配置性：代理/离线包路径、输出目录、栅格大小、超时等。
- 可扩展性：模板扩展、控件库扩展、Runner 版本管理。

## 5. 技术方案与架构
### 5.1 架构分层
- Extension Core（TypeScript）
  - 激活/命令/贡献点、工作区权限检查、配置管理、文件监听、遥测、Runner 管理。
- Designer Webview（React）
  - 画布渲染、组件库、控件树、属性面板、拖拽与布局、状态管理（建议 Zustand/Context）。
- HML Service
  - 解析（.hml → UI 模型）、序列化（UI 模型 → .hml）、结构与属性校验。
- Codegen Service
  - 从 UI 模型生成 C/C++；保护区与差异合并；格式化与命名规范。
- Preview Runner
  - 下载/缓存、启动/停止/热重载、参数注入、日志/错误处理。
- Templates & Scaffolding
  - 模板清单、向导、字段校验、工程骨架生成。
- Resource Manager
  - 资源索引、缩略与引用校验、缺失/冲突提示与联动更新。

### 5.2 模块通信
- Extension ↔ Webview：VS Code postMessage 双向通信（JSON RPC 风格，含请求 id）。
- Extension ↔ Runner：Node.js 子进程（spawn）+ stdout/stderr 管道；必要时本地端口通信。
- 文件监听：chokidar/VS Code FS API 监听 ui/*.hml、assets/** 与生成目录。

### 5.3 目录结构（建议）
- 项目根
  - ui/（HML 页面）
  - src/（C/C++ 逻辑）
  - assets/images/（图片资源）
  - .vscode/（tasks.json、launch.json）
  - tools/（runner/脚本，可选）
  - README.md

### 5.4 VS Code 贡献点与命令
- 命令
  - HoneyGUI: New Project（honeygui.newProject）
  - HoneyGUI: Open Designer（honeygui.openDesigner）
  - HoneyGUI: Generate Code（honeygui.codegen）
  - HoneyGUI: Preview（honeygui.preview）
  - HoneyGUI: Open Resource Manager（honeygui.openResourceManager）
  - HoneyGUI: Open Docs（honeygui.openDocs）
  - HoneyGUI: Migrate XML to HML（honeygui.migrateXmlToHml）
- 激活事件
  - onCommand:honeygui.*
  - onWorkspaceContains:ui/*.hml（可选）
- 示例 package.json 片段
```json
{
  "contributes": {
    "commands": [
      { "command": "honeygui.newProject", "title": "HoneyGUI: New Project" },
      { "command": "honeygui.openDesigner", "title": "HoneyGUI: Open Designer" },
      { "command": "honeygui.codegen", "title": "HoneyGUI: Generate Code" },
      { "command": "honeygui.preview", "title": "HoneyGUI: Preview" },
      { "command": "honeygui.openResourceManager", "title": "HoneyGUI: Open Resource Manager" },
      { "command": "honeygui.openDocs", "title": "HoneyGUI: Open Docs" },
      { "command": "honeygui.migrateXmlToHml", "title": "HoneyGUI: Migrate XML to HML" }
    ],
    "activationEvents": [
      "onCommand:honeygui.newProject",
      "onCommand:honeygui.openDesigner",
      "onCommand:honeygui.codegen",
      "onCommand:honeygui.preview"
    ]
  }
}
```

### 5.5 运行流程（概要）
- 设计器：用户操作 → UI 状态更改 → 校验 → 序列化写回 .hml → 文件监听触发预览热重载。
- 代码生成：UI 模型 → 生成 C/C++ → 保护区差异合并 → 写盘 → 输出诊断。
- 预览：检查 Runner → 如缺失则下载 → spawn 进程 → 监听日志/错误 → 成功/失败回调与 UI 提示。

### 5.6 配置项与默认值（honeygui.*）
- honeygui.codegen.language：默认 "cpp"，可选 "c"。
- honeygui.codegen.outputDir：默认 "src/ui"。
- honeygui.hml.outputDir：默认 "ui"。
- honeygui.preview.runnerPath：默认自动管理。
- honeygui.preview.autoDownload：true。
- honeygui.preview.timeoutMs：10000。
- honeygui.ui.gridSize：8。
- honeygui.ui.snapToGrid：true。
- honeygui.telemetry.enabled：跟随 VS Code 全局。
- honeygui.templates.dir：内置模板，也可扩展路径。
- honeygui.network.proxy：可选代理地址。
- honeygui.offline.packagePath：离线 Runner 包路径。

## 6. 遥测与埋点设计
### 6.1 原则
- 跟随 VS Code 遥测总开关；仅匿名事件与计数。
- 不采集代码/资源内容与绝对路径；可关闭入口与文档披露。

### 6.2 事件字典（核心）
- lifecycle.activated：extension_version、os、vscode_version、locale。
- project.new.start / done / fail：template_id、duration_ms、error_code。
- designer.open / close：page_count、duration_ms。
- widget.add / remove / move / align：widget_type、count、delta。
- prop.update：widget_type、prop_name。
- hml.save：file_count、duration_ms。
- codegen.start / done / fail：lang、file_count、duration_ms、error_code。
- preview.start / ok / fail：mode（page/app）、duration_ms、error_code。
- resource.import / missing / fix：file_ext、size_kb、action。
- migrate.xml2hml.start / done / fail：file_count、duration_ms、error_code。
- error.unhandled：error_code、stack_hash。

### 6.3 示例事件
```json
{
  "event": "preview.fail",
  "properties": {
    "mode": "app",
    "error_code": "E1021_INVALID_HML",
    "extension_version": "1.0.0",
    "os": "win32",
    "vscode_version": "1.94.0",
    "locale": "zh-CN"
  },
  "measurements": { "duration_ms": 7421 }
}
```

### 6.4 指标计算
- 激活率 = 7 日激活用户数 / 7 日新增安装数。
- 预览成功率 = 预览成功次数 / 预览启动次数。
- 功能采用率 = 使用某功能的 WAU / 总 WAU。
- 效率提升 =（基线用时 − 观察用时）/ 基线用时。

## 7. 错误处理与诊断
### 7.1 错误码（示例）
- E1001_RUNNER_NOT_FOUND：未安装 Runner（提供下载/离线包）。
- E1002_RUNNER_TIMEOUT：Runner 启动超时（建议延长超时或查看日志）。
- E1011_PORT_IN_USE：端口占用（自动切换并重试）。
- E1021_INVALID_HML：HML 无效（定位错误节点并给出修复建议）。
- E1031_RESOURCE_MISSING：资源缺失（定位引用并提供替换）。
- E2001_CODEGEN_CONFLICT：生成冲突（差异预览与覆盖确认）。
- E3001_FS_PERMISSION：文件权限不足（指引授权或切换目录）。

### 7.2 提示与引导
- 错误提示包含：原因、影响、可执行操作（重试/修复/查看文档/导出诊断）。
- 输出通道与问题面板联动定位；一键复制诊断摘要。

## 8. 交互与体验规范
- 布局：左侧组件库/控件树切换 + 中部画布 + 右侧属性面板 + 顶部工具栏。
- 主题：跟随 VS Code 主题，图标与对比度适配。
- 快捷键：Ctrl+S 保存、Ctrl+Z/Y 撤销重做、Delete 删除、Ctrl+C/V 复制粘贴、方向键移动、Shift+方向键快速移动、Ctrl+滚轮缩放。
- 空态：新建后显示 3 步引导卡片（打开设计器/拖拽组件/一键预览）。
- 右键菜单：常用操作（对齐、分布、分组、重命名、定位到资源）。

## 9. 测试与验收标准
### 9.1 功能验收
- 新建项目：字段校验、骨架生成、.vscode 任务正常。
- 设计器：拖拽、对齐/分布、属性编辑、撤销重做、id 唯一校验。
- HML：保存/解析/校验通过；外部变更监听与刷新。
- 代码生成：C/C++ 正确生成；保护区不被覆盖；二次生成无无意义 diff。
- 预览：Runner 下载可用；启动/停止/热重载稳定；日志输出完整；失败可重试。
- 资源管理：缩略、缺失高亮、替换联动更新、未使用资源提示。
- 迁移：XML → HML 成功率 ≥ 95%（示例/回归用例覆盖）。

### 9.2 性能与稳定
- 设计器打开 ≤ 2s；预览冷启动 ≤ 10s、热重载 ≤ 2s。
- 预览成功率 ≥ 98%；异常回滚不损坏文件。

### 9.3 兼容性
- Windows/Linux/macOS；路径/编码/权限差异覆盖测试。
- 多工作区/多根目录兼容。

### 9.4 可用性与效率
- 新手任务“登录页 + 图片 + 按钮事件 + 预览”TTFP ≤ 10 分钟。
- 标准任务平均用时缩短 ≥ 50%（对照组：纯手工 C/C++）。

### 9.5 遥测与合规
- 关闭 VS Code 遥测时不发送事件；事件不含源码/资源内容与绝对路径。

## 10. 上线与发布计划
### 10.1 里程碑
- M0（V1.0 发布）：创建—设计（HML）—生成—预览—资源管理闭环。
- M+1 月：安装量 ≥ 1500；激活率 ≥ 60%；编辑器采用率 ≥ 70%。
- M+3 月：累计安装量 ≥ 5000；激活率 ≥ 65%；评分 ≥ 4.5；效率提升 ≥ 50%。

### 10.2 交付物
- VSIX 包与 Marketplace 清单（截图、最小 VS Code 引擎要求、隐私说明）。
- 快速上手、FAQ、错误码与排障指南。
- 示例项目与模板包。

### 10.3 发布与回退
- 渐进发布（逐步扩大可见范围）。
- 新版本兼容旧项目；严重问题可回退上一稳定版本。

## 11. 风险、依赖与缓解
- Runner 体积与下载失败
  - 缓解：首次下载与缓存、断点续传、代理/离线包、重试与镜像源。
- 企业网络限制
  - 缓解：可配置代理、离线安装包、文档指引。
- 跨平台差异
  - 缓解：路径与权限抽象、CI 多平台打包与测试。
- HML 规范变更或不明确
  - 缓解：与 HoneyGUI 文档同步版本；内置 Schema 校验与快速升级。
- 生成冲突与代码丢失风险
  - 缓解：保护区 + 差异预览 + 默认不覆盖。
- 学习曲线与留存
  - 缓解：模板质量、首次引导、错误可用性、示例项目。

## 12. 开放问题（待确认）
- HML 的控件集合、属性与约束清单（需与 HoneyGUI 官方规范对齐）。
- C/C++ 模板风格、命名与文件组织约定。
- Runner 分发形态、版本策略与许可证要求。
- 向导默认分辨率/主题与取值范围。
- V1.1 的复杂控件与动效优先级、资源打包/字体子集化策略。
- 企业代理与离线包的默认配置与交付路径。

## 附录 A：示例 VS Code 任务
```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "HoneyGUI: Generate Code", "type": "shell", "command": "honeygui.codegen" },
    { "label": "HoneyGUI: Preview", "type": "shell", "command": "honeygui.preview" }
  ]
}
```

## 附录 B：HML 示例（示意，语法以官方为准）
```xml
<!-- file: ui/login.hml -->
<hml page id="Login" width="360" height="640">
  <container id="root" layout="column" padding="16">
    <image id="logo" src="assets/images/logo.png" width="120" height="120" align="center"/>
    <text id="title" value="欢迎使用 HoneyGUI" fontSize="20" marginTop="16" align="center"/>
    <input id="username" placeholder="用户名" marginTop="24"/>
    <input id="password" placeholder="密码" type="password" marginTop="12"/>
    <button id="loginBtn" text="登录" marginTop="24" onClick="LoginButton_OnClick"/>
  </container>
</hml>
```

## 附录 C：Runner CLI 调用（示意，以实际 Runner 为准）
```bash
runner.exe --entry ui/login.hml --assets assets/images --watch --log-level info
```

## 附录 D：遥测上报示例（hml.save）
```json
{
  "event": "hml.save",
  "properties": {
    "extension_version": "1.0.0",
    "os": "darwin",
    "vscode_version": "1.94.0",
    "locale": "zh-CN"
  },
  "measurements": { "file_count": 1, "duration_ms": 132 }
}
```

## 附录 E：迁移向导核心流程（伪代码）
```typescript
async function migrateXmlToHml(files: string[]) {
  track('migrate.xml2hml.start', { file_count: files.length });
  const results = [];
  for (const xml of files) {
    try {
      const model = parseXmlToUiModel(await fs.readFile(xml, 'utf8'));
      const hml = serializeUiModelToHml(model);
      const target = xml.replace(/\.xml$/i, '.hml');
      await fs.writeFile(target, hml, 'utf8');
      results.push({ xml, hml: target, ok: true });
    } catch (e) {
      results.push({ xml, ok: false, error: e });
      track('migrate.xml2hml.fail', { error_code: classify(e) });
    }
  }
  track('migrate.xml2hml.done', { success_count: results.filter(r => r.ok).length });
  return results;
}
```

## 附录 F：保护区与差异合并策略（C++）
```cpp
// <honeygui-protect-begin:handler>
// 用户代码区：生成器不会覆盖此区域内容。
// <honeygui-protect-end:handler>
```

## 结语与下一步
- 冻结本 V1.0 设计作为开发与测试基线，优先确认：
  - HML 语法与属性约束清单。
  - C/C++ 模板命名与组织。
  - Runner 分发与许可证策略。
- 确认后输出：详细控件属性表与校验规则、完整错误码字典与提示文案、埋点参数枚举与校验器，实现可执行验收条目与自动化测试脚本。