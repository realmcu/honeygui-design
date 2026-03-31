# MasterGo 组件映射规则

本文档定义 MasterGo 节点类型到 HoneyGUI 组件的映射规则。

**注意**：MasterGo 的数据结构与 Figma 高度相似，大部分规则可直接复用 Figma 映射规则。

---

## 与 Figma 的差异

| 特性 | Figma | MasterGo | 备注 |
|-----|-------|----------|------|
| 节点类型 | FRAME, RECTANGLE, TEXT, etc. | 基本相同 | MasterGo 可能有特有节点类型 |
| 坐标系统 | absoluteBoundingBox | 相同 | 坐标格式一致 |
| 填充方式 | fills, strokes | 相同 | 样式结构类似 |
| Auto Layout | layoutMode, layoutAlign | 类似但字段名可能不同 | 需测试确认 |
| 组件实例 | COMPONENT, INSTANCE | 可能名称不同 | 需调研 MasterGo API |

---

## 映射表（与 Figma 相同）

| MasterGo 节点类型 | 特征 | HoneyGUI 组件 | 优先级 |
|-----------------|------|--------------|--------|
| FRAME | 容器 | `hg_view` | P0 |
| GROUP | 分组 | `hg_view` | P0 |
| RECTANGLE + TEXT | 按钮 | `hg_button` | P0 |
| TEXT | 文本 | `hg_label` | P0 |
| RECTANGLE + 图片填充 | 图片 | `hg_image` | P0 |
| IMAGE | 图片 | `hg_image` | P0 |

---

## 特有节点类型（待调研）

以下节点类型可能是 MasterGo 特有的，需要实际测试后补充映射规则：

- 待补充...

---

## 转换示例

### 示例 1：按钮转换

**MasterGo JSON**：
```json
{
  "type": "RECTANGLE",
  "name": "ConfirmButton",
  "absoluteBoundingBox": { "x": 150, "y": 200, "width": 100, "height": 44 },
  "fills": [{ "type": "SOLID", "color": { "r": 0.2, "g": 0.6, "b": 1, "a": 1 }}],
  "children": [
    {
      "type": "TEXT",
      "characters": "确认"
    }
  ]
}
```

**HML 输出**：
```xml
<hg_button 
  id="ConfirmButton" 
  x="150" 
  y="200" 
  w="100" 
  h="44" 
  text="确认" 
  color="#3399FF"
/>
```

---

### 示例 2：容器转换

**MasterGo JSON**：
```json
{
  "type": "FRAME",
  "name": "CardContainer",
  "absoluteBoundingBox": { "x": 20, "y": 20, "width": 440, "height": 232 },
  "fills": [{ "type": "SOLID", "color": { "r": 0.1, "g": 0.1, "b": 0.1, "a": 1 }}],
  "children": [...]
}
```

**HML 输出**：
```xml
<hg_view 
  id="CardContainer" 
  x="20" 
  y="20" 
  w="440" 
  h="232" 
  bg-color="#1A1A1A"
>
  <!-- 子节点 -->
</hg_view>
```

---

## 已知限制（与 Figma 相同）

1. **Auto Layout**：自动布局转换为固定坐标
2. **复杂效果**：阴影、渐变、混合模式等不支持
3. **自定义组件**：需手动映射
4. **字体**：需提供字体文件

---

## 相关文档

- **Figma 映射规则**：`figma-mapping.md`（大部分规则相同）
- **组件识别规则**：`component-recognition.md`
- **核心 Skill**：`../SKILL.md`

---

## 待办事项

- [ ] 调研 MasterGo API 文档
- [ ] 测试 MasterGo 导出的 JSON 格式
- [ ] 补充 MasterGo 特有节点类型映射规则
- [ ] 验证坐标系统和样式格式的完全兼容性
