# HoneyGUI Design Import Skill

**用途**：将 Figma/MasterGo 设计稿转换为 HoneyGUI 项目（HML + 资源 + 配置）

**场景**：用户已有设计原型稿，需要快速转换为嵌入式 GUI 项目

---

## 核心工作流

```
1. 用户提供设计稿
   ↓ (Figma URL 或导出的 JSON)
2. 调用 MCP tool: import-figma/import-mastergo
   ↓ 解析设计稿 → 识别组件 → 映射到 HoneyGUI
3. 返回：HML 文件 + 资源列表 + 警告信息
   ↓
4. 调用 MCP tool: download-assets
   ↓ 下载图片/图标资源
5. 调用 MCP tool: validate-hml
   ↓ 校验转换结果
6. 调用 MCP tool: preview-ui
   ↓ 预览界面
7. 根据警告信息，提示用户手动调整（如有）
   ↓
8. 调用 MCP tool: create-project
   ↓ 生成完整项目
```

---

## 关键概念

### 1. 设计工具数据结构

#### Figma 数据结构
```json
{
  "document": {
    "children": [
      {
        "type": "CANVAS",
        "name": "Page 1",
        "children": [
          {
            "type": "FRAME",
            "name": "MainScreen",
            "absoluteBoundingBox": { "x": 0, "y": 0, "width": 480, "height": 272 },
            "children": [
              {
                "type": "RECTANGLE",
                "name": "Button",
                "absoluteBoundingBox": { "x": 190, "y": 116, "width": 100, "height": 40 },
                "fills": [{ "type": "SOLID", "color": { "r": 0, "g": 1, "b": 0.53, "a": 1 }}]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### MasterGo 数据结构
类似 Figma，主要差异：
- 节点类型命名略有不同
- 样式属性可能使用不同字段名
- API 认证方式不同

---

### 2. 组件识别规则

AI 需要根据设计稿节点的**类型、名称、结构、样式**推断其对应的 HoneyGUI 组件。

**参考 `mappings/component-recognition.md` 获取完整规则。**

**示例识别逻辑**：

| 设计稿特征 | HoneyGUI 组件 | 识别规则 |
|-----------|--------------|---------|
| FRAME / GROUP | `hg_view` | 容器，包含子元素 |
| RECTANGLE + TEXT (同级或嵌套) | `hg_button` | 有点击事件或命名包含 "button", "btn" |
| TEXT (单独) | `hg_label` | 纯文本层，无交互 |
| RECTANGLE + fills.imageRef | `hg_image` | 图片填充 |
| IMAGE 节点 | `hg_image` | 外部图片 |
| COMPONENT INSTANCE | 查找最佳匹配 | 根据组件名推断 |
| RECTANGLE (细长, 命名含 "slider") | `hg_slider` | 滑块 |
| RECTANGLE (正方形, 命名含 "checkbox") | `hg_checkbox` | 复选框 |

---

### 3. 布局转换规则

#### 坐标系转换
- **Figma**: 使用屏幕绝对坐标 `absoluteBoundingBox: { x, y, width, height }`
- **HoneyGUI**: 使用相对父容器的坐标 `x, y, w, h`

**转换公式**：
```typescript
// 子组件相对父容器的坐标
child.x = child.absoluteBoundingBox.x - parent.absoluteBoundingBox.x
child.y = child.absoluteBoundingBox.y - parent.absoluteBoundingBox.y
child.w = child.absoluteBoundingBox.width
child.h = child.absoluteBoundingBox.height
```

#### Auto Layout 处理
- Figma 的 Auto Layout（自动布局）无法直接映射到 HoneyGUI
- **策略**：计算最终布局结果（absoluteBoundingBox），转换为手动坐标
- **警告**：通知用户该布局是固定的，不支持响应式

#### 嵌套容器处理
- 递归遍历节点树
- 每层容器独立转换为 `hg_view` 或 `hg_window`
- 子组件坐标相对于直接父容器

---

### 4. 样式转换规则

#### 颜色格式
- **Figma**: `{ r: 0, g: 1, b: 0.53, a: 1 }` (0-1 范围)
- **HoneyGUI**: `#00FF88` (十六进制)

