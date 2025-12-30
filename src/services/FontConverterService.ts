import * as path from 'path';
import * as fs from 'fs';
import { BitmapFontGenerator } from '../../tools/font-converter/src/bitmap-generator';
import { VectorFontGenerator } from '../../tools/font-converter/src/vector-generator';
import { FontConfig, CharacterSetSource } from '../../tools/font-converter/src/types/config';
import { RenderMode, Rotation, IndexMethod } from '../../tools/font-converter/src/types/enums';

export interface FontConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
    processedCount?: number;
    failedCount?: number;
}

export interface CharacterSetItem {
    type: 'range' | 'file' | 'codepage' | 'string';
    value: string;
}

export interface FontConvertOptions {
    fontSize: number;
    renderMode: number;  // 1, 2, 4, 8
    outputFormat: 'bitmap' | 'vector';
    bold?: boolean;
    italic?: boolean;
    characterSets: CharacterSetItem[];  // 多个字符集源，取并集
}

export class FontConverterService {
    constructor() {}

    /**
     * 转换单个字体文件
     */
    async convert(inputPath: string, outputDir: string, options: FontConvertOptions): Promise<FontConvertResult> {
        try {
            // 确保输出目录存在
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 构建字符集 - 直接使用传入的字符集配置
            const characterSets: CharacterSetSource[] = options.characterSets.map(item => ({
                type: item.type,
                value: item.value
            }));

            // 如果没有字符集，默认使用 ASCII
            if (characterSets.length === 0) {
                characterSets.push({ type: 'range', value: '0x20-0x7E' });
            }

            // 构建配置
            const config: FontConfig = {
                fontPath: inputPath,
                outputPath: outputDir,
                fontSize: options.fontSize,
                renderMode: this.parseRenderMode(options.renderMode),
                bold: options.bold || false,
                italic: options.italic || false,
                rotation: Rotation.ROTATE_0,
                gamma: 1.0,
                indexMethod: IndexMethod.ADDRESS,
                crop: false,
                characterSets,
                outputFormat: options.outputFormat
            };

            // 创建生成器并执行
            const generator = options.outputFormat === 'vector'
                ? new VectorFontGenerator(config)
                : new BitmapFontGenerator(config);

            await generator.generate();

            const processed = generator.getProcessedCharacters();
            const failed = generator.getFailedCharacters();

            generator.cleanup();

            return {
                success: true,
                inputPath,
                outputPath: outputDir,
                processedCount: processed.length,
                failedCount: failed.length
            };
        } catch (error: any) {
            return {
                success: false,
                inputPath,
                outputPath: outputDir,
                error: error.message
            };
        }
    }

    /**
     * 解析渲染模式
     */
    private parseRenderMode(mode: number): RenderMode {
        switch (mode) {
            case 1: return RenderMode.BIT_1;
            case 2: return RenderMode.BIT_2;
            case 4: return RenderMode.BIT_4;
            case 8: return RenderMode.BIT_8;
            default: return RenderMode.BIT_4;
        }
    }

    /**
     * 批量转换
     */
    async convertBatch(items: Array<{ input: string; outputDir: string; options: FontConvertOptions }>): Promise<FontConvertResult[]> {
        return Promise.all(items.map(item => this.convert(item.input, item.outputDir, item.options)));
    }
}
