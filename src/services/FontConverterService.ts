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
}

export interface FontConvertOptions {
    fontSize?: number;
    renderMode?: number;  // 1, 2, 4, 8
    outputFormat?: 'bitmap' | 'vector';
    bold?: boolean;
    italic?: boolean;
    characterSets?: Array<{ type: string; value: string }>;
}

export class FontConverterService {
    constructor() {}

    async convert(inputPath: string, outputPath: string, options?: FontConvertOptions): Promise<FontConvertResult> {
        try {
            if (!fs.existsSync(inputPath)) {
                return { success: false, inputPath, outputPath, error: `输入文件不存在: ${inputPath}` };
            }

            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 构建字符集
            const characterSets: CharacterSetSource[] = options?.characterSets?.map(item => ({
                type: item.type as 'file' | 'codepage' | 'range' | 'string',
                value: item.value
            })) || [{ type: 'range', value: '0x20-0x7E' }];  // 默认 ASCII

            const outputFormat = options?.outputFormat || 'bitmap';

            // 构建配置
            const config: FontConfig = {
                fontPath: inputPath,
                outputPath: outputPath,
                fontSize: options?.fontSize || 32,
                renderMode: (options?.renderMode || 4) as RenderMode,
                bold: options?.bold || false,
                italic: options?.italic || false,
                rotation: Rotation.ROTATE_0,
                gamma: 1.0,
                indexMethod: IndexMethod.OFFSET,
                crop: false,
                characterSets,
                outputFormat
            };

            // 根据输出格式选择生成器
            if (outputFormat === 'vector') {
                const generator = new VectorFontGenerator(config);
                await generator.generate();
            } else {
                const generator = new BitmapFontGenerator(config);
                await generator.generate();
            }

            return { success: true, inputPath, outputPath };
        } catch (error: any) {
            return { success: false, inputPath, outputPath, error: error.message };
        }
    }
}
