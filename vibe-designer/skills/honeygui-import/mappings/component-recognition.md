# 组件识别规则

本文档详细说明如何根据设计稿节点的特征识别其对应的 HoneyGUI 组件。

---

## 识别流程

```
1. 读取节点类型 (type: FRAME, RECTANGLE, TEXT, etc.)
   ↓
2. 检查节点名称（是否包含关键词）
   ↓
3. 分析节点结构（子节点、父节点关系）
   ↓
4. 计算节点尺寸（宽高比、绝对尺寸）
   ↓
5. 检查节点样式（填充、边框、效果）
   ↓
6. 应用映射规则，输出 HoneyGUI 组件类型
```

---

## 关键词匹配规则

### 按钮 (hg_button)
**关键词**（不区分大小写）：
- `button`, `btn`
- `login`, `signup`, `submit`, `confirm`, `cancel`
- `ok`, `yes`, `no`

**匹配逻辑**：
```typescript
function isButton(name: string): boolean {
  const keywords = /button|btn|login|signup|submit|confirm|cancel|ok|yes|no/i;
  return keywords.test(name);
}
```

---

### 标签 (hg_label)
**关键词**：
- `label`, `text`, `title`, `caption`, `description`

**排除条件**：
- 如果是按钮的一部分（父节点是 RECTANGLE），则不是独立标签

---

### 图片 (hg_image)
**关键词**：
- `image`, `img`, `picture`, `photo`, `icon`, `logo`, `avatar`

**自动识别**：
- 节点有图片填充（fills.imageRef）
- 节点类型为 IMAGE

---

### 滑块 (hg_slider)
**关键词**：
- `slider`, `滑块`, `音量`, `volume`, `亮度`, `brightness`

**尺寸特征**：
- 宽高比 > 3:1（横向滑块）
- 或高宽比 > 3:1（纵向滑块）

---

### 复选框 (hg_checkbox)
**关键词**：
- `checkbox`, `check`, `复选`

**尺寸特征**：
- 正方形（宽高比接近 1:1）
- 边长 < 50px

---

### 单选框 (hg_radio)
**关键词**：
- `radio`, `单选`

**尺寸特征**：
- 圆形（通过 cornerRadius === width/2 判断）
- 直径 < 50px

---

### 进度条 (hg_progressbar)
**关键词**：
- `progress`, `progressbar`, `进度`, `加载`, `loading`

**尺寸特征**：
- 宽高比 > 5:1

---

### 开关 (hg_switch)
**关键词**：
- `switch`, `toggle`, `开关`

**尺寸特征**：
- 宽高比 ≈ 2:1
- 宽度 40-80px，高度 20-40px

---

## 结构特征识别

### 按钮识别（RECTANGLE + TEXT）

**规则**：
1. 父节点是 RECTANGLE
2. 子节点包含 TEXT
3. 或者 RECTANGLE 和 TEXT 是同级兄弟节点，且位置重叠

**示例结构**：
```json
// 方式 1: TEXT 是 RECTANGLE 的子节点
{
  "type": "RECTANGLE",
  "children": [
    { "type": "TEXT", "characters": "Login" }
  ]
}

// 方式 2: TEXT 和 RECTANGLE 是兄弟节点
[
  { "type": "RECTANGLE", "name": "BtnBg", "x": 100, "y": 100, "w": 80, "h": 40 },
  { "type": "TEXT", "name": "BtnText", "x": 110, "y": 110, "w": 60, "h": 20, "characters": "Login" }
]
```

**识别逻辑**：
```typescript
function isButtonStructure(rectangle: Node, siblings: Node[]): boolean {
  // 检查子节点
  if (rectangle.children?.some(child => child.type === 'TEXT')) {
    return true;
  }
  
  // 检查兄弟节点
  const overlappingText = siblings.find(node => 
    node.type === 'TEXT' && isOverlapping(rectangle, node)
  );
  return !!overlappingText;
}
```

---

### 图标识别

**规则**：
- 图片尺寸 ≤ 64x64px
- 节点名称包含 "icon"
- 或者在按钮内部（作为按钮图标）

**示例**：
```json
{
  "type": "IMAGE",
  "name": "PlayIcon",
  "absoluteBoundingBox": { "width": 32, "height": 32 }
}
```

**识别逻辑**：
```typescript
function isIcon(node: Node): boolean {
  const { width, height } = node.absoluteBoundingBox;
  return (width <= 64 && height <= 64) || /icon/i.test(node.name);
}
```

---

## 尺寸特征识别

### 计算宽高比

```typescript
function getAspectRatio(node: Node): number {
  const { width, height } = node.absoluteBoundingBox;
  return width / height;
}
```

### 判断正方形

```typescript
function isSquare(node: Node): boolean {
  const ratio = getAspectRatio(node);
  return ratio > 0.9 && ratio < 1.1; // 允许 10% 误差
}
```

### 判断圆形

