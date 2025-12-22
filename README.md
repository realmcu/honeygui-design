# HoneyGUI Design

一个强大的 VSCode 插件，为嵌入式 GUI 应用程序开发提供可视化设计环境、代码生成和实时仿真工具。

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

### 前置依赖（用于编译仿真）
- **HoneyGUI SDK**：安装到 `~/.HoneyGUI-SDK`（或在设置中配置路径）
- **SCons**：构建工具（`pip install scons`）
- **GCC/MinGW**：C 编译器
- **SDL2**：图形库（仅运行仿真时需要）

## 快速开始

### 1. 创建项目
```
Ctrl+Shift+P → HoneyGUI: New Project
```

生成的项目结构：
```
my-project/
├── ui/main/main.hml      # 设计文件
├── src/                  # 源代码
├── assets/               # 资源文件
├── build/                # 编译产物
└── project.json          # 项目配置
```

### 2. 设计界面
1. 双击 `.hml` 文件打开设计器
2. 从左侧组件库拖拽组件到画布
3. 在右侧属性面板编辑属性
4. `Ctrl+S` 保存

**快捷键**：
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z/Y` | 撤销/重做 |
| `Delete` | 删除组件 |
| `Ctrl+D` | 复制组件 |
| `方向键` | 微调位置 |
| `Ctrl+拖动` | 平移画布 |

### 3. 生成代码
点击工具栏"生成代码"按钮，自动生成 C 代码。

**文件覆盖策略**：
| 文件 | 策略 |
|------|------|
| `*_ui.c/h` | 每次覆盖 |
| `*_callbacks.c` | 保护区机制 |
| `user/*.c` | 只生成一次 |

### 4. 编译仿真
```
Ctrl+Shift+P → HoneyGUI: Compile & Simulate
```

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
  "resolution": "480X272",
  "honeyguiSdkPath": "/path/to/sdk"
}
```

### VSCode 设置
```json
{
  "honeygui.sdk.path": "~/.HoneyGUI-SDK",
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
