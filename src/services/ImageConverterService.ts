import * as path from 'path';
import * as fs from 'fs';
import { ImageConverter } from '../../tools/image-converter/converter';
import { PixelFormat } from '../../tools/image-converter/types';
import { RLECompression, FastLzCompression, YUVCompression } from '../../tools/image-converter/compress';
import { ConversionConfigService, ConversionConfig, TargetFormat, CompressionMethod, YuvBlur } from './ConversionConfigService';

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
     * 读取 conversion.json 配置，为每个图片应用其特定的格式和压缩设置
     * @param assetsDir 资源目录
     * @param outputDir 输出目录
     * @param fallbackOptions 回退选项（当没有配置时使用）
     */
    async convertAssetsDir(assetsDir: string, outputDir: string, fallbackOptions?: ImageConvertOptions): Promise<ConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        // 获取项目根目录（assets 的父目录）
        const projectRoot = path.dirname(assetsDir);
        
        // 加载 conversion.json 配置
        const configService = ConversionConfigService.getInstance();
        const config = configService.loadConfig(projectRoot);

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
                    
                    // 为每个图片解析其特定的配置
                    const imageOptions = this.resolveImageOptions(relativePath, fullPath, config, fallbackOptions);
                    items.push({ input: fullPath, output: outputPath, options: imageOptions });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }

    /**
     * 解析单个图片的转换选项
     * @param relativePath 相对于 assets 目录的路径
     * @param fullPath 图片完整路径
     * @param config 转换配置
     * @param fallbackOptions 回退选项
     */
    private resolveImageOptions(
        relativePath: string,
        fullPath: string,
        config: ConversionConfig,
        fallbackOptions?: ImageConvertOptions
    ): ImageConvertOptions {
        const configService = ConversionConfigService.getInstance();
        const resolvedConfig = configService.resolveEffectiveConfig(relativePath, config);
        
        // 检查图片是否有透明度（用于自适应格式）
        const hasAlpha = this.checkImageHasAlpha(fullPath);
        
        // 解析格式（处理自适应格式）
        let format = resolvedConfig.format;
        const itemSettings = config.items[relativePath.replace(/\\/g, '/')];
        const effectiveFormat = itemSettings?.format || config.defaultSettings.format || 'adaptive16';
        
        if (effectiveFormat === 'adaptive16' || effectiveFormat === 'adaptive24') {
            format = configService.resolveAdaptiveFormat(effectiveFormat, hasAlpha);
        }
        
        // 构建选项
        const options: ImageConvertOptions = {
            format: format.toLowerCase(),
            compression: resolvedConfig.compression as CompressionType
        };
        
        // 如果是 YUV 压缩，添加 YUV 参数
        if (resolvedConfig.compression === 'yuv' && resolvedConfig.yuvParams) {
            options.yuvSampleMode = resolvedConfig.yuvParams.sampling.toLowerCase() as YuvSampleMode;
            options.yuvBlurBits = this.parseYuvBlurBits(resolvedConfig.yuvParams.blur);
            options.yuvFastlz = resolvedConfig.yuvParams.fastlzSecondary;
        }
        
        // 如果配置为 adaptive 压缩，使用回退选项或默认不压缩
        if (resolvedConfig.compression === 'adaptive') {
            // TODO: 实现自适应压缩选择逻辑
            // 目前先使用回退选项或不压缩
            if (fallbackOptions?.compression) {
                options.compression = fallbackOptions.compression;
                options.yuvSampleMode = fallbackOptions.yuvSampleMode;
                options.yuvBlurBits = fallbackOptions.yuvBlurBits;
                options.yuvFastlz = fallbackOptions.yuvFastlz;
            } else {
                options.compression = 'none';
            }
        }
        
        return options;
    }

    /**
     * 检查图片是否包含透明度
     */
    private checkImageHasAlpha(imagePath: string): boolean {
        try {
            // 简单判断：PNG 文件可能有透明度，其他格式通常没有
            const ext = path.extname(imagePath).toLowerCase();
            if (ext !== '.png') {
                return false;
            }
            
            // 读取 PNG 文件头来判断是否有 alpha 通道
            const buffer = fs.readFileSync(imagePath);
            if (buffer.length < 26) {
                return false;
            }
            
            // PNG 签名检查
            const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            for (let i = 0; i < 8; i++) {
                if (buffer[i] !== pngSignature[i]) {
                    return false;
                }
            }
            
            // IHDR chunk 中的 color type 在偏移 25 处
            // Color type 4 = Grayscale with alpha
            // Color type 6 = RGBA
            const colorType = buffer[25];
            return colorType === 4 || colorType === 6;
        } catch (error) {
            // 如果无法读取，假设没有透明度
            return false;
        }
    }

    /**
     * 解析 YUV 模糊位数
     */
    private parseYuvBlurBits(blur: YuvBlur): YuvBlurBits {
        switch (blur) {
            case '1bit': return 1;
            case '2bit': return 2;
            case '4bit': return 4;
            default: return 0;
        }
    }
}
