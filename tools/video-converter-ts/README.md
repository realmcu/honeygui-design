# Video Converter TypeScript

视频转换工具 - TypeScript 实现版本，支持多种输出格式。

[![npm version](https://img.shields.io/npm/v/@belief997/video-converter.svg)](https://www.npmjs.com/package/@belief997/video-converter)
[![npm downloads](https://img.shields.io/npm/dm/@belief997/video-converter.svg)](https://www.npmjs.com/package/@belief997/video-converter)

## 文档导航

- 📖 **[README.md](./README.md)** - 完整使用文档（当前文档）
- 🚀 **[QUICK_START.md](./QUICK_START.md)** - 5 分钟快速开始
- 🔧 **[INTEGRATION.md](./INTEGRATION.md)** - VSCode 插件集成指南
- 📦 **[PUBLISH.md](./PUBLISH.md)** - npm 发布说明

## 功能特性

- 支持三种输出格式：MJPEG、AVI-MJPEG、H264
- 自动检测视频信息（分辨率、帧率、时长等）
- 进度显示
- AVI 文件 8 字节对齐处理
- H264 自定义头部封装
- 已发布到 npm，可作为依赖包使用
- 完整的 TypeScript 类型定义

## 系统要求

- Node.js 18+
- FFmpeg（需要在系统 PATH 中可用）

## 安装

### 作为 npm 包安装（推荐）

```bash
npm install @belief997/video-converter
```

### 从源码安装

```bash
cd video-converter-ts
npm install
npm run build
```

## 使用方法

### 作为 npm 包使用（推荐）

安装后直接在代码中导入：

```typescript
import { VideoConverter, OutputFormat } from '@belief997/video-converter';

// 创建转换器实例（可选进度回调）
const converter = new VideoConverter((current, total) => {
  console.log(`进度: ${current}/${total}`);
});

// 获取视频信息
const info = await converter.getVideoInfo('input.mp4');
console.log(info);

// 转换视频
const result = await converter.convert(
  'input.mp4',
  'output.avi',
  OutputFormat.AVI_MJPEG,
  { 
    frameRate: 25,  // 可选：目标帧率
    quality: 2,     // 可选：质量参数
    debug: false    // 可选：调试模式
  }
);

console.log('转换完成:', result);
```

### 命令行工具使用

#### 从 npm 包运行 #### 从 npm 包运行

如果全局安装：
```bash
npm install -g @belief997/video-converter
video-converter --info -i input.mp4
```

如果本地安装：
```bash
npx @belief997/video-converter --info -i input.mp4
```

#### 从源码运行

查看视频信息

```bash
node dist/cli.js --info -i <输入视频路径>
```

示例：
```bash
node dist/cli.js --info -i ../test_video/birds.mp4
```

### 视频转换

基本语法：
```bash
node dist/cli.js -i <输入文件> -o <输出文件> -f <格式> [选项]
```

#### 支持的格式

| 格式 | 参数值 | 说明 |
|------|--------|------|
| MJPEG | `mjpeg` | Motion JPEG 格式，连续 JPEG 帧 |
| AVI-MJPEG | `avi_mjpeg` | AVI 容器封装的 MJPEG，8 字节对齐 |
| H264 | `h264` | H.264 裸流，带自定义头部 |

#### 转换示例

转换为 MJPEG：
```bash
node dist/cli.js -i ../test_video/birds.mp4 -o output.mjpeg -f mjpeg -v
```

转换为 AVI-MJPEG：
```bash
node dist/cli.js -i ../test_video/birds.mp4 -o output.avi -f avi_mjpeg -v
```

转换为 H264：
```bash
node dist/cli.js -i ../test_video/birds.mp4 -o output.h264 -f h264 -v
```

#### 命令行参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--input` | `-i` | 输入视频文件路径（必需） |
| `--output` | `-o` | 输出文件路径（必需） |
| `--format` | `-f` | 输出格式：mjpeg, avi_mjpeg, h264（必需） |
| `--fps` | `-r` | 目标帧率（可选，默认保持原帧率） |
| `--quality` | `-q` | 质量参数（可选，MJPEG: 1-31，H264 CRF: 0-51） |
| `--verbose` | `-v` | 显示详细信息 |
| `--debug` | `-d` | 调试模式：保留中间文件 |
| `--info` | | 仅显示视频信息，不转换 |
| `--help` | `-h` | 显示帮助信息 |

### 调试模式

使用 `-d` 或 `--debug` 参数启用调试模式，转换过程中的中间文件将被保留：

```bash
node dist/cli.js -i ../test_video/birds.mp4 -o output.avi -f avi_mjpeg -v -d
```

对于 AVI-MJPEG 转换，调试模式会保留以下文件：
- `output.ffmpeg.avi` - FFmpeg 直接输出（后处理前）
- `output.pass1.avi` - 第一遍对齐后（JUNK 块调整，首帧对齐）
- `output.avi` - 最终输出（所有帧 8 字节对齐）

### 编程接口

完整的 TypeScript API：

```typescript
import { 
  VideoConverter, 
  OutputFormat, 
  VideoInfo,
  ConversionResult,
  ConversionOptions
} from '@belief997/video-converter';

// 创建转换器
const converter = new VideoConverter((current, total) => {
  console.log(`进度: ${current}/${total}`);
});

// 获取视频信息
const info: VideoInfo = await converter.getVideoInfo('input.mp4');
// info 包含: width, height, frameRate, frameCount, duration, codec

// 转换选项
const options: ConversionOptions = {
  frameRate: 25,    // 可选：目标帧率
  quality: 2,       // 可选：MJPEG 质量 (1-31) 或 H264 CRF (0-51)
  debug: false      // 可选：保留中间文件
};

// 转换视频
const result: ConversionResult = await converter.convert(
  'input.mp4',
  'output.avi',
  OutputFormat.AVI_MJPEG,
  options
);

// result 包含: success, inputPath, outputPath, outputFormat, frameCount, frameRate, quality
```

### 在 VSCode 插件中使用

1. **添加依赖**到插件的 `package.json`：
```json
{
  "dependencies": {
    "@belief997/video-converter": "^1.0.0"
  }
}
```

2. **安装依赖**：
```bash
npm install
```

3. **在插件代码中使用**：
```typescript
import { VideoConverter, OutputFormat } from '@belief997/video-converter';

export async function convertVideo(inputPath: string, outputPath: string) {
  const converter = new VideoConverter();
  
  try {
    const result = await converter.convert(
      inputPath,
      outputPath,
      OutputFormat.AVI_MJPEG
    );
    
    return result;
  } catch (error) {
    console.error('转换失败:', error);
    throw error;
  }
}
```

4. **打包插件**：当你构建 `.vsix` 文件时，npm 包会自动被打包进去。

5. **用户安装**：最终用户安装插件时不需要单独安装此工具包。

## 测试

### 运行所有测试

```bash
npm test -- --run
```

### 运行特定测试文件

```bash
npm test -- --run tests/avi-aligner.test.ts
npm test -- --run tests/mjpeg-packer.test.ts
npm test -- --run tests/parser.test.ts
npm test -- --run tests/ffmpeg-builder.test.ts
npm test -- --run tests/ffmpeg-executor.test.ts
```

### 测试覆盖率

```bash
npm test -- --run --coverage
```

## 项目结构

```
video-converter-ts/
├── src/
│   ├── cli.ts              # 命令行入口
│   ├── converter.ts        # 主转换器
│   ├── parser.ts           # 视频信息解析
│   ├── ffmpeg-builder.ts   # FFmpeg 命令构建
│   ├── ffmpeg-executor.ts  # FFmpeg 执行器
│   ├── models.ts           # 数据模型
│   ├── errors.ts           # 错误定义
│   ├── index.ts            # 模块导出
│   └── postprocess/
│       ├── avi-aligner.ts  # AVI 8字节对齐
│       ├── mjpeg-packer.ts # MJPEG 打包
│       ├── h264-packer.ts  # H264 封装
│       └── index.ts
├── tests/
│   ├── avi-aligner.test.ts
│   ├── mjpeg-packer.test.ts
│   ├── parser.test.ts
│   ├── ffmpeg-builder.test.ts
│   ├── ffmpeg-executor.test.ts
│   └── h264-packer.test.ts
├── dist/                   # 编译输出
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 输出格式说明

### MJPEG 格式
- 连续的 JPEG 帧，每帧以 SOI (0xFFD8) 开始，EOI (0xFFD9) 结束
- 仅包含 baseline JPEG 帧

### AVI-MJPEG 格式
- 标准 AVI 容器格式
- 所有帧数据 8 字节对齐（通过 JUNK 块和 APP1 段填充）
- 包含 idx1 索引块

### H264 格式
- 自定义 32 字节头部
- 包含分辨率、帧数、帧时间等信息
- 后跟 H.264 裸流数据

## 常见问题

### FFmpeg 未找到
确保 FFmpeg 已安装并在系统 PATH 中：
```bash
ffmpeg -version
```

### Windows PowerShell 执行策略问题
如果遇到脚本执行问题，可以使用 cmd 包装：
```bash
cmd /c "npm run build"
cmd /c "npm test -- --run"
```

### 如何更新到最新版本
```bash
npm update @belief997/video-converter
```

### 查看已安装版本
```bash
npm list @belief997/video-converter
```

## 发布信息

- **npm 包名**: `@belief997/video-converter`
- **当前版本**: 1.0.0
- **发布日期**: 2026-01-20
- **npm 主页**: https://www.npmjs.com/package/@belief997/video-converter
- **GitHub 仓库**: https://github.com/Belief997/w01-video_converter

## 许可证

MIT