**转换公式**：
```typescript
function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (val: number) => Math.round(val * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
```

#### 字体处理
- **Figma**: `fontName: { family: "Inter", style: "Bold" }, fontSize: 24`
- **HoneyGUI**: 需要用户提供字体文件路径（如 `assets/fonts/inter_bold.bin`）

**策略**：
- 记录所有使用的字体（去重）
- 生成警告：提示用户提供字体文件
- 在 HML 中使用占位符或默认字体

#### 不支持的样式
以下样式 HoneyGUI 可能不支持或部分支持：
- **阴影 (effects: DROP_SHADOW)** - 警告：HoneyGUI 不支持阴影
- **渐变填充 (fills: GRADIENT_*)** - 警告：仅支持纯色填充
- **混合模式 (blendMode)** - 警告：忽略混合模式
- **复杂边框 (strokes)** - 警告：仅支持简单边框

---

### 5. 资源处理流程

#### 图片资源
1. **识别**：提取所有 `fills.imageRef` 和 `IMAGE` 节点
2. **导出**：调用 Figma/MasterGo 图片导出 API（PNG/SVG）
3. **下载**：通过 MCP tool `download-assets` 批量下载
4. **转换**：用户需手动将 PNG 转换为 HoneyGUI 的 `.bin` 格式（使用插件提供的资源转换工具）
5. **引用**：在 HML 中引用 `assets/images/xxx.bin`

#### 图标资源
- 小尺寸图片（如 `width <= 64 && height <= 64`）识别为图标
- 保存到 `assets/icons/` 目录

#### 字体资源
- 记录所有使用的字体列表
- 生成警告：提示用户提供字体文件
- 建议用户使用插件的"字体转换工具"生成 `.bin` 文件

---

### 6. 警告和人工介入场景

转换过程中，AI 应生成清晰的警告信息，指导用户手动调整：

| 警告类型 | 触发条件 | 用户行动 |
|---------|---------|---------|
| 不支持的组件 | 无法映射的节点类型 | 手动替换为最接近的 HoneyGUI 组件 |
| Auto Layout | 使用了 Figma 自动布局 | 接受固定布局或手动调整 |
| 复杂效果 | 阴影、渐变、混合模式 | 简化设计或接受效果丢失 |
| 缺少字体 | 使用了非标准字体 | 提供字体文件或替换字体 |
| 资源格式 | 图片未转换为 .bin | 使用插件的资源转换工具 |
| 尺寸过小 | 按钮小于 44x44px | 调整尺寸以符合触摸目标 |
| 组件重叠 | 检测到重叠组件 | 调整布局避免重叠 |

**警告格式**（供 AI 生成）：
```json
{
  "type": "unsupported_style",
  "component": "Button",
  "property": "effects.DROP_SHADOW",
  "message": "HoneyGUI 不支持阴影效果，该效果将被忽略",
  "suggestion": "考虑移除阴影或使用边框替代"
}
```

---

## 使用示例

### 示例 1：简单 Figma 设计稿转换

**输入**（用户提供）：
```
Figma URL: https://www.figma.com/file/abc123/MyWatch?node-id=1:2
```

**AI 工作流**：
```
1. 调用 MCP tool: import-figma({ figmaUrl: "https://..." })
   ↓ 返回：
   {
     hmlFiles: [
       { path: "ui/main_screen.hml", content: "<hg_view>...</hg_view>" }
     ],
     assets: [
       { url: "https://figma-img.com/icon1.png", path: "assets/icons/icon1.png", type: "icon" },
       { url: "https://figma-img.com/bg.png", path: "assets/images/bg.png", type: "image" }
     ],
     warnings: [
       { type: "auto_layout", component: "MainScreen", message: "使用了 Auto Layout，布局已转换为固定坐标" }
     ]
   }

2. 调用 MCP tool: download-assets({ assets: [...] })
   ↓ 下载资源到本地

3. 调用 MCP tool: validate-hml({ hml: "<hg_view>...</hg_view>" })
   ↓ 校验 HML 合法性

4. 调用 MCP tool: preview-ui({ hml: "<hg_view>...</hg_view>" })
   ↓ 生成预览截图

5. 提示用户：
   "转换完成！发现 1 个警告：
    - MainScreen 使用了 Auto Layout，已转换为固定布局，不支持响应式。
   
   下一步：
   1. 使用插件的"资源转换工具"将 PNG 转换为 .bin 格式
   2. 确认预览效果是否符合预期
   3. 调用 create-project 生成完整项目"

6. 用户确认后，调用 MCP tool: create-project({
     name: "MyWatch",
     resolution: "480X272",
     hmlFiles: [...],
     assets: [...]
   })
   ↓ 生成项目目录
```

