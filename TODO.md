# TODO - 外部依赖集成计划

## 当前外部依赖分析

### 已集成（无需处理）
- ✅ **图片转换**：已使用 `pngjs` + `jpeg-js` 实现，无外部依赖

### 待处理的外部依赖

| 依赖 | 用途 | 必需性 | 体积 | 集成难度 |
|------|------|--------|------|----------|
| **SCons** | 项目构建 | 必需（编译） | Python 依赖 | 中 |
| **GCC/MinGW** | C 编译器 | 必需（编译） | 200MB+ | 高 |
| **Python 3** | SDK 工具运行 | 必需（视频/3D 转换） | 50MB+ | 高 |
| **SDL2** | 仿真渲染 | 必需（仿真运行） | 10-30MB | 高 |
| **FFmpeg** | 视频预处理 | 可选（尺寸变换） | 50-80MB | 中 |
| **FFprobe** | 视频信息读取 | 可选（元数据） | 包含在 FFmpeg | 低 |

---

## 集成方案

### 优先级 1：消除 SCons 依赖（推荐立即实施）

#### 方案：用 Node.js 重写构建逻辑

**实施步骤**：
1. 创建 `src/simulation/NodeBuildSystem.ts`
2. 解析 SConscript 文件或硬编码标准构建规则
3. 直接调用 GCC 进行编译和链接
4. 替换 `SimulationRunner` 中的 SCons 调用

**MVP 实现**（1 天工作量）：
```typescript
export class NodeBuildSystem {
    async compile(buildDir: string): Promise<void> {
        // 固定编译命令（适配 win32_sim 结构）
        const sources = ['src/**/*.c', 'realgui/**/*.c', 'gui_engine/**/*.c'];
        const includes = ['-I./realgui', '-I./gui_engine'];
        const libs = ['-lSDL2', '-lm'];
        
        // 编译 + 链接
        await this.compileAndLink(sources, includes, libs);
    }
}
```

**效果**：
- ✅ 消除 SCons 依赖
- ✅ 消除 Python 依赖（如果不使用视频/3D 转换）
- ✅ 插件体积增加 <10KB
- ✅ 适用于 90% 标准项目

**后续优化**：
- 解析 SConscript 文件动态获取配置
- 增量编译支持
- 并行编译优化

---

### 优先级 2：视频处理集成（中期）

#### 方案 A：集成 WASM FFmpeg（推荐）

**库**：`@ffmpeg/ffmpeg`

**特点**：
- 体积：30MB（按需下载，可缓存）
- 功能：完整 FFmpeg 功能
- 速度：比原生慢 2-5 倍
- 无需系统安装

**实施**：
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';

class WasmVideoConverter {
    private ffmpeg = new FFmpeg();
    
    async init() {
        await this.ffmpeg.load(); // 首次下载 30MB
    }
    
    async convert(input: string, output: string, options: any) {
        await this.ffmpeg.writeFile('input.mp4', inputData);
        await this.ffmpeg.exec(['-i', 'input.mp4', ...]);
        return await this.ffmpeg.readFile('output.mp4');
    }
}
```

**混合模式**（推荐）：
```typescript
// 优先使用系统 FFmpeg（快）
if (await checkSystemFFmpeg()) {
    await useSystemFFmpeg();
} else {
    // 降级到 WASM FFmpeg
    await useWasmFFmpeg();
}
```

#### 方案 B：仅集成元信息读取

**库**：`mp4box.js`（500KB）

**功能**：
- 读取视频分辨率、帧率、时长
- 不支持转码

**适用场景**：
- 只需要显示视频属性
- 实际转换仍依赖 SDK Python 工具

---

### 优先级 3：GCC/SDL2（暂不集成）

**原因**：
- GCC：体积过大（200MB+），且用户通常已有开发环境
- SDL2：系统级库，需要正确安装才能运行

**替代方案**：
- 提供一键安装脚本
- 详细的环境配置文档
- 环境检查工具（已有 `EnvironmentChecker`）

---

## 实施路线图

### 阶段 1：最小集成（立即）
- [ ] 实现 `NodeBuildSystem` 替代 SCons
- [ ] 测试标准项目编译流程
- [ ] 更新文档说明无需 Python/SCons

**预期效果**：消除 50% 外部依赖

### 阶段 2：视频处理优化（1-2 周）
- [ ] 集成 `mp4box.js` 读取视频元信息
- [ ] 可选：集成 WASM FFmpeg 作为降级方案
- [ ] 实现混合模式（系统 FFmpeg 优先）

**预期效果**：视频功能可选依赖

### 阶段 3：完善构建系统（1 个月）
- [ ] 解析 SConscript 动态配置
- [ ] 增量编译支持
- [ ] 并行编译优化
- [ ] 依赖分析

**预期效果**：完整的 Node.js 构建系统

---

## 按需下载机制（长期）

**设计**：
```
插件本体：<5MB（不含工具）
首次使用时：
  - 提示下载工具包（可选）
  - 缓存到 ~/.honeygui-tools/
  - 包含：WASM FFmpeg、构建工具等
```

**优势**：
- 插件市场体积小
- 用户按需获取
- 工具可独立更新

---

## 注意事项

1. **保持向后兼容**：支持用户已安装的 SCons/FFmpeg
2. **渐进式集成**：先 MVP，再完善
3. **文档同步更新**：说明哪些依赖已可选
4. **测试覆盖**：Windows/Linux/macOS 三平台
5. **性能对比**：Node.js 构建 vs SCons 构建速度

---

## 相关文件

- `src/simulation/EnvironmentChecker.ts` - 环境检查
- `src/simulation/SimulationRunner.ts` - 编译仿真入口
- `src/simulation/BuildCore.ts` - 构建核心逻辑
- `src/services/VideoConverterService.ts` - 视频转换
- `src/services/ImageConverterService.ts` - 图片转换（已集成）
- `tools/image-converter/` - 图片转换实现

---

**最后更新**：2025-12-22
