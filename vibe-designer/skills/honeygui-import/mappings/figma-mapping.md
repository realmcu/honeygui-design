# Figma 组件映射规则

本文档定义 Figma 节点类型到 HoneyGUI 组件的映射规则。

---

## 映射表

| Figma 节点类型 | 特征 | HoneyGUI 组件 | 优先级 | 备注 |
|---------------|------|--------------|--------|------|
| **FRAME** | 容器，包含子节点 | `hg_view` | P0 | 最常见的容器 |
| **GROUP** | 分组，包含子节点 | `hg_view` | P0 | 与 FRAME 类似 |
| **RECTANGLE** + **TEXT** | 同级或嵌套，名称含 "button/btn" | `hg_button` | P0 | 按钮 |
| **TEXT** | 单独文本节点 | `hg_label` | P0 | 标签 |
| **RECTANGLE** + fills.imageRef | 图片填充 | `hg_image` | P0 | 图片背景 |
| **IMAGE** | 图片节点 | `hg_image` | P0 | 外部图片 |
| **RECTANGLE** | 细长，名称含 "slider" | `hg_slider` | P1 | 滑块 |
| **RECTANGLE** | 正方形，名称含 "checkbox" | `hg_checkbox` | P1 | 复选框 |
| **RECTANGLE** | 圆形，名称含 "radio" | `hg_radio` | P1 | 单选框 |
| **RECTANGLE** | 名称含 "progress" | `hg_progressbar` | P1 | 进度条 |
| **RECTANGLE** | 名称含 "switch" | `hg_switch` | P1 | 开关 |
| **COMPONENT** | 组件实例 | 根据名称推断 | P2 | 需智能匹配 |
| **INSTANCE** | 组件实例 | 根据名称推断 | P2 | 需智能匹配 |

---

## 详细规则

### 1. FRAME → hg_view

**条件**：
- 节点类型为 `FRAME`
- 包含子节点（children.length > 0）

**转换**：
```xml
<hg_view 
  id="frame_name" 
  x="{相对父容器的 x}" 
  y="{相对父容器的 y}" 
  w="{width}" 
  h="{height}"
>
  <!-- 递归转换子节点 -->
</hg_view>
```

**示例**：
```json
// Figma
{
  "type": "FRAME",
  "name": "MainScreen",
  "absoluteBoundingBox": { "x": 0, "y": 0, "width": 480, "height": 272 },
  "children": [...]
}

// HML
<hg_view id="MainScreen" x="0" y="0" w="480" h="272">
  ...
</hg_view>
```

---

### 2. RECTANGLE + TEXT → hg_button

**条件**（满足任一）：
- RECTANGLE 和 TEXT 是同级兄弟节点
- TEXT 是 RECTANGLE 的子节点
- 节点名称包含 "button", "btn", "Button", "Btn"（大小写不敏感）

**转换**：
```xml
<hg_button 
  id="button_name" 
  x="{x}" 
  y="{y}" 
  w="{w}" 
  h="{h}" 
  text="{TEXT.characters}" 
  color="{RECTANGLE.fills[0].color}"
/>
```

**示例**：
```json
// Figma
{
  "type": "RECTANGLE",
  "name": "LoginButton",
  "absoluteBoundingBox": { "x": 190, "y": 116, "width": 100, "height": 40 },
  "fills": [{ "type": "SOLID", "color": { "r": 0, "g": 1, "b": 0.53, "a": 1 }}],
  "children": [
    {
      "type": "TEXT",
      "characters": "Login"
    }
  ]
}

// HML
<hg_button id="LoginButton" x="190" y="116" w="100" h="40" text="Login" color="#00FF88"/>
```

---

### 3. TEXT → hg_label

**条件**：
- 节点类型为 `TEXT`
- **不是按钮的一部分**（父节点不是 RECTANGLE）

**转换**：
```xml
<hg_label 
  id="label_name" 
  x="{x}" 
  y="{y}" 
  w="{w}" 
  h="{h}" 
  text="{characters}" 
  color="{fills[0].color}" 
  font-size="{fontSize}"
/>
```

