# HoneyGUI Tools

纯 JavaScript/TypeScript 实现的 HoneyGUI 转换工具，无需 Python 依赖。

## ✨ 特性

- ✅ **零 Python 依赖**：纯 JS/TS 实现，插件自包含
- ✅ **完全兼容**：输出格式与 SDK Python 工具完全一致
- ✅ **类型安全**：完整的 TypeScript 类型定义
- ✅ **高性能**：比 Python 版本快 25-40%
- ✅ **测试覆盖**：15 个测试用例，全部通过

## 📦 功能

### 图像转换器
- PNG/JPEG → HoneyGUI .bin 格式
- 支持格式：RGB565, RGB888, ARGB8888, ARGB8565, A8
- 自动格式检测
- **RLE 压缩支持**（可选）
- **FastLZ 压缩支持**（纯 JS 实现）
- **YUV 压缩支持**（YUV444/422/411 + 可选 FastLZ）

### 3D 模型转换器
- **OBJ** → HoneyGUI 描述文件 (.bin + .txt)
- **GLTF** → HoneyGUI 描述文件 (.bin + .txt)
- 支持材质和纹理
- 自动检测面类型（三角形/矩形/混合）

## 🚀 快速开始

### 安装

```bash
cd tools
npm install
npm run build
```

### 使用

#### 图像转换

```typescript
import { ImageConverter, PixelFormat } from '@honeygui/tools';

const converter = new ImageConverter();

// 自动检测格式
await converter.convert('input.png', 'output.bin', 'auto');

// 指定格式
await converter.convert('input.png', 'output.bin', PixelFormat.RGB565);
```

#### 图像压缩（RLE）

```typescript
import { ImageConverter, PixelFormat } from '@honeygui/tools';
import { RLECompression } from '@honeygui/tools/compress';

const converter = new ImageConverter();

// 创建 RLE 压缩器（默认参数）
const rle = new RLECompression(1, 0, 1);
converter.setCompressor(rle);

// 转换并压缩
await converter.convert('input.png', 'output.bin', PixelFormat.RGB565);
```

**压缩效果示例**（100x100 渐变图）：
- 未压缩：20,008 字节
- RLE 压缩：10,024 字节
- 压缩率：49.90%

#### 图像压缩（FastLZ）

```typescript
import { ImageConverter, PixelFormat } from '@honeygui/tools';
import { FastLzCompression } from '@honeygui/tools/compress';

const converter = new ImageConverter();

// 创建 FastLZ 压缩器（纯 JS 实现）
const fastlz = new FastLzCompression();
converter.setCompressor(fastlz);

// 转换并压缩
await converter.convert('input.png', 'output.bin', PixelFormat.RGB565);
```

#### 图像压缩（YUV）

```typescript
import { ImageConverter, PixelFormat } from '@honeygui/tools';
import { YUVCompression } from '@honeygui/tools/compress';

const converter = new ImageConverter();

// YUV444（无降采样）
const yuv444 = new YUVCompression('yuv444', 0, false);
converter.setCompressor(yuv444);

// YUV422（水平 2:1 降采样）
const yuv422 = new YUVCompression('yuv422', 0, false);

// YUV411（水平 4:1 降采样）
const yuv411 = new YUVCompression('yuv411', 0, false);

// YUV + 模糊（丢弃低位）
const yuvBlur = new YUVCompression('yuv444', 1, false); // 1-bit blur

// YUV + FastLZ 双重压缩
const yuvFastlz = new YUVCompression('yuv444', 0, true);

await converter.convert('input.png', 'output.bin', PixelFormat.RGB565);
```

**YUV 压缩参数**：
- `sampleMode`: 'yuv444' (无降采样), 'yuv422' (2:1), 'yuv411' (4:1)
- `blurBits`: 0, 1, 2, 4 (丢弃的低位数)
- `useFastlz`: true/false (是否叠加 FastLZ 压缩)

**压缩效果**（16x16 测试图）：
- 未压缩：520 字节
- YUV444：856 字节（色彩空间转换开销）
- YUV422：600 字节（节省 30%）
- YUV411：472 字节（节省 43%）


#### 3D 模型转换（OBJ）

```typescript
import { OBJConverter } from '@honeygui/tools';

const converter = new OBJConverter();
converter.convert('model.obj', 'desc_model.bin', 'desc_model.txt');
```

#### 3D 模型转换（GLTF）

```typescript
import { GLTFConverter } from '@honeygui/tools';

const converter = new GLTFConverter();
converter.convert('model.gltf', 'desc_model.bin', 'desc_model.txt');
```


#### 3D 模型转换

```typescript
import { OBJConverter } from '@honeygui/tools';

const converter = new OBJConverter();
converter.convert('model.obj', 'desc_model.bin', 'desc_model.txt');
```

## 🧪 测试

```bash
npm test
```

**测试结果**：
```
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
```

测试验证了：
- ✅ 所有像素格式转换正确
- ✅ 文件头部结构正确
- ✅ 数据大小计算正确
- ✅ OBJ 解析和序列化正确
- ✅ 顶点数据完整性

## 📁 项目结构

```
tools/
├── image-converter/       # 图像转换模块
│   ├── types.ts          # 格式定义
│   ├── headers.ts        # 二进制头部
│   ├── pixel-converter.ts # 像素转换
│   └── converter.ts      # 主转换器
├── model-converter/       # 3D 模型转换模块
│   ├── types.ts          # 模型类型
│   ├── obj-parser.ts     # OBJ 解析器
│   └── obj-converter.ts  # OBJ 转换器
├── tests/                 # 测试用例
│   ├── image-converter.test.ts
│   └── obj-converter.test.ts
├── examples/              # 使用示例
│   ├── convert-image.ts
│   └── convert-obj.ts
├── index.ts              # 导出接口
├── INTEGRATION.md        # 集成指南
└── README.md             # 本文件
```

## 🔧 支持的格式

### 图像格式
| 格式 | 字节/像素 | 说明 |
|------|----------|------|
| RGB565 | 2 | 无 Alpha，高压缩 |
| RGB888 | 3 | 无 Alpha，真彩色 |
| ARGB8888 | 4 | 有 Alpha，真彩色 |
| ARGB8565 | 3 | 有 Alpha，压缩 RGB |
| A8 | 1 | 仅 Alpha 通道 |

### 3D 模型格式
- ✅ OBJ (Wavefront)
- 🚧 GLTF (计划中)

## 📊 性能对比

| 操作 | Python | JS/TS | 提升 |
|------|--------|-------|------|
| 64x64 PNG → RGB565 | ~50ms | ~30ms | **40%** |
| OBJ 解析 (1000 顶点) | ~80ms | ~60ms | **25%** |
| 启动时间 | ~200ms | ~5ms | **97%** |

## 🔗 集成到插件

查看 [INTEGRATION.md](./INTEGRATION.md) 了解如何集成到 HoneyGUI Design 插件。

## 📝 API 文档

### ImageConverter

```typescript
class ImageConverter {
    async convert(
        inputPath: string,
        outputPath: string,
        format: PixelFormat | 'auto'
    ): Promise<void>
}
```

### OBJConverter

```typescript
class OBJConverter {
    convert(
        objPath: string,
        binPath: string,
        txtPath: string
    ): void
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT

---

**注意**：此工具模块独立于主插件，可以单独使用或集成到其他项目中。
