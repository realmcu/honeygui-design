# project.json 配置示例

## 基本项目配置

```json
{
  "name": "MyApp",
  "appId": "com.example.MyApp",
  "version": "1.0.0",
  "resolution": "480X272",
  "minSdk": "API 2: Persim Wear V1.1.0",
  "pixelMode": "ARGB8888",
  "mainHmlFile": "ui/main.hml",
  "created": "2025-11-17T07:14:16.090Z"
}
```

## 完整配置（包含设计器配置）

```json
{
  "name": "MyApp",
  "appId": "com.example.MyApp",
  "version": "1.0.0",
  "resolution": "480X272",
  "minSdk": "API 2: Persim Wear V1.1.0",
  "pixelMode": "ARGB8888",
  "mainHmlFile": "ui/main.hml",
  "created": "2025-11-17T07:14:16.090Z",
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
```

## 配置字段说明

### 基本字段

- **name**: 项目名称（字符串）
- **appId**: 应用包名，唯一标识（字符串）
- **version**: 版本号（字符串）
- **resolution**: 屏幕分辨率，格式 "宽度X高度"（字符串）
  - 示例: "480X272", "800X480", "1024X600"
- **minSdk**: 最低SDK版本（字符串）
- **pixelMode**: 像素模式（字符串）
  - 可选: "ARGB8888", "RGB565", "RGB888"
- **mainHmlFile**: 主HML文件路径（字符串）
- **created**: 创建时间（ISO 8601格式字符串）

### 设计器配置 (designer)

- **canvasBackgroundColor**: 设计器画布背景色（字符串）
  - 格式: 十六进制颜色值
  - 示例: "#f0f0f0", "#e3f2fd", "#2d2d2d"
  - 默认值: "#f0f0f0"（浅灰色）

## 常用配色方案

### 浅色系（默认）
```json
{
  "designer": {
    "canvasBackgroundColor": "#f0f0f0"
  }
}
```

### 蓝色系
```json
{
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
```

### 深色主题
```json
{
  "designer": {
    "canvasBackgroundColor": "#2d2d2d"
  }
}
```

### 护眼模式（浅绿色）
```json
{
  "designer": {
    "canvasBackgroundColor": "#f1f8e9"
  }
}
```

## 创建项目配置文件

使用命令行创建:

```bash
cd your-project

cat > project.json <<'EOF'
{
  "name": "MyApp",
  "appId": "com.example.MyApp",
  "version": "1.0.0",
  "resolution": "480X272",
  "minSdk": "API 2: Persim Wear V1.1.0",
  "pixelMode": "ARGB8888",
  "mainHmlFile": "ui/main.hml",
  "created": "$(date -Iseconds)",
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
EOF
```

## 修改配置

直接编辑 project.json 文件，保存后重新打开设计器即可生效。

**注意**: 修改配置后不需要重启 VS Code，但需要在关闭后重新打开设计器。

## 配置示例文件

项目中已包含示例: `/home/howie_wang/workspace/NewProject/project.json`

## 从 VS Code 设置迁移

**旧方式** (已移除):
```json
// .vscode/settings.json (不再使用)
{
  "honeygui.ui.canvasBackgroundColor": "#f0f0f0"
}
```

**新方式**:
```json
// project.json (推荐使用)
{
  "designer": {
    "canvasBackgroundColor": "#f0f0f0"
  }
}
```

**迁移步骤**:
1. 从 VS Code settings.json 中删除旧配置
2. 在 project.json 的 designer 字段中添加新配置
3. 重新打开设计器

## 向后兼容

如果 project.json 中不包含 designer 配置，系统会使用默认值 `#f0f0f0`（浅灰色）。
