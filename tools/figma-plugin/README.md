# Figma Plugin: Export to HML

在 Figma 中直接将设计稿导出为 HoneyGUI HML 工程的插件。

## 功能特性

- **一键导出**：在 Figma 内直接将当前设计导出为 HML 工程 ZIP 包
- **可视化配置**：选择 Page、Frame，设置分辨率、像素格式等参数
- **图片资源导出**：自动将图片填充、矢量图形导出为图片文件
- **ZIP 打包下载**：直接下载包含完整 HML 工程目录结构的 ZIP 文件
- **离线运行**：不需要网络连接，所有转换在本地完成

## 安装到 Figma

### 开发模式安装

1. **构建插件**：
   ```bash
   cd tools/figma-plugin
   npm install
   npm run build
   ```

2. **在 Figma 桌面版中加载**：
   - 打开 Figma Desktop App
   - 菜单 → Plugins → Development → Import plugin from manifest...
   - 选择 `tools/figma-plugin/manifest.json`

3. **运行插件**：
   - 在任意 Figma 文件中：右键 → Plugins → Development → Figma to HML
   - 或使用快速操作 (Ctrl/Cmd + /)，搜索 "Export to HML"

### 发布到 Figma Community（可选）

1. 前往 [Figma Plugin 发布页面](https://www.figma.com/developers/submit-plugin)
2. 打包上传 `manifest.json` + `dist/` 目录

## 使用流程

1. **打开 Figma 文件**，运行插件
2. **选择 Page** — 插件自动列出所有 Page
3. **勾选要导出的 Frame** — 每个顶层 Frame 对应一个 `hg_view`
4. **配置参数**：
   - 项目名称
   - 目标分辨率（如 454x454）
   - 像素格式（RGB565 / ARGB8888）
   - 图片格式和缩放
   - 默认字体文件名
5. **点击 Export** → 等待转换完成
6. **Download ZIP** → 获得完整 HML 工程

## 输出结构

```
MyProject.zip
└── MyProject/
    ├── project.json          # 项目配置
    ├── ui/
    │   └── MyProject.hml     # HML 设计文件
    ├── assets/               # 图片资源
    │   ├── image_0.png
    │   ├── image_1.png
    │   └── ...
    └── src/
        └── user/             # 用户代码目录
            └── .gitkeep
```

## 转换映射

| Figma 节点 | HML 组件 | 说明 |
|------------|----------|------|
| FRAME (顶层) | `hg_view` | 独立页面/视图 |
| FRAME (嵌套) | `hg_window` | 嵌套容器 |
| GROUP | `hg_window` | 分组 |
| COMPONENT / INSTANCE | `hg_window` | 组件 |
| TEXT | `hg_label` | 文本 |
| RECTANGLE | `hg_rect` | 矩形 |
| RECTANGLE (图片填充) | `hg_image` | 图片 |
| ELLIPSE | `hg_circle` | 圆形 |
| VECTOR / STAR / LINE | `hg_image` | 矢量导出为图片 |

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式 (监听文件变更)
npm run watch
```

### 目录结构

```
figma-plugin/
├── manifest.json           # Figma 插件清单
├── package.json
├── tsconfig.json
├── scripts/
│   └── build-ui.js         # UI 构建脚本
├── src/
│   ├── code.ts             # 插件后端 (Figma 沙箱)
│   ├── converter.ts        # 节点转换逻辑
│   ├── image-exporter.ts   # 图片导出
│   └── ui.html             # 插件 UI 界面
└── dist/                   # 构建输出
    ├── code.js
    └── ui.html
```

### 架构说明

- **code.ts** — 运行在 Figma 沙箱中，可以访问 `figma.*` API 读取节点数据、导出图片
- **ui.html** — 运行在 iframe 中，提供用户界面，通过 `postMessage` 与 code.ts 通信
- **converter.ts** — 纯转换逻辑，将 Figma 节点树转为 HML XML
- **ZIP 打包** — 在 UI 层使用内嵌的 SimpleZip 类生成 ZIP（纯 JS，无外部依赖）

## 限制

- Figma 插件沙箱不支持文件系统访问，只能通过浏览器下载 ZIP
- 复杂矢量路径（SVG 曲线）会被导出为位图
- Figma 特效（阴影、模糊）不会转换到 HML
- Auto Layout 按绝对位置转换
- 字体文件需要用户自行准备并放入 assets 目录
