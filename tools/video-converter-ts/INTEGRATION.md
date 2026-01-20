# 集成指南 - VSCode 插件集成

本文档说明如何将 `@belief997/video-converter` 集成到 VSCode 插件项目中。

## 快速开始

### 1. 安装依赖

在你的 VSCode 插件项目根目录：

```bash
npm install @belief997/video-converter
```

### 2. 基本使用

```typescript
import * as vscode from 'vscode';
import { VideoConverter, OutputFormat } from '@belief997/video-converter';

export async function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('extension.convertVideo', async () => {
    // 创建转换器实例
    const converter = new VideoConverter((current, total) => {
      // 显示进度
      vscode.window.showInformationMessage(`转换进度: ${current}/${total}`);
    });

    try {
      // 转换视频
      const result = await converter.convert(
        '/path/to/input.mp4',
        '/path/to/output.avi',
        OutputFormat.AVI_MJPEG
      );

      vscode.window.showInformationMessage('转换成功！');
    } catch (error) {
      vscode.window.showErrorMessage(`转换失败: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}
```

## 完整集成示例

### 带进度条的转换

```typescript
import * as vscode from 'vscode';
import { VideoConverter, OutputFormat, ConversionOptions } from '@belief997/video-converter';

export async function convertVideoWithProgress(
  inputPath: string,
  outputPath: string,
  format: OutputFormat,
  options?: ConversionOptions
): Promise<void> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '视频转换中',
      cancellable: false
    },
    async (progress) => {
      const converter = new VideoConverter((current, total) => {
        const percentage = Math.round((current / total) * 100);
        progress.report({
          message: `${percentage}% (${current}/${total} 帧)`,
          increment: 100 / total
        });
      });

      try {
        const result = await converter.convert(inputPath, outputPath, format, options);
        vscode.window.showInformationMessage(
          `转换成功！输出: ${result.outputPath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`转换失败: ${error.message}`);
        throw error;
      }
    }
  );
}
```

### 文件选择和转换

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { VideoConverter, OutputFormat } from '@belief997/video-converter';

export async function selectAndConvertVideo(): Promise<void> {
  // 选择输入文件
  const inputFiles = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: {
      '视频文件': ['mp4', 'avi', 'mov', 'mkv', 'flv']
    },
    title: '选择要转换的视频文件'
  });

  if (!inputFiles || inputFiles.length === 0) {
    return;
  }

  const inputPath = inputFiles[0].fsPath;

  // 选择输出格式
  const formatChoice = await vscode.window.showQuickPick(
    [
      { label: 'MJPEG', value: OutputFormat.MJPEG, extension: '.mjpeg' },
      { label: 'AVI-MJPEG', value: OutputFormat.AVI_MJPEG, extension: '.avi' },
      { label: 'H264', value: OutputFormat.H264, extension: '.h264' }
    ],
    { placeHolder: '选择输出格式' }
  );

  if (!formatChoice) {
    return;
  }

  // 生成输出路径
  const inputDir = path.dirname(inputPath);
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(inputDir, `${inputName}_converted${formatChoice.extension}`);

  // 执行转换
  await convertVideoWithProgress(inputPath, outputPath, formatChoice.value);
}
```

### 获取视频信息

```typescript
import * as vscode from 'vscode';
import { VideoConverter } from '@belief997/video-converter';

export async function showVideoInfo(filePath: string): Promise<void> {
  const converter = new VideoConverter();

  try {
    const info = await converter.getVideoInfo(filePath);

    const message = `
视频信息:
- 分辨率: ${info.width}x${info.height}
- 帧率: ${info.frameRate.toFixed(2)} fps
- 总帧数: ${info.frameCount}
- 时长: ${info.duration.toFixed(2)} 秒
- 编码: ${info.codec}
    `.trim();

    vscode.window.showInformationMessage(message, { modal: true });
  } catch (error) {
    vscode.window.showErrorMessage(`获取视频信息失败: ${error.message}`);
  }
}
```

## TypeScript 类型定义

包已包含完整的 TypeScript 类型定义，你可以获得完整的类型提示：

```typescript
import {
  VideoConverter,      // 主转换器类
  OutputFormat,        // 输出格式枚举
  VideoInfo,           // 视频信息接口
  ConversionResult,    // 转换结果接口
  ConversionOptions,   // 转换选项接口
  // 错误类型
  VideoConverterError,
  VideoFormatError,
  FFmpegNotFoundError,
  FFmpegError,
  PostProcessError
} from '@belief997/video-converter';
```

### 类型示例

```typescript
// VideoInfo 类型
interface VideoInfo {
  width: number;
  height: number;
  frameRate: number;
  frameCount: number;
  duration: number;
  codec: string;
  filePath: string;
}

// ConversionResult 类型
interface ConversionResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  outputFormat: OutputFormat;
  frameCount: number;
  frameRate: number;
  quality: number;
  errorMessage?: string;
}

// ConversionOptions 类型
interface ConversionOptions {
  frameRate?: number;  // 目标帧率
  quality?: number;    // 质量参数
  debug?: boolean;     // 调试模式
}

// OutputFormat 枚举
enum OutputFormat {
  MJPEG = 'mjpeg',
  AVI_MJPEG = 'avi_mjpeg',
  H264 = 'h264'
}
```

## 错误处理

```typescript
import {
  VideoConverter,
  VideoFormatError,
  FFmpegNotFoundError,
  FFmpegError
} from '@belief997/video-converter';

