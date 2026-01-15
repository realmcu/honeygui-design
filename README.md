# HoneyGUI Design

一个强大的 VSCode 插件，为嵌入式 GUI 应用程序开发提供可视化设计环境、代码生成和实时仿真工具。

## 目录

- [功能特性](#功能特性)
- [安装](#安装)
- [快速开始](#快速开始)
  - [1. 创建项目](#1-创建项目)
  - [2. 设计界面](#2-设计界面)
  - [3. 生成代码](#3-生成代码)
  - [4. 编译仿真](#4-编译仿真)
- [资源转换工具](#资源转换工具)
- [协同开发](#协同开发)
- [项目配置](#项目配置)
- [许可证](#许可证)
- [链接](#链接)

## 功能特性

- **可视化设计器**：拖放式界面设计，支持 HoneyGUI 组件库
- **HML 文件格式**：类 XML 格式描述界面结构
- **C 代码生成**：将设计转换为调用 HoneyGUI API 的 C 代码
- **代码保护区**：用户自定义逻辑不会被覆盖
- **编译仿真**：完整的编译-运行-调试流程
- **协同开发**：局域网多人实时协同编辑（离线可用）
- **资源管理**：统一管理图片、字体、视频、3D 模型等资源

### 支持的组件
- 容器：`hg_view`, `hg_window`
- 基础控件：`hg_button`, `hg_text`, `hg_image`, `hg_switch`
- 输入控件：`hg_input`, `hg_checkbox`, `hg_radio`
- 高级控件：`hg_progressbar`, `hg_slider`, `hg_canvas`
- 多媒体：`hg_video`, `hg_3d`

## 安装

1. 打开 VSCode
2. 扩展面板搜索 **"HoneyGUI Visual Designer"**
3. 点击安装

## 快速开始

### 1. 创建项目

点击左侧 HoneyGUI 图标 → **新建项目**

![Create Project](https://gitee.com/realmcu_admin/honeygui-design/raw/master/resources/screenshots/create-project.png)

### 2. 设计界面

双击 `.hml` 文件打开设计器，从组件库拖拽组件到画布

![Design UI](https://gitee.com/realmcu_admin/honeygui-design/raw/master/resources/screenshots/design-ui.png)

### 3. 编译仿真

点击工具栏 **▶ 编译仿真** 按钮

![Compile](https://gitee.com/realmcu_admin/honeygui-design/raw/master/resources/screenshots/compile.png)

## 资源转换工具

插件提供了多种资源转换工具，用于将常见格式转换为 HoneyGUI 支持的格式。

### 打开资源转换工具
```
Ctrl+Shift+P → HoneyGUI: Resource Conversion Tools
```

### 支持的转换类型

#### 1. 图片转换
- **支持格式**：PNG, JPG, BMP → BIN
- **用途**：将图片转换为 HoneyGUI 可直接使用的二进制格式
- **使用方法**：
  1. 选择"图片转换"
  2. 选择源图片文件
  3. 选择输出目录
  4. 自动生成 `.bin` 文件

#### 2. 字体转换
- **支持格式**：TTF, OTF → BIN
- **用途**：提取字体字形数据，生成嵌入式字体文件
- **使用方法**：
  1. 选择"字体转换"
  2. 选择字体文件
  3. 配置字号、字符集等参数
  4. 生成字体 `.bin` 文件

#### 3. 3D 模型转换
- **支持格式**：OBJ, GLTF, GLB → BIN
- **用途**：将 3D 模型转换为 HoneyGUI 3D 引擎格式
- **使用方法**：
  1. 选择"3D 模型转换"
  2. 选择模型文件
  3. 配置优化选项
  4. 生成模型 `.bin` 文件

#### 4. 视频转换
- **支持格式**：MP4, AVI, MOV → MP4 (H.264)
- **用途**：转换为嵌入式设备支持的视频格式
- **使用方法**：
  1. 选择"视频转换"
  2. 选择视频文件
  3. 配置分辨率、帧率、码率
  4. 生成优化后的视频文件

### 批量转换
支持选择多个文件进行批量转换，提高工作效率。

### 转换后的文件
转换后的资源文件会自动放置在项目的 `assets/` 目录下，可直接在设计器中使用。

## 协同开发

### 主机模式
```
Ctrl+Shift+P → HoneyGUI: Start Host
```

### 访客模式
```
Ctrl+Shift+P → HoneyGUI: Join Session
输入主机地址（如 192.168.1.10:3000）
```

## 项目配置

### project.json
```json
{
  "name": "my-project",
  "resolution": "480X272"
}
```

### VSCode 设置
```json
{
  "honeygui.ui.gridSize": 8,
  "honeygui.ui.snapToGrid": true
}
```

## 许可证

MIT License

## 链接

- **HoneyGUI SDK (GitHub)**：https://github.com/realmcu/HoneyGUI
- **HoneyGUI SDK (Gitee)**：https://gitee.com/realmcu/HoneyGUI
- **问题反馈(GitHub)**：https://github.com/realmcu/HoneyGUI/issues
- **问题反馈(Gitee)**：https://gitee.com/realmcu/HoneyGUI/issues
