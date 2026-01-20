# 快速开始 - 5 分钟集成指南

## 1. 安装 (30 秒)

```bash
npm install @belief997/video-converter
```

## 2. 导入 (10 秒)

```typescript
import { VideoConverter, OutputFormat } from '@belief997/video-converter';
```

## 3. 使用 (3 分钟)

### 最简单的例子

```typescript
const converter = new VideoConverter();

await converter.convert(
  'input.mp4',      // 输入文件
  'output.avi',     // 输出文件
  OutputFormat.AVI_MJPEG  // 格式
);
```

### 带进度显示

```typescript
const converter = new VideoConverter((current, total) => {
  console.log(`进度: ${current}/${total}`);
});

await converter.convert('input.mp4', 'output.avi', OutputFormat.AVI_MJPEG);
```

### 完整选项

```typescript
const converter = new VideoConverter();

const result = await converter.convert(
  'input.mp4',
  'output.avi',
  OutputFormat.AVI_MJPEG,
  {
    frameRate: 25,   // 可选：目标帧率
    quality: 2,      // 可选：质量 (1-31)
    debug: false     // 可选：调试模式
  }
);

console.log('转换完成:', result);
```

## 4. 输出格式

| 格式 | 枚举值 | 扩展名 | 说明 |
|------|--------|--------|------|
| MJPEG | `OutputFormat.MJPEG` | `.mjpeg` | 连续 JPEG 帧 |
| AVI-MJPEG | `OutputFormat.AVI_MJPEG` | `.avi` | AVI 容器，8 字节对齐 |
| H264 | `OutputFormat.H264` | `.h264` | H.264 裸流 + 自定义头 |

## 5. 错误处理

```typescript
try {
  await converter.convert('input.mp4', 'output.avi', OutputFormat.AVI_MJPEG);
} catch (error) {
  console.error('转换失败:', error.message);
}
```

## 6. 获取视频信息

```typescript
const info = await converter.getVideoInfo('input.mp4');

console.log(`分辨率: ${info.width}x${info.height}`);
console.log(`帧率: ${info.frameRate} fps`);
console.log(`时长: ${info.duration} 秒`);
```

## 完整 API

```typescript
// 导入所有类型
import {
  VideoConverter,      // 转换器类
  OutputFormat,        // 格式枚举
  VideoInfo,           // 视频信息类型
  ConversionResult,    // 转换结果类型
  ConversionOptions    // 转换选项类型
} from '@belief997/video-converter';

// 创建转换器
const converter = new VideoConverter(
  (current, total) => {
    // 可选的进度回调
  }
);

// 获取视频信息
const info: VideoInfo = await converter.getVideoInfo(inputPath);

// 转换视频
const result: ConversionResult = await converter.convert(
  inputPath,
  outputPath,
  format,
  options  // 可选
);
```

## 系统要求

- ✅ Node.js 18+
- ✅ FFmpeg（必须在 PATH 中）

检查 FFmpeg：
```bash
ffmpeg -version
```

## 下一步

- 📖 完整文档: [README.md](./README.md)
- 🔧 集成指南: [INTEGRATION.md](./INTEGRATION.md)
- 📦 发布说明: [PUBLISH.md](./PUBLISH.md)
- 🌐 npm 主页: https://www.npmjs.com/package/@belief997/video-converter

## 需要帮助？

- GitHub Issues: https://github.com/Belief997/w01-video_converter/issues
- npm 包: https://www.npmjs.com/package/@belief997/video-converter