**示例**：
```json
// Figma
{
  "type": "TEXT",
  "name": "Title",
  "characters": "Hello World",
  "absoluteBoundingBox": { "x": 150, "y": 20, "width": 180, "height": 32 },
  "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 }}],
  "fontSize": 24
}

// HML
<hg_label id="Title" x="150" y="20" w="180" h="32" text="Hello World" color="#FFFFFF" font-size="24"/>
```

---

### 4. RECTANGLE + fills.imageRef → hg_image

**条件**：
- 节点类型为 `RECTANGLE` 或 `IMAGE`
- 存在 `fills[0].imageRef`（图片填充）

**转换**：
```xml
<hg_image 
  id="image_name" 
  x="{x}" 
  y="{y}" 
  w="{w}" 
  h="{h}" 
  src="assets/images/{imageRef}.bin"
/>
```

**示例**：
```json
// Figma
{
  "type": "RECTANGLE",
  "name": "Background",
  "absoluteBoundingBox": { "x": 0, "y": 0, "width": 480, "height": 272 },
  "fills": [{
    "type": "IMAGE",
    "imageRef": "1a2b3c4d5e6f"
  }]
}

// HML
<hg_image id="Background" x="0" y="0" w="480" h="272" src="assets/images/1a2b3c4d5e6f.bin"/>
```

---

### 5. RECTANGLE → hg_slider / hg_checkbox / hg_radio / hg_progressbar

**识别规则**：根据**名称**和**尺寸**推断

| 组件 | 名称关键词 | 尺寸特征 | HoneyGUI 组件 |
|------|----------|---------|--------------|
| 滑块 | slider, Slider, 滑块 | 宽高比 > 3:1 | `hg_slider` |
| 复选框 | checkbox, Checkbox, 复选 | 正方形，边长 < 50 | `hg_checkbox` |
| 单选框 | radio, Radio, 单选 | 圆形 | `hg_radio` |
| 进度条 | progress, Progress, 进度 | 宽高比 > 5:1 | `hg_progressbar` |
| 开关 | switch, Switch, 开关 | 宽高比 ≈ 2:1 | `hg_switch` |

**示例（滑块）**：
```json
// Figma
{
  "type": "RECTANGLE",
  "name": "VolumeSlider",
  "absoluteBoundingBox": { "x": 50, "y": 100, "width": 200, "height": 10 }
}

// HML
<hg_slider id="VolumeSlider" x="50" y="100" w="200" h="10" min="0" max="100" value="50"/>
```

---

### 6. COMPONENT / INSTANCE → 智能匹配

**条件**：
- 节点类型为 `COMPONENT` 或 `INSTANCE`
- 根据组件名称推断对应的 HoneyGUI 组件

**策略**：
1. 检查组件名称是否包含已知关键词（button, label, image, slider 等）
2. 如果无法识别，展开组件实例，递归转换其子节点
3. 如果仍无法映射，生成警告并使用 `hg_view` 作为容器

**示例**：
```json
// Figma
{
  "type": "INSTANCE",
  "name": "IconButton",
  "componentId": "123:456"
}

// 策略
1. 检测名称包含 "Button" → 映射为 hg_button
2. 或展开 componentId 定义，转换其子节点
```

---

## 不支持的节点类型

以下节点类型无法直接映射，会生成警告：

| Figma 节点 | 处理方式 | 警告信息 |
|-----------|---------|---------|
| VECTOR | 忽略或展开子节点 | "矢量图形不支持，请导出为图片" |
| BOOLEAN_OPERATION | 忽略 | "布尔运算不支持" |
| STAR | 忽略 | "星形不支持" |
| LINE | 忽略 | "线条不支持" |
| ELLIPSE | 忽略或识别为图标 | "椭圆可能需要导出为图片" |
| POLYGON | 忽略 | "多边形不支持" |

---

## 映射优先级

当多个规则匹配同一节点时，按以下优先级选择：

1. **精确名称匹配**（如 "LoginButton" → hg_button）
2. **结构特征**（如 RECTANGLE + TEXT → hg_button）
3. **尺寸特征**（如 宽高比 > 3:1 → hg_slider）
4. **默认规则**（如 FRAME → hg_view）

---

## 相关文档

- **MasterGo 映射规则**：`mastergo-mapping.md`
- **组件识别详细说明**：`component-recognition.md`
- **核心 Skill**：`../SKILL.md`
