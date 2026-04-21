# Extension HTTP API 参考

HoneyGUI Designer Extension 通过 HTTP API 暴露核心功能，供 AI 工具调用。

## API 基础信息

- **服务器地址**：`http://localhost:38912`
- **Content-Type**：`application/json`
- **响应格式**：JSON

## 验证 Extension 是否运行

```bash
curl http://localhost:38912/health
```

**响应**：
```json
{
  "status": "ok",
  "service": "HoneyGUI Extension API",
  "port": 38912,
  "timestamp": "2026-04-21T..."
}
```

---

## 核心端点

### 1. GET /health

健康检查，验证服务是否运行。

**请求**：
```bash
curl http://localhost:38912/health
```

**响应**：
```json
{
  "status": "ok",
  "service": "HoneyGUI Extension API",
  "port": 38912,
  "timestamp": "2026-04-21T10:30:00.000Z"
}
```

---

### 2. GET /api/version

获取 Extension 版本信息。

**请求**：
```bash
curl http://localhost:38912/api/version
```

**响应**：
```json
{
  "success": true,
  "data": {
    "name": "HoneyGUI Visual Designer",
    "version": "1.6.65",
    "description": "Visual designer for embedded GUI development"
  }
}
```

---

### 3. POST /api/validate-hml

验证 HML XML 内容或文件的合法性。

#### 方法 1：验证 HML 内容字符串

**请求**：
```bash
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{
    "hmlContent": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<hml>\n  <meta>\n    <title>Test</title>\n  </meta>\n  <view>\n    <hg_view id=\"view_main\" entry=\"true\">\n      <hg_button id=\"btn1\" x=\"100\" y=\"200\" w=\"60\" h=\"50\" text=\"Click\" />\n    </hg_view>\n  </view>\n</hml>"
  }'
```

#### 方法 2：验证 HML 文件路径

**请求**：
```bash
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "ui/main.hml"
  }'
```

**响应（验证通过）**：
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [],
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

**响应（验证失败）**：
```json
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "type": "reference",
        "message": "Duplicate component ID: btn1",
        "componentId": "btn1"
      },
      {
        "type": "attribute",
        "message": "Resource path must start with '/', got: 'logo.bin'",
        "componentId": "img1",
        "attribute": "src"
      }
    ],
    "warnings": [],
    "validationRules": [...]
  }
}
```

#### 错误类型

| 类型 | 说明 |
|------|------|
| `syntax` | XML 语法错误 |
| `structure` | 文档结构错误（缺少 meta/view，嵌套规则等）|
| `attribute` | 属性格式错误（路径格式、尺寸等）|
| `reference` | 引用错误（ID 重复、ID 不存在等）|

#### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `hmlContent` | string | 二选一 | HML XML 内容字符串 |
| `filePath` | string | 二选一 | HML 文件路径（绝对路径或相对于工作区）|

---

### 4. POST /api/new-project

创建新的 HoneyGUI 项目。

**请求**：
```bash
curl -X POST http://localhost:38912/api/new-project
```

**响应**：
```json
{
  "success": true,
  "command": "honeygui.newProject",
  "data": {
    "message": "Project created successfully"
  }
}
```

---

### 5. POST /api/codegen

为当前项目生成 C 代码。

**请求**：
```bash
curl -X POST http://localhost:38912/api/codegen
```

**响应**：
```json
{
  "success": true,
  "command": "honeygui.codegen",
  "data": {
    "message": "Code generation completed",
    "files": [
      "src/main_ui.c",
      "src/main_ui.h",
      "src/main_callbacks.c"
    ]
  }
}
```

---

### 6. POST /api/simulation/run

运行 GUI 仿真。

**请求**：
```bash
curl -X POST http://localhost:38912/api/simulation/run
```

**响应**：
```json
{
  "success": true,
  "command": "honeygui.simulation",
  "data": {
    "message": "Simulation started"
  }
}
```

---

### 7. POST /api/simulation/stop

停止运行中的仿真。

**请求**：
```bash
curl -X POST http://localhost:38912/api/simulation/stop
```

**响应**：
```json
{
  "success": true,
  "command": "honeygui.simulation.stop",
  "data": {
    "message": "Simulation stopped"
  }
}
```

---

## 错误处理

### 通用错误格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `INVALID_PARAMETER` | 400 | 缺少必需参数或参数格式错误 |
| `FILE_NOT_FOUND` | 404 | 文件路径不存在 |
| `COMMAND_EXECUTION_ERROR` | 500 | VSCode 命令执行失败 |
| `VALIDATION_ERROR` | 500 | 验证服务内部错误 |

---

## 使用示例

### 完整工作流：生成并验证 HML

```bash
# 1. 检查服务是否运行
curl http://localhost:38912/health

# 2. 生成 HML 内容（由 AI 完成）
HML_CONTENT='<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta><title>My App</title></meta>
  <view>
    <hg_view id="view_main" entry="true" x="0" y="0" w="454" h="454">
      <hg_label id="lbl_title" x="100" y="50" width="254" height="40" 
                text="Hello World" fontFile="/NotoSansSC-Bold.ttf" />
    </hg_view>
  </view>
</hml>'

# 3. 验证 HML
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d "{\"hmlContent\":\"$HML_CONTENT\"}"

# 4. 如果验证通过，保存文件并生成代码
# （保存文件由 AI 使用 Write tool 完成）

# 5. 生成 C 代码
curl -X POST http://localhost:38912/api/codegen

# 6. 运行仿真
curl -X POST http://localhost:38912/api/simulation/run
```

---

## 注意事项

1. **Extension 必须运行**：所有 API 调用前应先检查 `/health` 端点
2. **工作区要求**：某些命令（如 codegen）需要打开 HoneyGUI 项目工作区
3. **验证优先**：生成 HML 后应始终调用 `/api/validate-hml` 验证
4. **文件路径**：`filePath` 参数支持相对路径（相对于 VSCode 工作区根目录）和绝对路径
5. **错误处理**：始终检查 `success` 字段，并处理错误情况

---

## 相关文档

- **HML 规范**：`docs/HML-Spec-zh.md`
- **验证规则**：参见 SKILL.md 的"关键约束"章节
- **组件文档**：`references/components.md`
