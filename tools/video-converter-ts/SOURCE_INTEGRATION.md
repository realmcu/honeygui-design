# 源码集成指南

本文档说明如何将 video-converter 以源码方式集成到你的项目中，无需 npm 包依赖。

## 核心优势

- ✅ **零外部依赖** - 核心功能不依赖任何第三方包
- ✅ **纯 TypeScript** - 完整类型支持
- ✅ **模块化设计** - 只需复制 `src/` 目录
- ✅ **CLI 可选** - 命令行工具是独立的，可以不集成

## 快速集成（3 步）

### 方法 A：使用复制脚本（推荐）

我们提供了自动复制脚本：

**Linux/Mac:**
```bash
chmod +x copy-source.sh
./copy-source.sh ../your-project/src/video-converter
```

**Windows:**
```cmd
copy-source.bat ..\your-project\src\video-converter
```

脚本会自动复制所有必需文件到目标目录。

### 方法 B：手动复制

### 1. 复制源码文件

将以下文件复制到你的项目：

```
你的项目/
├── src/
│   └── video-converter/          # 创建此目录
│       ├── converter.ts          # 主转换器
│       ├── parser.ts             # 视频解析器
│       ├── ffmpeg-builder.ts     # FFmpeg 命令构建
│       ├── ffmpeg-executor.ts    # FFmpeg 执行器
│       ├── models.ts             # 数据模型
│       ├── errors.ts             # 错误定义
│       ├── index.ts              # 导出入口
│       └── postprocess/          # 后处理模块
│           ├── avi-aligner.ts    # AVI 对齐
│           ├── mjpeg-packer.ts   # MJPEG 打包
│           ├── h264-packer.ts    # H264 封装
│           └── index.ts          # 导出入口
```

**不需要复制的文件：**
- ❌ `cli.ts` - 命令行工具（依赖 commander）
- ❌ `tests/` - 测试文件
- ❌ `node_modules/` - 依赖包
- ❌ `dist/` - 编译输出

### 2. 配置 TypeScript

在你的 `tsconfig.json` 中添加路径映射（可选，但推荐）：

```json
{
  "compilerOptions": {
    "paths": {
      "@/video-converter/*": ["./src/video-converter/*"]
    }
  }
}
```

### 3. 开始使用

```typescript
// 直接导入
import { VideoConverter, OutputFormat } from './video-converter';

// 或使用路径别名
import { VideoConverter, OutputFormat } from '@/video-converter';

// 使用
const converter = new VideoConverter();
await converter.convert('input.mp4', 'output.avi', OutputFormat.AVI_MJPEG);
```

## 完整示例

### 基本转换

```typescript
import { VideoConverter, OutputFormat } from './video-converter';

async function convertVideo() {
  const converter = new VideoConverter();
  
  const result = await converter.convert(
    'input.mp4',
    'output.avi',
    OutputFormat.AVI_MJPEG
  );
  
  console.log('转换完成:', result);
}
```

### 带进度回调

```typescript
import { VideoConverter, OutputFormat } from './video-converter';

async function convertWithProgress() {
  const converter = new VideoConverter((current, total) => {
    const percent = (current / total * 100).toFixed(1);
    console.log(`进度: ${percent}% (${current}/${total})`);
  });
  
  await converter.convert('input.mp4', 'output.avi', OutputFormat.AVI_MJPEG);
}
```

### 获取视频信息

```typescript
import { VideoConverter } from './video-converter';

async function getInfo() {
  const converter = new VideoConverter();
  const info = await converter.getVideoInfo('input.mp4');
  
  console.log(`分辨率: ${info.width}x${info.height}`);
  console.log(`帧率: ${info.frameRate} fps`);
  console.log(`时长: ${info.duration} 秒`);
}
```

### 完整选项

```typescript
import { VideoConverter, OutputFormat, ConversionOptions } from './video-converter';

async function convertWithOptions() {
  const converter = new VideoConverter();
  
  const options: ConversionOptions = {
    frameRate: 25,    // 目标帧率
    quality: 2,       // 质量参数
    debug: false      // 调试模式
  };
  
  const result = await converter.convert(
    'input.mp4',
    'output.avi',
    OutputFormat.AVI_MJPEG,
    options
  );
  
  return result;
}
```

## 类型定义

所有类型都已包含在源码中：

```typescript
// 导入类型
import {
  VideoConverter,      // 转换器类
  OutputFormat,        // 输出格式枚举
  VideoInfo,           // 视频信息接口
  ConversionResult,    // 转换结果接口
  ConversionOptions,   // 转换选项接口
  ProgressCallback,    // 进度回调类型
  // 错误类型
  VideoConverterError,
  VideoFormatError,
  FFmpegNotFoundError,
  FFmpegError,
  PostProcessError
} from './video-converter';

// 使用类型
const info: VideoInfo = await converter.getVideoInfo('input.mp4');
const result: ConversionResult = await converter.convert(...);
```

## 依赖要求

### 运行时依赖

- ✅ **Node.js 18+** - 使用 ES Modules
- ✅ **FFmpeg** - 必须在系统 PATH 中

### 编译时依赖

