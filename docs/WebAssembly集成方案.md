# WebAssembly 集成方案

## 概述

将 HoneyGUI C/C++ SDK 编译为 WebAssembly，在设计器中实现真实预览，解决复杂控件（3D、Video、Canvas）无法准确模拟的问题。

## 背景

### 当前问题

1. **React 模拟渲染的局限性**
   - 只能模拟简单 2D 控件（Button、Label、Input 等）
   - 复杂控件（3D 模型、视频播放、自定义绘图）无法准确呈现
   - 预览效果与实际运行存在差异

2. **已实现的渲染器**
   - 基础控件：Button, Label, Text, Input, Checkbox, Radio, ProgressBar, Slider
   - 容器控件：View, Panel, Window, Screen
   - 媒体控件：Image（静态图片）
   - **缺失**：3D、Video、Canvas、动画等

3. **用户痛点**
   - 设计复杂界面时无法预览真实效果
   - 必须通过"编译仿真"才能看到实际渲染
   - 设计迭代周期长，效率低

## 技术方案

### 核心技术：WebAssembly + Emscripten

**WebAssembly (Wasm)**
- 将 C/C++ 代码编译为浏览器可执行的二进制格式
- 接近原生性能（比 JavaScript 快 10-20 倍）
- 可以在 Web 端直接运行 HoneyGUI 的 C 代码

**Emscripten**
- C/C++ 到 WebAssembly 的编译工具链
- 自动转换 OpenGL ES → WebGL
- 生成 JavaScript 胶水代码，简化集成

### 架构设计

```
┌─────────────────────────────────────────────────────┐
│              VSCode Extension (TypeScript)           │
│  ┌───────────────────────────────────────────────┐  │
│  │         DesignerPanel (Webview)               │  │
│  │  ┌─────────────────┬─────────────────────┐   │  │
│  │  │  React 模拟渲染  │  WebAssembly 真实渲染│   │  │
│  │  │  (简单控件)     │  (复杂控件)         │   │  │
│  │  │                 │                     │   │  │
│  │  │  - Button       │  - 3D Model        │   │  │
│  │  │  - Label        │  - Video Player    │   │  │
│  │  │  - Input        │  - Canvas Drawing  │   │  │
│  │  │  - Image        │  - Animation       │   │  │
│  │  └─────────────────┴─────────────────────┘   │  │
│  │              ↓                                │  │
│  │      ┌──────────────────┐                    │  │
│  │      │  HoneyGUI Wasm   │                    │  │
│  │      │  (honeygui.wasm) │                    │  │
│  │      └──────────────────┘                    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 实施步骤

#### 阶段 1：环境搭建（1-2 天）

1. **安装 Emscripten SDK**
```bash
# 下载 Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

2. **验证环境**
```bash
emcc --version
# 应输出 Emscripten 版本信息
```

#### 阶段 2：编译 HoneyGUI SDK（3-5 天）

1. **创建编译脚本**
```bash
# build-wasm.sh
emcc \
  honeygui_sdk/src/*.c \
  -o dist/honeygui.js \
  -s WASM=1 \
  -s USE_SDL=2 \
  -s USE_WEBGL2=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_init_gui", "_render_frame", "_destroy_gui"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
  -O3
```

2. **适配 HoneyGUI 代码**
   - 移除硬件相关代码（传感器、GPIO 等）
   - 适配 OpenGL ES → WebGL
   - 处理文件系统访问（使用 Emscripten 虚拟文件系统）

3. **测试编译产物**
```bash
# 生成文件
dist/honeygui.js      # JavaScript 胶水代码
dist/honeygui.wasm    # WebAssembly 二进制
```

#### 阶段 3：集成到设计器（5-7 天）

1. **创建 Wasm 加载器**
```typescript
// src/webview/services/WasmLoader.ts
export class WasmLoader {
  private module: any = null;
  
  async load(): Promise<void> {
    const Module = await import('../../dist/honeygui.js');
    this.module = await Module.default({
      canvas: document.getElementById('wasm-canvas'),
      onRuntimeInitialized: () => {
        console.log('HoneyGUI Wasm loaded');
      }
    });
  }
  
  renderFrame(components: Component[]): void {
    if (!this.module) return;
    // 调用 C 函数渲染
    this.module._render_frame(JSON.stringify(components));
  }
}
```

2. **修改 DesignerCanvas**
```typescript
// src/webview/components/DesignerCanvas.tsx
const [renderMode, setRenderMode] = useState<'simulate' | 'real'>('simulate');
const wasmLoader = useRef(new WasmLoader());

useEffect(() => {
  if (renderMode === 'real') {
    wasmLoader.current.load();
  }
}, [renderMode]);

// 渲染逻辑
if (renderMode === 'real' && needsWasmRendering(component)) {
  // 使用 Wasm 渲染
  wasmLoader.current.renderFrame([component]);
} else {
  // 使用 React 模拟渲染
  const Renderer = componentRenderers[component.type];
  return <Renderer {...props} />;
}
```

3. **添加预览模式切换**
```typescript
// Toolbar.tsx
<button onClick={() => setRenderMode(mode === 'simulate' ? 'real' : 'simulate')}>
  {mode === 'simulate' ? '切换到真实预览' : '切换到模拟预览'}
</button>
```

#### 阶段 4：优化与降级（2-3 天）