```typescript
function isCircle(node: Node): boolean {
  if (!isSquare(node)) return false;
  
  // Figma: cornerRadius === width / 2
  const { width } = node.absoluteBoundingBox;
  return node.cornerRadius === width / 2;
}
```

---

## 样式特征识别

### 纯色填充

```typescript
function hasSolidFill(node: Node): boolean {
  return node.fills?.some(fill => fill.type === 'SOLID');
}
```

### 图片填充

```typescript
function hasImageFill(node: Node): boolean {
  return node.fills?.some(fill => fill.type === 'IMAGE' && fill.imageRef);
}
```

### 无填充（边框按钮）

```typescript
function isOutlineButton(node: Node): boolean {
  return !node.fills?.length && node.strokes?.length > 0;
}
```

---

## 智能推断规则

当无法通过上述规则精确匹配时，使用智能推断：

### 推断逻辑优先级

1. **关键词 > 结构 > 尺寸 > 样式**
2. 多个规则冲突时，选择更具体的规则
3. 无法推断时，生成警告并使用默认组件（hg_view）

### 推断示例

**输入**：
```json
{
  "type": "RECTANGLE",
  "name": "VolumeControl",
  "absoluteBoundingBox": { "width": 200, "height": 10 }
}
```

**推断过程**：
1. 关键词检查：`VolumeControl` 包含 "volume" → 可能是滑块
2. 尺寸检查：宽高比 = 200/10 = 20:1 → 符合滑块特征
3. **结论**：识别为 `hg_slider`

---

## 特殊情况处理

### 1. 组件实例（COMPONENT / INSTANCE）

**策略**：
1. 检查组件名称（componentName）
2. 如果名称匹配已知组件，直接映射
3. 否则，展开组件定义（通过 componentId 查找），递归识别子节点

**示例**：
```json
{
  "type": "INSTANCE",
  "name": "PrimaryButton",
  "componentId": "123:456"
}
```

**处理**：
- 名称包含 "Button" → 映射为 `hg_button`
- 或查找 componentId 的定义，分析其结构

---

### 2. 嵌套容器

**规则**：
- 如果 FRAME/GROUP 只有一个子节点，考虑"解包"（去掉外层容器）
- 但如果容器有背景色或边框，保留容器

**示例**：
```json
// 可解包
{
  "type": "FRAME",
  "name": "Wrapper",
  "children": [
    { "type": "TEXT", "characters": "Title" }
  ]
}
// → 直接使用 hg_label，去掉 Wrapper

// 不可解包
{
  "type": "FRAME",
  "name": "Card",
  "fills": [{ "type": "SOLID", "color": {...} }],
  "children": [...]
}
// → 保留为 hg_view（有背景色）
```

---

### 3. 文本 + 图标按钮

**识别**：
- RECTANGLE 包含 TEXT 和 IMAGE 子节点
- IMAGE 尺寸小（< 64px）

**映射**：
- 映射为 `hg_button`
- IMAGE 作为按钮图标（如果 HoneyGUI 支持）

---

## 错误兜底

如果所有规则都无法匹配：

1. **默认容器**：FRAME/GROUP → `hg_view`
2. **默认组件**：RECTANGLE/其他 → 生成警告，使用 `hg_view` 包裹
3. **警告信息**：
   ```json
   {
     "type": "unknown_component",
     "node": "UnknownNode",
     "message": "无法识别节点类型，已映射为容器（hg_view）",
     "suggestion": "请手动调整或提供更明确的命名"
   }
   ```

---

## 测试用例

### 测试用例 1：按钮识别
```json
// 输入
{
  "type": "RECTANGLE",
  "name": "LoginBtn",
  "absoluteBoundingBox": { "x": 100, "y": 100, "width": 80, "height": 40 },
  "children": [
    { "type": "TEXT", "characters": "Login" }
  ]
}

// 期望输出
{
  "component": "hg_button",
  "reason": "名称包含 'Btn'，且包含 TEXT 子节点"
}
```

### 测试用例 2：滑块识别
```json
// 输入
{
  "type": "RECTANGLE",
  "name": "Slider1",
  "absoluteBoundingBox": { "x": 50, "y": 100, "width": 200, "height": 10 }
}

// 期望输出
{
  "component": "hg_slider",
  "reason": "名称包含 'Slider'，且宽高比 = 20:1"
}
```

### 测试用例 3：图标识别
```json
// 输入
{
  "type": "IMAGE",
  "name": "PlayIcon",
  "absoluteBoundingBox": { "width": 32, "height": 32 }
}

// 期望输出
{
  "component": "hg_image",
  "type": "icon",
  "reason": "尺寸 ≤ 64x64 且名称包含 'Icon'"
}
```

---

## 相关文档

- **Figma 映射表**：`figma-mapping.md`
- **MasterGo 映射表**：`mastergo-mapping.md`
- **核心 Skill**：`../SKILL.md`
