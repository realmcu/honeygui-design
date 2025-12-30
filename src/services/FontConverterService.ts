import * as path from 'path';
import * as fs from 'fs';

export interface FontConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export interface FontConvertOptions {
    fontSize?: number;
    renderMode?: number;
    outputFormat?: 'bitmap' | 'vector';
}

/**
 * 字体转换服务 (TODO: 等字体转换工具准备好)
 */
export class FontConverterService {
    constructor() {}

    async convert(inputPath: string, outputPath: string, options?: FontConvertOptions): Promise<FontConvertResult> {
        return {
            success: false,
            inputPath,
            outputPath,
            error: '字体转换功能开发中'
        };
    }
}
