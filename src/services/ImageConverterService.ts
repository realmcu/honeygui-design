import * as path from 'path';
import * as fs from 'fs';
import { ImageConverter } from '../../tools/image-converter/converter';
import { PixelFormat } from '../../tools/image-converter/types';

export interface ConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export class ImageConverterService {
    private converter: ImageConverter;

    constructor(sdkPath?: string) {
        // SDK path 不再需要，但保留参数以兼容现有代码
        this.converter = new ImageConverter();
    }

    /**
     * Convert a single image to bin format
     */
    async convert(inputPath: string, outputPath: string, format: string = 'auto'): Promise<ConvertResult> {
        try {
            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 转换格式字符串到 PixelFormat
            let pixelFormat: PixelFormat | 'auto' = 'auto';
            if (format !== 'auto') {
                const formatMap: Record<string, PixelFormat> = {
                    'rgb565': PixelFormat.RGB565,
                    'rgb888': PixelFormat.RGB888,
                    'argb8888': PixelFormat.ARGB8888,
                    'argb8565': PixelFormat.ARGB8565,
                    'a8': PixelFormat.A8,
                };
                pixelFormat = formatMap[format.toLowerCase()] || 'auto';
            }

            await this.converter.convert(inputPath, outputPath, pixelFormat);
            return { success: true, inputPath, outputPath };
        } catch (error: any) {
            return { success: false, inputPath, outputPath, error: error.message };
        }
    }

    /**
     * Convert multiple images in batch
     */
    async convertBatch(items: Array<{ input: string; output: string; format?: string }>): Promise<ConvertResult[]> {
        return Promise.all(items.map(item => this.convert(item.input, item.output, item.format || 'auto')));
    }

    /**
     * Convert all images in assets directory to build output
     */
    async convertAssetsDir(assetsDir: string, outputDir: string): Promise<ConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const imageExts = ['.png', '.jpg', '.jpeg'];
        const items: Array<{ input: string; output: string }> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (imageExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const outputPath = path.join(outputDir, relativePath.replace(/\.(png|jpe?g)$/i, '.bin'));
                    items.push({ input: fullPath, output: outputPath });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }
}