---

### 示例 2：复杂设计稿（有不支持组件）

**场景**：Figma 设计稿包含渐变背景、阴影按钮、自定义字体

**AI 输出**：
```
转换完成，但发现以下问题需要人工处理：

⚠️ 警告列表：
1. [不支持样式] Button - effects.DROP_SHADOW: HoneyGUI 不支持阴影效果
   → 建议：移除阴影或使用边框模拟
2. [不支持样式] Background - fills.GRADIENT_LINEAR: HoneyGUI 不支持渐变填充
   → 建议：替换为纯色或使用图片背景
3. [缺少字体] Title - fontFamily: "Poppins Bold": 需要提供字体文件
   → 建议：使用插件的"字体转换工具"转换 Poppins-Bold.ttf 为 .bin 格式

已生成 HML 文件（使用默认样式替代不支持的效果）。
预览图片：[base64 截图]

请手动调整设计稿或接受当前效果，然后调用 create-project 生成项目。
```

---

## MCP Tools 参考

### import-figma
**输入**：
```typescript
{
  figmaUrl?: string,        // Figma 文件 URL（需要 Access Token）
  figmaJson?: object,       // 或直接提供导出的 JSON
  accessToken?: string      // Figma Access Token（如提供 URL）
}
```

**输出**：
```typescript
{
  hmlFiles: Array<{ path: string, content: string }>,
  assets: Array<{ url: string, path: string, type: 'image'|'icon' }>,
  warnings: Array<{ type: string, component: string, message: string, suggestion?: string }>
}
```

### import-mastergo
同 `import-figma`，参数和输出格式一致

### download-assets
**输入**：
```typescript
{
  assets: Array<{ url: string, path: string }>
}
```

**输出**：
```typescript
{
  downloaded: number,
  failed: Array<{ url: string, error: string }>
}
```

### create-project
**输入**：
```typescript
{
  name: string,
  resolution: string,
  hmlFiles: Array<{ path: string, content: string }>,
  assets: Array<string>  // 资源文件路径列表
}
```

**输出**：
```typescript
{
  projectPath: string,
  files: Array<string>
}
```

---

## 相关文档

- **组件映射规则**：`mappings/figma-mapping.md`, `mappings/mastergo-mapping.md`
- **组件识别详细说明**：`mappings/component-recognition.md`
- **转换示例**：`examples/figma-to-hml.md`, `examples/mastergo-to-hml.md`
- **常见问题**：`troubleshooting.md`
- **HML Schema**：`../schema/hml-schema.json`

---

## 最佳实践

1. **简化设计稿**：转换前，建议用户移除复杂效果（阴影、渐变、动画）
2. **规范命名**：鼓励用户在 Figma 中使用语义化命名（如 "LoginButton", "TitleLabel"）
3. **分层清晰**：使用 Frame 明确界面层级，避免扁平化设计
4. **预览确认**：转换后务必调用 preview-ui 确认效果
5. **迭代优化**：首次转换可能不完美，使用 `optimize-layout` 和 `batch-edit` 工具调整
6. **资源准备**：提前准备好字体文件和资源转换工具

---

## 版本

- **Skill 版本**：v1.0.0
- **支持的设计工具**：Figma, MasterGo（实验性）
- **最后更新**：2025-03-31
