# HML JSON Schema 说明

## 概述

本目录包含 HoneyGUI HML (XML-based UI markup) 的 JSON Schema 定义，用于程序化验证 AI 生成的 HML 结构。

---

## 文件说明

### `hml-schema.json`（主 Schema）

**当前版本**：v0.1.0（简化版）

**包含组件**：
- ✅ `hg_button` - 按钮组件
- ✅ `hg_label` - 文本标签组件
- ✅ `hg_image` - 图片组件
- ✅ `hg_view` - 视图容器组件

**待扩展组件**（后续版本）：
- ⏳ `hg_slider`, `hg_switch`, `hg_progressbar`（交互组件）
- ⏳ `hg_input`, `hg_checkbox`, `hg_radio`（输入组件）
- ⏳ `hg_window`, `hg_container`（容器组件）
- ⏳ `hg_list`, `hg_grid`, `hg_canvas`（高级组件）

---

## 约束层级

### P0：必须满足（错误）

| 约束类型 | 说明 | 示例 |
|---|---|---|
| **必需属性** | id, name, x, y, w, h | `"required": ["id", "name", ...]` |
| **ID 格式** | 小写字母开头，字母+数字+下划线 | `"pattern": "^[a-z][a-z0-9_]*$"` |
| **ID 前缀** | 按组件类型强制前缀 | `btn_*`, `lbl_*`, `img_*`, `view_*` |
| **触摸目标尺寸** | 按钮 w, h ≥ 44px | `"minimum": 44` |
| **字体最小尺寸** | 标签 fontSize ≥ 16px | `"minimum": 16` |
| **颜色格式** | 十六进制 #RRGGBB 或 #AARRGGBB | `"pattern": "^#[0-9A-Fa-f]{6,8}$"` |
| **资源路径** | 图片/字体必须在 assets/ 目录 | `"pattern": "^assets/.*\\.bin$"` |
| **数值范围** | opacity (0-255), rotation (0-360) | `"minimum": 0, "maximum": 255` |

### P1：建议满足（警告）

| 约束类型 | 说明 | 实现方式 |
|---|---|---|
| **推荐尺寸** | 按钮推荐 ≥ 60px | 自定义验证函数 |
| **组件重叠** | 检测交叉区域 | 自定义验证函数 |
| **嵌套深度** | 容器嵌套 ≤ 4-5 层 | 自定义验证函数 |

---

## Schema 结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["hml"],
  "properties": {
    "hml": {
      "properties": {
        "meta": { "..." },          // 可选：项目元数据
        "views": [                   // 必需：至少一个 view
          { "$ref": "#/definitions/hg_view" }
        ]
      }
    }
  },
  "definitions": {
    "component_base": { "..." },     // 通用组件属性
    "hg_button": { "..." },          // 按钮定义
    "hg_label": { "..." },           // 标签定义
    "hg_image": { "..." },           // 图片定义
    "hg_view": { "..." }             // 视图定义
  }
}
```

---

## 使用方式

### 1. Node.js (ajv)

```bash
npm install ajv ajv-formats
```

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import hmlSchema from './ai/skills/schema/hml-schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(hmlSchema);

// 验证 HML 数据（JSON 格式）
const hmlData = {
  hml: {
    views: [
      {
        id: "view_main",
        name: "Main View",
        x: 0, y: 0, w: 454, h: 454,
        children: [
          {
            id: "btn_confirm",
            name: "Confirm Button",
            x: 177, y: 350, w: 100, h: 44,
            text: "Confirm"
          }
        ]
      }
    ]
  }
};

if (!validate(hmlData)) {
  console.log("验证失败：", validate.errors);
} else {
  console.log("验证通过！");
}
```

### 2. Python (jsonschema)

```bash
pip install jsonschema
```

```python
import json
from jsonschema import validate, ValidationError

with open('ai/skills/schema/hml-schema.json') as f:
    schema = json.load(f)

hml_data = {
    "hml": {
        "views": [{
            "id": "view_main",
            "name": "Main View",
            "x": 0, "y": 0, "w": 454, "h": 454,
            "children": []
        }]
    }
}

try:
    validate(instance=hml_data, schema=schema)
    print("验证通过！")
except ValidationError as e:
    print(f"验证失败：{e.message}")
```

---

## 验证示例

### ✅ 合法的 HML

```json
{
  "hml": {
    "meta": {
      "title": "Settings Screen",
      "project": {
        "resolution": "454x454",
        "pixelMode": "RGB565"
      }
    },
    "views": [
      {
        "id": "view_settings",
        "name": "Settings View",
        "x": 0, "y": 0, "w": 454, "h": 454,
        "children": [
          {
            "id": "btn_back",
            "name": "Back Button",
            "x": 20, "y": 20, "w": 60, "h": 60,
            "src": "assets/icon_back.bin"
          },
          {
            "id": "lbl_title",
            "name": "Title",
            "x": 127, "y": 30, "w": 200, "h": 40,
            "text": "Settings",
            "fontSize": 24,
            "color": "#FFFFFF"
          }
        ]
      }
    ]
  }
}
```