1. **性能优化**
   - 按需加载 Wasm 模块（首次使用时加载）
   - 缓存编译结果
   - 使用 Web Worker 避免阻塞主线程

2. **降级方案**
```typescript
try {
  await wasmLoader.load();
} catch (error) {
  console.warn('Wasm 加载失败，降级到 React 渲染', error);
  setRenderMode('simulate');
}
```

3. **加载状态提示**
```typescript
{isLoadingWasm && (
  <div className="wasm-loading">
    <Spinner />
    <span>正在加载真实预览引擎...</span>
  </div>
)}
```

### 技术难点与解决方案

#### 1. OpenGL ES → WebGL 转换

**问题**：HoneyGUI 使用 OpenGL ES，浏览器只支持 WebGL

**解决**：
- Emscripten 自动转换大部分 API
- 手动适配不兼容的 API（如 `glMapBuffer`）
- 使用 WebGL 2.0 提高兼容性

#### 2. 文件系统访问

**问题**：C 代码使用 `fopen`、`fread` 等文件 API

**解决**：
- 使用 Emscripten 虚拟文件系统（MEMFS）
- 预加载资源文件到虚拟文件系统
```javascript
Module.FS.writeFile('/assets/image.png', imageData);
```

#### 3. 内存管理

**问题**：C 代码手动管理内存，可能泄漏

**解决**：
- 使用 `ALLOW_MEMORY_GROWTH=1` 允许动态增长
- 定期调用 `_destroy_gui()` 释放资源
- 监控内存使用，超过阈值时重新加载

#### 4. 性能优化

**问题**：Wasm 模块较大（可能 5-10MB），加载慢

**解决**：
- 使用 `-O3` 优化编译
- 启用 Brotli 压缩（压缩率 70-80%）
- 按需加载（只在需要时加载）
- 使用 CDN 加速

### 成功案例参考

**Figma**
- 使用 C++ + WebAssembly 实现渲染引擎
- 性能接近原生应用
- 支持复杂的矢量图形和实时协作

**AutoCAD Web**
- 将 CAD 引擎编译为 Wasm
- 在浏览器中运行完整的 CAD 功能

**Unity WebGL**
- 游戏引擎完全运行在浏览器
- 支持 3D 渲染、物理引擎、音频

## 预期收益

### 用户体验提升

1. **所见即所得**
   - 预览效果 = 实际运行效果
   - 无需频繁编译仿真

2. **设计效率提升**
   - 实时预览复杂控件
   - 快速迭代设计方案

3. **降低学习成本**
   - 不需要理解 C 代码就能预览效果
   - 直观的可视化反馈

### 技术优势

1. **代码复用**
   - 预览和运行使用同一套 C 代码
   - 减少维护成本

2. **一致性保证**
   - 消除 React 模拟与实际运行的差异
   - 减少 Bug 和意外行为

3. **扩展性**
   - 支持任意复杂的自定义控件
   - 无需为每个控件编写 React 渲染器

## 风险与挑战

### 技术风险

1. **兼容性问题**
   - 部分 OpenGL API 可能无法完美转换
   - 需要逐个测试和适配

2. **性能瓶颈**
   - Wasm 模块加载时间
   - 首次渲染延迟

3. **调试困难**
   - Wasm 代码难以调试
   - 需要 Source Map 支持

### 缓解措施

1. **渐进式实施**
   - 先支持部分控件，逐步扩展
   - 保留 React 模拟作为降级方案

2. **充分测试**
   - 单元测试覆盖核心功能
   - 集成测试验证端到端流程

3. **文档完善**
   - 编译配置文档
   - 故障排查指南
   - 性能优化建议

## 时间估算

| 阶段 | 工作内容 | 预计时间 |
|------|---------|---------|
| 阶段 1 | 环境搭建 | 1-2 天 |
| 阶段 2 | 编译 SDK | 3-5 天 |
| 阶段 3 | 集成设计器 | 5-7 天 |
| 阶段 4 | 优化降级 | 2-3 天 |
| 测试验证 | 全面测试 | 3-5 天 |
| **总计** | | **14-22 天** |

## 参考资料

### 官方文档
- [Emscripten 官方文档](https://emscripten.org/docs/)
- [WebAssembly 规范](https://webassembly.org/)
- [WebGL 2.0 规范](https://www.khronos.org/webgl/)

### 教程与案例
- [Compiling C to WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly/C_to_wasm)
- [OpenGL ES to WebGL Migration](https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences)
- [Figma's Engineering Blog - WebAssembly](https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/)

### 工具
- [Emscripten SDK](https://github.com/emscripten-core/emsdk)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) (Rust 替代方案)
- [WebAssembly Studio](https://webassembly.studio/) (在线编译测试)

## 下一步行动

1. **技术验证**（1 周）
   - 搭建 Emscripten 环境
   - 编译简单的 C 程序验证可行性
   - 测试 OpenGL → WebGL 转换

2. **原型开发**（2 周）
   - 编译 HoneyGUI 核心模块
   - 在设计器中加载 Wasm 模块
   - 实现一个复杂控件的真实预览

3. **评审决策**
   - 评估技术可行性
   - 确定优先级和排期
   - 决定是否全面推进

---

**文档版本**：v1.0  
**创建日期**：2025-11-28  
**最后更新**：2025-11-28  
**负责人**：待定  
**状态**：待评审
