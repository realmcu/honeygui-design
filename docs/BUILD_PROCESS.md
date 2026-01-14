# 插件打包流程

本插件已不依赖外部 HoneyGUI SDK，所有必需文件内置在 `lib/sim/` 目录。

## 目录结构

```
lib/sim/
├── win32_sim/          # 仿真端源码（从 SDK 拷贝）
├── include/            # GUI 框架头文件（从 SDK 拷贝）
├── tool/               # 构建工具（从 SDK 拷贝）
│   ├── scons-tool/     # SCons 构建脚本
│   └── mkromfs/        # ROMFS 生成工具
├── linux/              # Linux 预编译库
│   └── libgui.a        # GUI 框架静态库
├── win32/              # Windows 预编译库
│   └── libgui.a        # GUI 框架静态库
├── SDL2-2.26.0-STATIC/ # SDL2 静态库（已包含）
└── Kconfig.gui         # 配置文件
```

## 准备流程

### 1. 从 SDK 拷贝文件

```bash
# 自动拷贝（推荐）
./scripts/prepare-lib-sim.sh /path/to/HoneyGUI-SDK

# 或手动拷贝
SDK=/path/to/HoneyGUI-SDK
cp -r $SDK/win32_sim lib/sim/
cp -r $SDK/realgui/engine/*.h lib/sim/include/
cp -r $SDK/realgui/widget/*.h lib/sim/include/
cp -r $SDK/tool/scons-tool lib/sim/tool/
cp -r $SDK/tool/mkromfs lib/sim/tool/
cp $SDK/Kconfig.gui lib/sim/
```

### 2. 编译预编译库

#### Linux 平台

```bash
cd /path/to/HoneyGUI-SDK/win32_sim
scons --buildlib=gui
cp build/libgui.a /path/to/plugin/lib/sim/linux/
```

#### Windows 平台

在 Windows 环境（MinGW）下：

```bash
cd C:\path\to\HoneyGUI-SDK\win32_sim
scons --buildlib=gui
copy build\libgui.a C:\path\to\plugin\lib\sim\win32\
```

### 3. 验证文件完整性

```bash
# 检查必需文件
ls lib/sim/win32_sim/main.c          # 仿真端入口
ls lib/sim/include/gui_api.h         # 头文件
ls lib/sim/tool/scons-tool/building.py  # 构建工具
ls lib/sim/linux/libgui.a            # Linux 库
ls lib/sim/win32/libgui.a            # Windows 库
```

### 4. 编译插件

```bash
npm install
npm run compile
npm run build:webview
```

### 5. 打包插件

```bash
vsce package
```

生成：`honeygui-visual-designer-x.x.x.vsix`

## 更新预编译库

当 HoneyGUI SDK 更新时，需要重新编译预编译库：

```bash
# 1. 更新源码
./scripts/prepare-lib-sim.sh /path/to/new-SDK

# 2. 重新编译 libgui.a（Linux）
cd /path/to/new-SDK/win32_sim
scons --buildlib=gui
cp build/libgui.a /path/to/plugin/lib/sim/linux/

# 3. 重新编译 libgui.a（Windows）
# 在 Windows 环境下执行

# 4. 重新打包
npm run compile && npm run build:webview && vsce package
```

## 注意事项

1. **预编译库版本**：确保 Linux 和 Windows 的 libgui.a 来自同一版本的 SDK
2. **头文件同步**：include/ 目录的头文件必须与 libgui.a 匹配
3. **SDL2 库**：已内置在 `SDL2-2.26.0-STATIC/`，无需更新
4. **工具脚本**：scons-tool 和 mkromfs 需要与 SDK 保持同步

## 文件大小

- `lib/sim/`: ~16 MB
- `libgui.a` (Linux): ~3.7 MB
- `libgui.a` (Windows): ~4 MB
- 完整插件包: ~7-8 MB