async function safeConvert(inputPath: string, outputPath: string) {
  const converter = new VideoConverter();

  try {
    const result = await converter.convert(
      inputPath,
      outputPath,
      OutputFormat.AVI_MJPEG
    );
    return result;
  } catch (error) {
    if (error instanceof FFmpegNotFoundError) {
      vscode.window.showErrorMessage(
        'FFmpeg 未安装或未在 PATH 中。请先安装 FFmpeg。',
        '查看安装指南'
      ).then(selection => {
        if (selection === '查看安装指南') {
          vscode.env.openExternal(vscode.Uri.parse('https://ffmpeg.org/download.html'));
        }
      });
    } else if (error instanceof VideoFormatError) {
      vscode.window.showErrorMessage(`不支持的视频格式: ${error.message}`);
    } else if (error instanceof FFmpegError) {
      vscode.window.showErrorMessage(`FFmpeg 执行失败: ${error.message}`);
    } else {
      vscode.window.showErrorMessage(`转换失败: ${error.message}`);
    }
    throw error;
  }
}
```

## 配置选项

你可以在插件的 `package.json` 中添加配置项：

```json
{
  "contributes": {
    "configuration": {
      "title": "Video Converter",
      "properties": {
        "videoConverter.defaultFormat": {
          "type": "string",
          "enum": ["mjpeg", "avi_mjpeg", "h264"],
          "default": "avi_mjpeg",
          "description": "默认输出格式"
        },
        "videoConverter.defaultQuality": {
          "type": "number",
          "default": 2,
          "minimum": 1,
          "maximum": 31,
          "description": "默认质量参数 (MJPEG: 1-31)"
        },
        "videoConverter.debugMode": {
          "type": "boolean",
          "default": false,
          "description": "启用调试模式（保留中间文件）"
        }
      }
    }
  }
}
```

在代码中读取配置：

```typescript
const config = vscode.workspace.getConfiguration('videoConverter');
const defaultFormat = config.get<string>('defaultFormat', 'avi_mjpeg');
const defaultQuality = config.get<number>('defaultQuality', 2);
const debugMode = config.get<boolean>('debugMode', false);

const options: ConversionOptions = {
  quality: defaultQuality,
  debug: debugMode
};
```

## 系统要求检查

在插件激活时检查 FFmpeg 是否可用：

```typescript
import { VideoConverter } from '@belief997/video-converter';

export async function activate(context: vscode.ExtensionContext) {
  // 检查 FFmpeg 是否可用
  const converter = new VideoConverter();
  
  try {
    // 尝试获取一个测试视频的信息（如果有的话）
    // 或者直接尝试转换，捕获 FFmpegNotFoundError
  } catch (error) {
    if (error.name === 'FFmpegNotFoundError') {
      const choice = await vscode.window.showWarningMessage(
        'FFmpeg 未安装。视频转换功能将不可用。',
        '安装 FFmpeg',
        '忽略'
      );
      
      if (choice === '安装 FFmpeg') {
        vscode.env.openExternal(vscode.Uri.parse('https://ffmpeg.org/download.html'));
      }
    }
  }

  // 注册命令...
}
```

## 打包和发布

### 1. 确保依赖正确

在 `package.json` 中：

```json
{
  "dependencies": {
    "@belief997/video-converter": "^1.0.0"
  }
}
```

### 2. 构建插件

```bash
npm install
vsce package
```

### 3. 依赖打包

`@belief997/video-converter` 会自动被打包到 `.vsix` 文件中，用户安装插件时不需要单独安装。

### 4. 测试打包结果

```bash
# 安装打包后的插件
code --install-extension your-extension-0.0.1.vsix

# 测试功能
```

## 性能优化建议

### 1. 复用转换器实例

```typescript
// 不推荐：每次都创建新实例
async function convert1() {
  const converter = new VideoConverter();
  await converter.convert(...);
}

async function convert2() {
  const converter = new VideoConverter();
  await converter.convert(...);
}

// 推荐：复用实例
class VideoService {
  private converter: VideoConverter;

  constructor() {
    this.converter = new VideoConverter((current, total) => {
      // 统一的进度处理
    });
  }

  async convert(input: string, output: string, format: OutputFormat) {
    return this.converter.convert(input, output, format);
  }
}
```

### 2. 异步处理

转换操作是异步的，不会阻塞 UI：

```typescript
// 在后台执行转换
vscode.window.withProgress({
  location: vscode.ProgressLocation.Window,
  title: '后台转换中'
}, async () => {
  await converter.convert(...);
});
```

## 常见问题

### Q: 用户需要安装 FFmpeg 吗？

**A**: 是的。`@belief997/video-converter` 依赖系统中的 FFmpeg。你需要在插件文档中说明这一点，并提供安装指南链接。

### Q: 如何处理大文件转换？

**A**: 使用进度回调和 VSCode 的进度 API，让用户知道转换正在进行。转换是异步的，不会阻塞 UI。

### Q: 转换失败如何调试？

**A**: 
1. 启用 `debug: true` 选项保留中间文件
2. 捕获并显示详细错误信息
3. 检查 FFmpeg 是否正确安装

### Q: 包的体积有多大？

**A**: npm 包约 100KB（仅包含编译后的代码），打包到插件后增加的体积很小。

### Q: 支持哪些视频格式作为输入？

**A**: 支持 FFmpeg 支持的所有格式，包括 MP4, AVI, MOV, MKV, FLV 等。

## 技术支持

- **npm 包**: https://www.npmjs.com/package/@belief997/video-converter
- **GitHub**: https://github.com/Belief997/w01-video_converter
- **问题反馈**: https://github.com/Belief997/w01-video_converter/issues

## 更新日志

### 1.0.0 (2026-01-20)
- ✅ 首次发布
- ✅ 支持 MJPEG、AVI-MJPEG、H264 三种格式
- ✅ AVI 8 字节对齐
- ✅ 调试模式
- ✅ 完整的 TypeScript 类型定义
