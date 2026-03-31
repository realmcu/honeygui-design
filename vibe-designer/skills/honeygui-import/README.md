# HoneyGUI Import Skill - 使用说明

本 Skill 用于将 Figma/MasterGo 设计稿转换为 HoneyGUI 项目。

---

## 适用场景

- 已有 Figma/MasterGo 设计稿，需要快速转换为嵌入式 GUI 项目
- 设计师提供的设计稿需要导入到 HoneyGUI Designer
- 批量转换多个设计稿页面

---

## 使用流程

### 1. 准备设计稿

**Figma**：
- 方式 A：提供 Figma 文件 URL（需要 Access Token）
- 方式 B：在 Figma 中导出 JSON（File → Export → JSON）

**MasterGo**：
- 方式 A：提供 MasterGo 文件 URL
- 方式 B：导出 JSON

### 2. 调用 AI 助手（Codex/Cursor）

```
用户: "将这个 Figma 设计稿转换为 HoneyGUI 项目：https://www.figma.com/file/abc123"

AI: [读取 skills/honeygui-import/SKILL.md]
    ↓
    调用 MCP tool: import-figma
    ↓
    返回：HML 文件 + 资源列表 + 警告信息
    ↓
    调用 MCP tool: download-assets
    ↓
    调用 MCP tool: validate-hml
    ↓
    调用 MCP tool: preview-ui
    ↓
    提示用户查看警告和预览
```

### 3. 处理警告

AI 会列出所有警告信息，用户需要根据提示手动调整：

- **不支持的样式**：简化设计或接受效果丢失
- **缺少字体**：使用插件的"字体转换工具"转换字体文件
- **资源格式**：使用插件的"资源转换工具"转换图片为 `.bin` 格式

### 4. 生成项目

```
用户: "生成项目"

AI: 调用 MCP tool: create-project
    ↓
    生成完整项目结构（HML + assets/ + project.json）
```

---

## 支持的组件

| 设计稿元素 | HoneyGUI 组件 | 支持度 |
|-----------|--------------|-------|
| Frame / Group | hg_view | ✅ 完全支持 |
| Rectangle + Text | hg_button | ✅ 完全支持 |
| Text | hg_label | ✅ 完全支持 |
| Image | hg_image | ✅ 完全支持 |
| Component Instance | 查找最佳匹配 | ⚠️ 部分支持 |
| Auto Layout | 固定布局 | ⚠️ 转换为手动坐标 |
| 阴影 | 不支持 | ❌ 忽略 |
| 渐变 | 不支持 | ❌ 替换为纯色 |

---

## 已知限制

1. **Auto Layout**：Figma 的自动布局会转换为固定坐标，不支持响应式
2. **复杂效果**：阴影、渐变、混合模式等效果会丢失
3. **自定义组件**：需要用户手动调整映射规则
4. **字体**：需要用户提供字体文件并转换为 `.bin` 格式
5. **资源格式**：图片需手动转换为 HoneyGUI 支持的 `.bin` 格式

---

## 常见问题

**Q: 为什么转换后的布局和设计稿不一致？**
A: 可能是使用了 Auto Layout 或复杂约束，已转换为固定布局。建议在设计稿中使用绝对定位。

**Q: 如何处理缺少字体的警告？**
A: 使用 VSCode 插件的"资源转换工具"（Resource Conversion Tools），选择"字体转换"，将 TTF/OTF 转换为 `.bin` 格式。

**Q: 图片资源如何转换为 .bin 格式？**
A: 使用插件的"图片转换"工具，选择下载的 PNG/JPG 文件，自动转换为 `.bin` 格式。

**Q: 可以转换多页设计稿吗？**
A: 可以，AI 会为每个 Frame 生成独立的 HML 文件。

---

## 相关文档

- **核心 Skill**：`SKILL.md`
- **组件映射规则**：`mappings/figma-mapping.md`
- **转换示例**：`examples/figma-to-hml.md`
- **故障排查**：`troubleshooting.md`