- ✅ **TypeScript 5.0+** - 用于编译
- ✅ **@types/node** - Node.js 类型定义

在你的 `package.json` 中：

```json
{
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**注意：** 核心功能不需要任何运行时依赖！

## 文件结构说明

### 核心模块（必需）

| 文件 | 说明 | 依赖 |
|------|------|------|
| `models.ts` | 数据模型和类型定义 | 无 |
| `errors.ts` | 错误类定义 | 无 |
| `parser.ts` | 视频信息解析 | models, errors |
| `ffmpeg-builder.ts` | FFmpeg 命令构建 | models |
| `ffmpeg-executor.ts` | FFmpeg 命令执行 | models, errors |
| `converter.ts` | 主转换器 | 所有核心模块 |
| `index.ts` | 导出入口 | 所有核心模块 |

### 后处理模块（必需）

| 文件 | 说明 | 依赖 |
|------|------|------|
| `postprocess/mjpeg-packer.ts` | MJPEG 打包 | errors |
| `postprocess/avi-aligner.ts` | AVI 8字节对齐 | errors |
| `postprocess/h264-packer.ts` | H264 封装 | errors |
| `postprocess/index.ts` | 导出入口 | 所有后处理模块 |

### 可选模块

| 文件 | 说明 | 依赖 |
|------|------|------|
| `cli.ts` | 命令行工具 | commander（外部依赖） |

## 与 npm 包方式对比

| 特性 | npm 包 | 源码集成 |
|------|--------|---------|
| 安装方式 | `npm install` | 复制文件 |
| 体积 | ~100KB（编译后） | ~50KB（源码） |
| 外部依赖 | 0（核心功能） | 0 |
| 更新方式 | `npm update` | 手动同步 |
| 版本管理 | npm 自动 | 手动 |
| TypeScript | 自动编译 | 需要配置 |
| 适用场景 | 生产环境 | 开发/定制 |

## 常见问题

### Q: 需要安装 commander 吗？

**A**: 不需要。`commander` 只用于 CLI 工具（`cli.ts`）。如果你只使用核心功能（`VideoConverter` 类），不需要任何外部依赖。

### Q: 如何更新到新版本？

**A**: 
1. 从 GitHub 下载最新源码
2. 对比差异，复制更新的文件
3. 或使用 Git Submodule 自动同步


### Q: 如何处理 FFmpeg 依赖？

**A**: FFmpeg 是外部程序，需要：
1. 确保系统已安装 FFmpeg
2. FFmpeg 在 PATH 环境变量中
3. 可以通过 `ffmpeg -version` 验证

### Q: 支持哪些 Node.js 版本？

**A**: Node.js 18+ （使用 ES Modules）

### Q: 可以在浏览器中使用吗？

**A**: 不可以。此工具依赖 Node.js 的 `fs`、`child_process` 等模块，只能在 Node.js 环境运行。

## 集成检查清单

- [ ] 复制 `src/` 目录到项目中
- [ ] 配置 TypeScript 路径映射（可选）
- [ ] 安装 `@types/node` 和 `typescript`
- [ ] 确认 FFmpeg 已安装
- [ ] 测试基本转换功能
- [ ] 测试错误处理
- [ ] 添加到版本控制（如果需要）

## 示例项目结构

```
你的 VSCode 插件/
├── src/
│   ├── extension.ts              # 插件入口
│   ├── commands/
│   │   └── convertVideo.ts      # 转换命令
│   └── video-converter/          # 集成的转换器
│       ├── converter.ts
│       ├── parser.ts
│       ├── models.ts
│       ├── errors.ts
│       ├── ffmpeg-builder.ts
│       ├── ffmpeg-executor.ts
│       ├── index.ts
│       └── postprocess/
│           ├── avi-aligner.ts
│           ├── mjpeg-packer.ts
│           ├── h264-packer.ts
│           └── index.ts
├── package.json
└── tsconfig.json
```

## 使用示例（VSCode 插件）

```typescript
// src/commands/convertVideo.ts
import * as vscode from 'vscode';
import { VideoConverter, OutputFormat } from '../video-converter';

export async function convertVideoCommand() {
  // 选择文件
  const files = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { '视频文件': ['mp4', 'avi', 'mov'] }
  });
  
  if (!files || files.length === 0) return;
  
  const inputPath = files[0].fsPath;
  const outputPath = inputPath.replace(/\.[^.]+$/, '.avi');
  
  // 显示进度
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '视频转换中'
  }, async (progress) => {
    const converter = new VideoConverter((current, total) => {
      const percent = (current / total * 100).toFixed(1);
      progress.report({ message: `${percent}%` });
    });
    
    await converter.convert(inputPath, outputPath, OutputFormat.AVI_MJPEG);
  });
  
  vscode.window.showInformationMessage('转换完成！');
}
```

## 技术支持

- **GitHub**: https://github.com/Belief997/w01-video_converter
- **Issues**: https://github.com/Belief997/w01-video_converter/issues
- **npm 包**: https://www.npmjs.com/package/@belief997/video-converter

## 许可证

MIT - 可自由使用、修改和分发
