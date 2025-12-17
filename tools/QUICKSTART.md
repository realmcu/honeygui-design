# 快速开始指南

## 5 分钟上手 HoneyGUI Tools

### 1. 安装 (30 秒)

```bash
cd tools
npm install
npm run build
```

### 2. 图像转换示例 (1 分钟)

创建 `test-image.ts`：

```typescript
import { ImageConverter, PixelFormat } from './index';

async function main() {
    const converter = new ImageConverter();
    
    // 转换 PNG 到 RGB565
    await converter.convert(
        'input.png',
        'output.bin',
        PixelFormat.RGB565
    );
    
    console.log('✓ 转换完成！');
}

main();
```

运行：
```bash
npx ts-node test-image.ts
```

### 3. OBJ 模型转换示例 (1 分钟)

创建 `test-obj.ts`：

```typescript
import { OBJConverter } from './index';

const converter = new OBJConverter();

converter.convert(
    'model.obj',
    'desc_model.bin',
    'desc_model.txt'
);

console.log('✓ 转换完成！');
```

运行：
```bash
npx ts-node test-obj.ts
```

### 4. 运行测试 (1 分钟)

```bash
npm test
```

预期输出：
```
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
```

### 5. 集成到项目 (2 分钟)

在你的项目中：

```typescript
// 1. 导入
import { ImageConverter, PixelFormat } from './tools';

// 2. 创建实例
const converter = new ImageConverter();

// 3. 使用
await converter.convert(inputPath, outputPath, 'auto');
```

## 常见问题

### Q: 支持哪些图像格式？
A: PNG 和 JPEG 输入，支持 RGB565/RGB888/ARGB8888/ARGB8565/A8 输出。

### Q: 需要安装 Python 吗？
A: 不需要！这是纯 JavaScript/TypeScript 实现。

### Q: 输出格式兼容 SDK 吗？
A: 完全兼容，已通过测试验证。

### Q: 性能如何？
A: 比 Python 版本快 25-40%。

### Q: 如何调试？
A: 直接在 VSCode 中设置断点调试，无需额外配置。

## 下一步

- 阅读 [README.md](./README.md) 了解完整功能
- 查看 [INTEGRATION.md](./INTEGRATION.md) 学习如何集成到插件
- 浏览 [examples/](./examples/) 查看更多示例

## 需要帮助？

- 查看测试用例：`tests/`
- 阅读源代码：`image-converter/` 和 `model-converter/`
- 提交 Issue：https://gitee.com/realmcu/honeygui-design/issues