### ❌ 非法的 HML（会报错）

```json
{
  "hml": {
    "views": [
      {
        "id": "view_main",
        "name": "Main View",
        "x": 0, "y": 0, "w": 454, "h": 454,
        "children": [
          {
            "id": "btn_1",                  // ❌ 错误：ID 必须以 btn_ 开头
            "name": "Button",
            "x": 10, "y": 10,
            "w": 30, "h": 30,               // ❌ 错误：按钮尺寸 < 44px
            "text": "Click"
          },
          {
            "id": "lbl_text",
            "name": "Label",
            "x": 50, "y": 50, "w": 100, "h": 30,
            "text": "Hello",
            "fontSize": 12,                 // ❌ 错误：字体 < 16px
            "color": "white"                // ❌ 错误：颜色格式不是 hex
          }
        ]
      }
    ]
  }
}
```

**错误报告示例**：

```json
[
  {
    "instancePath": "/hml/views/0/children/0/id",
    "message": "must match pattern \"^btn_[a-z0-9_]+$\""
  },
  {
    "instancePath": "/hml/views/0/children/0/w",
    "message": "must be >= 44"
  },
  {
    "instancePath": "/hml/views/0/children/1/fontSize",
    "message": "must be >= 16"
  },
  {
    "instancePath": "/hml/views/0/children/1/color",
    "message": "must match pattern \"^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$\""
  }
]
```

---

## 与 Extension HTTP API 的关系

### JSON Schema 的作用

此 JSON Schema 主要用于 **AI 生成阶段的结构验证**：
- 验证 JSON 格式的组件数据结构
- 检查基础属性（id、尺寸、颜色格式等）
- 提供类型约束和格式校验

### Extension HTTP API 的作用

`/api/validate-hml` 端点用于 **最终的语义验证**：
- 验证 HML XML 字符串
- 检查跨节点约束（ID 唯一性、嵌套规则）
- 验证 HML-Spec 规范

### 使用流程

```bash
# 1. AI 生成 HML XML 后，调用 HTTP API 验证
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"hmlContent": "<?xml version=\"1.0\"?>..."}'

# 或使用文件路径
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"filePath": "ui/main.hml"}'
```

**响应示例**：
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

---

## 扩展指南

### 添加新组件

1. 在 `definitions` 中添加新组件定义：

```json
"hg_slider": {
  "allOf": [
    { "$ref": "#/definitions/component_base" },
    {
      "type": "object",
      "properties": {
        "id": {
          "pattern": "^slider_[a-z0-9_]+$"
        },
        "min": { "type": "number" },
        "max": { "type": "number" },
        "value": { "type": "number" },
        "orientation": {
          "enum": ["horizontal", "vertical"]
        }
      }
    }
  ]
}
```

2. 在容器的 `children.oneOf` 中添加引用：

```json
"children": {
  "type": "array",
  "items": {
    "oneOf": [
      { "$ref": "#/definitions/hg_button" },
      { "$ref": "#/definitions/hg_label" },
      { "$ref": "#/definitions/hg_image" },
      { "$ref": "#/definitions/hg_slider" },  // 新增
      { "$ref": "#/definitions/hg_view" }
    ]
  }
}
```

3. 更新版本号：`"version": "0.2.0"`

---

## 已知限制

### 当前版本无法验证

1. **ID 唯一性** - JSON Schema 无法跨节点验证，需要自定义函数
2. **组件重叠** - 需要计算坐标交集，需要自定义函数
3. **超出父容器** - 需要访问父节点数据，需要自定义函数
4. **资源文件存在性** - 需要文件系统访问，需要自定义函数
5. **颜色对比度** - 需要复杂计算，需要自定义函数

这些约束已在 Extension HTTP API 的 `HmlValidationService` 类中实现（见 `/api/validate-hml` 端点）。

---

## 参考资源

- **JSON Schema 官方文档**：https://json-schema.org/
- **ajv 验证库**：https://ajv.js.org/
- **HML 语法参考**：`../references/hml-syntax.md`
- **组件文档**：`../references/components.md`
- **设计原则**：`../references/design-principles.md`

---

## 版本历史

### v0.1.0 (2025-03-19)
- ✅ 初始版本（简化）
- ✅ 包含 4 个核心组件：hg_button, hg_label, hg_image, hg_view
- ✅ 实现 P0 级别约束（必需属性、尺寸、格式）

### 待开发
- ⏳ v0.2.0：添加交互组件（slider, switch, progressbar）
- ⏳ v0.3.0：添加输入组件（input, checkbox, radio）
- ⏳ v0.4.0：添加高级组件（list, grid, canvas）
- ⏳ v1.0.0：完整支持所有组件 + 自定义验证器
