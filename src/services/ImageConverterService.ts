import * as path from 'path';
import * as fs from 'fs';
import { ImageConverter } from '../../tools/image-converter/converter';
import { PixelFormat } from '../../tools/image-converter/types';
import { RLECompression, FastLzCompression, YUVCompression } from '../../tools/image-converter/compress';

export type CompressionType = 'none' | 'rle' | 'fastlz' | 'yuv';
export type YuvSampleMode = 'yuv444' | 'yuv422' | 'yuv411';
export type YuvBlurBits = 0 | 1 | 2 | 4;

export interface ImageConvertOptions {
    format?: string;
    compression?: CompressionType;
    yuvSampleMode?: YuvSampleMode;
    yuvBlurBits?: YuvBlurBits;
    yuvFastlz?: boolean;
}

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
    async convert(inputPath: string, outputPath: string, options: string | ImageConvertOptions = 'auto'): Promise<ConvertResult> {
        try {
            // 兼容旧的字符串参数
            const opts: ImageConvertOptions = typeof options === 'string' 
                ? { format: options } 
                : options;
            
            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 转换格式字符串到 PixelFormat
            let pixelFormat: PixelFormat | 'auto' = 'auto';
            if (opts.format && opts.format !== 'auto') {
                const formatMap: Record<string, PixelFormat> = {
                    'rgb565': PixelFormat.RGB565,
                    'rgb888': PixelFormat.RGB888,
                    'argb8888': PixelFormat.ARGB8888,
                    'argb8565': PixelFormat.ARGB8565,
                    'a8': PixelFormat.A8,
                    'i8': PixelFormat.I8,
                };
                pixelFormat = formatMap[opts.format.toLowerCase()] || 'auto';
            }

            // 设置压缩算法
            if (opts.compression && opts.compression !== 'none') {
                switch (opts.compression) {
                    case 'rle':
                        this.converter.setCompressor(new RLECompression());
                        break;
                    case 'fastlz':
                        this.converter.setCompressor(new FastLzCompression());
                        break;
                    case 'yuv':
                        this.converter.setCompressor(new YUVCompression(
                            opts.yuvSampleMode || 'yuv422',
                            opts.yuvBlurBits || 0,
                            opts.yuvFastlz || false
                        ));
                        break;
                }
            } else {
                this.converter.setCompressor(undefined);
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
    async convertBatch(items: Array<{ input: string; output: string; options?: ImageConvertOptions }>): Promise<ConvertResult[]> {
        return Promise.all(items.map(item => this.convert(item.input, item.output, item.options || 'auto')));
    }

    /**
     * Convert all images in assets directory to build output
     * @param assetsDir 资源目录
     * @param outputDir 输出目录
     * @param options 转换选项（压缩配置等）
     */
    async convertAssetsDir(assetsDir: string, outputDir: string, options?: ImageConvertOptions): Promise<ConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const imageExts = ['.png', '.jpg', '.jpeg', '.bmp'];
        const items: Array<{ input: string; output: string; options?: ImageConvertOptions }> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (imageExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const outputPath = path.join(outputDir, relativePath.replace(/\.(png|jpe?g|bmp)$/i, '.bin'));
                    items.push({ input: fullPath, output: outputPath, options });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }
}
