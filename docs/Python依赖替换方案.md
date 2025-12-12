# Python 依赖替换方案

## 背景

当前插件依赖 SDK 中的 Python 脚本，用户需要安装 Python 和相关包（如 Pillow），增加了使用门槛。

## 现有 Python 依赖

| 脚本 | 位置 | 功能 | Python 依赖 |
|------|------|------|-------------|
| image_converter.py | SDK/tool/image-convert-tool/ | 图片转 .bin | Pillow |
| mkromfs_for_honeygui.py | SDK/tool/mkromfs/ | 生成 romfs 文件系统 | 无 |
| extract_desc_v3.py | SDK/tool/3D-tool/ | 3D 模型转换 | numpy |

## 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Node.js 重写** | 用户零配置，性能好 | 需要开发工作量 |
| **PyInstaller 打包** | 改动小 | 体积大，需多平台打包 |
| **requirements.txt 自动安装** | 简单 | 用户需要 Python 环境 |

## 推荐方案：Node.js 重写

### 代码结构

```
src/
├── services/
│   ├── ImageConverterService.ts   # 现有（调用 Python）
│   └── Model3DConverterService.ts # 现有（调用 Python）
├── converters/                    # 新增（Node.js 原生实现）
│   ├── ImageConverter.ts          # 用 sharp 库
│   ├── RomfsGenerator.ts          # 纯 JS 实现
│   └── Model3DConverter.ts        # 解析 OBJ
└── ...
```

### 依赖替换

| Python | Node.js 替代 |
|--------|-------------|
| Pillow | `sharp` - 高性能图片处理库 |
| numpy | 纯 JS 或 `ndarray` |
| 文件操作 | Node.js fs 模块 |

### 实现示例

**图片转换（ImageConverter.ts）**：
```typescript
import sharp from 'sharp';

export class ImageConverter {
    async convert(input: string, output: string, format: ImageFormat): Promise<void> {
        const image = sharp(input);
        const metadata = await image.metadata();
        
        // 获取原始像素数据
        const { data, info } = await image
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        // 转换为 HoneyGUI 格式并写入 .bin 文件
        const binData = this.convertToHoneyGuiFormat(data, info, format);
        await fs.promises.writeFile(output, binData);
    }
    
    private convertToHoneyGuiFormat(
        data: Buffer, 
        info: sharp.OutputInfo, 
        format: ImageFormat
    ): Buffer {
        // 根据 format 转换像素格式
        // RGB565, ARGB8888, etc.
    }
}
```

**Romfs 生成（RomfsGenerator.ts）**：
```typescript
export class RomfsGenerator {
    async generate(inputDir: string, outputFile: string): Promise<void> {
        const files = await this.collectFiles(inputDir);
        const romfs = this.buildRomfsImage(files);
        await fs.promises.writeFile(outputFile, romfs);
    }
    
    private buildRomfsImage(files: FileEntry[]): Buffer {
        // 按照 romfs 格式打包文件
        // 参考 SDK 中 mkromfs_for_honeygui.py 的实现
    }
}
```

### npm 依赖

```json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

`sharp` 特点：
- 自动下载预编译二进制，用户无需编译
- 跨平台支持（Windows/Linux/macOS）
- 性能优于 Pillow

### 迁移步骤

1. **第一阶段：图片转换**
   - 实现 `ImageConverter.ts`
   - 修改 `ImageConverterService.ts` 使用新实现
   - 测试各种图片格式转换

2. **第二阶段：Romfs 生成**
   - 实现 `RomfsGenerator.ts`
   - 修改 `BuildCore.ts` 使用新实现

3. **第三阶段：3D 模型转换**
   - 实现 `Model3DConverter.ts`
   - 修改 `Model3DConverterService.ts`

4. **清理**
   - 移除 Python 相关检查代码
   - 更新文档

### 优点

1. **用户零配置** - 安装插件即可使用
2. **性能更好** - sharp 是 C++ 实现
3. **维护简单** - 代码集中在插件项目
4. **跨平台** - npm 自动处理平台差异
5. **离线友好** - 符合项目离线优先原则

## 备选方案：自动安装 Python 依赖

如果暂时没时间重写，可以先实现自动安装：

```typescript
// PythonEnvironmentChecker.ts
async checkAndInstallDependencies(sdkPath: string): Promise<boolean> {
    const requirementsFile = path.join(sdkPath, 'tool', 'requirements.txt');
    
    if (!await this.isPythonInstalled()) {
        vscode.window.showErrorMessage('请先安装 Python 3.x');
        return false;
    }
    
    if (await this.areDependenciesInstalled()) {
        return true;
    }
    
    const choice = await vscode.window.showWarningMessage(
        'HoneyGUI 需要安装 Python 依赖包，是否自动安装？',
        '安装', '取消'
    );
    
    if (choice === '安装') {
        // 使用国内镜像
        await spawn('pip', [
            'install', '-r', requirementsFile,
            '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple'
        ]);
        return true;
    }
    
    return false;
}
```

## 参考资料

- [sharp 文档](https://sharp.pixelplumbing.com/)
- SDK 图片转换脚本：`~/.HoneyGUI-SDK/tool/image-convert-tool/image_converter.py`
- SDK romfs 脚本：`~/.HoneyGUI-SDK/tool/mkromfs/mkromfs_for_honeygui.py`
