/**
 * Image Converter Main Module
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import * as bmp from 'bmp-js';
import { PixelFormat, FORMAT_TO_PIXEL_BYTES, FORMAT_TO_BPP } from './types';
import { RGBDataHeader, IMDCFileHeader, GIFFileHeader, parseGIFInfo } from './headers';
import { convertPixels } from './pixel-converter';
import { CompressionAlgorithm } from './compress/base';

interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface IndexedImageData {
    indices: number[];
    palette: RGBA[];
    maxColors: number;  // PNG8/BMP8 = 256
}

interface ImageLoadResult {
    pixels: RGBA[];
    width: number;
    height: number;
    hasAlpha: boolean;
    indexed?: IndexedImageData;  // 索引色图片的调色板信息
}

export class ImageConverter {
    private compressor?: CompressionAlgorithm;

    /**
     * Set compression algorithm
     */
    setCompressor(compressor?: CompressionAlgorithm): void {
        this.compressor = compressor;
    }

    /**
     * Convert image to HoneyGUI bin format
     */
    async convert(
        inputPath: string,
        outputPath: string,
        format: PixelFormat | 'auto' = 'auto'
    ): Promise<void> {
        // 读取文件头部判断实际格式
        const buffer = fs.readFileSync(inputPath);
        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isBMP = buffer[0] === 0x42 && buffer[1] === 0x4D; // 'BM'
        const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // 'GIF'
        
        // GIF 特殊处理：直接打包原始数据，不做像素转换
        if (isGIF) {
            await this.convertGIF(inputPath, outputPath, buffer);
            return;
        }
        
        let result: ImageLoadResult;

        if (isPNG) {
            result = await this.loadPNG(inputPath);
        } else if (isJPEG) {
            result = await this.loadJPEG(inputPath);
        } else if (isBMP) {
            result = await this.loadBMP(inputPath);
        } else {
            throw new Error(`Unsupported image format (not PNG, JPEG, BMP or GIF)`);
        }

        const { pixels, width, height, hasAlpha, indexed } = result;

        // Auto-detect format
        let pixelFormat: PixelFormat;
        if (format === 'auto') {
            // Revised logic: Remove automatic I8 detection
            // If has alpha -> ARGB8888
            // Otherwise -> RGB565
            if (hasAlpha) {
                pixelFormat = PixelFormat.ARGB8888;
            } else {
                pixelFormat = PixelFormat.RGB565;
            }
        } else {
            pixelFormat = format;
        }

        // I8 格式需要索引色图片
        if (pixelFormat === PixelFormat.I8) {
            if (!indexed) {
                throw new Error('I8 format requires indexed color image (PNG8 or BMP8)');
            }
            await this.convertI8(outputPath, width, height, indexed);
            return;
        }

        // Convert pixels
        const pixelData = convertPixels(pixels, pixelFormat);

        // Build header
        const useCompress = this.compressor !== undefined;
        const header = new RGBDataHeader(width, height, pixelFormat, useCompress);

        // Write output
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const headerBuffer = header.pack();
        
        if (useCompress && this.compressor) {
            // Compress data
            const pixelBytes = FORMAT_TO_BPP[pixelFormat];
            const { compressedData, lineOffsets, params } = this.compressor.compress(
                pixelData,
                width,
                height,
                pixelBytes
            );

            // Build IMDC header
            const imdc = new IMDCFileHeader(
                this.compressor.getAlgorithmType(),
                params.feature_1,
                params.feature_2,
                FORMAT_TO_PIXEL_BYTES[pixelFormat],
                width,
                height
            );
            const imdcBuffer = imdc.pack();

            // Calculate offsets relative to imdc_file_t start
            const imdcOffset = 12 + (height + 1) * 4;

            // Build offset table
            const offsetTable = Buffer.alloc((height + 1) * 4);
            for (let i = 0; i < height; i++) {
                const relativeOffset = imdcOffset + lineOffsets[i];
                offsetTable.writeUInt32LE(relativeOffset, i * 4);
            }
            // Write end offset
            const endOffset = imdcOffset + compressedData.length;
            offsetTable.writeUInt32LE(endOffset, height * 4);

            // Write output: header + imdc + offsets + compressed data
            const outputBuffer = Buffer.concat([
                headerBuffer,
                imdcBuffer,
                offsetTable,
                compressedData
            ]);
            fs.writeFileSync(outputPath, outputBuffer);
        } else {
            // Write uncompressed
            const outputBuffer = Buffer.concat([headerBuffer, pixelData]);
            fs.writeFileSync(outputPath, outputBuffer);
        }
    }

    /**
     * Convert GIF to HoneyGUI bin format
     * GIF 格式直接打包原始数据，不做像素转换
     * 
     * 输出格式：
     * - gui_rgb_data_head_t (8 bytes) - type = GIF (14)
     * - uint32_t size (4 bytes) - GIF 原始数据大小
     * - uint32_t dummy (4 bytes) - 对齐填充
     * - uint8_t gif[] - GIF 原始数据
     */
    private async convertGIF(
        inputPath: string,
        outputPath: string,
        gifData: Buffer
    ): Promise<void> {
        // 解析 GIF 信息获取宽高
        const gifInfo = parseGIFInfo(gifData);
        if (!gifInfo) {
            throw new Error(`Invalid GIF file: ${inputPath}`);
        }

        const { width, height } = gifInfo;

        // 构建 GIF 文件头
        const header = new GIFFileHeader(width, height, gifData.length);
        const headerBuffer = header.pack();

        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 写入输出：header (16 bytes) + GIF 原始数据
        const outputBuffer = Buffer.concat([headerBuffer, gifData]);
        fs.writeFileSync(outputPath, outputBuffer);
    }

    /**
     * Convert indexed color image to I8 format
     * 未压缩格式：8 byte header + 4 byte info + palette (ABGR8888) + indices
     * 压缩格式：8 byte header + 4 byte info + palette (ABGR8888) + imdc_header + offset_table + compressed_indices
     * 
     * 压缩时只压缩 indices 部分，palette 保持不变
     */
    private async convertI8(
        outputPath: string,
        width: number,
        height: number,
        indexed: IndexedImageData
    ): Promise<void> {
        const { indices, palette, maxColors } = indexed;
        const colorCount = palette.length;

        const useCompress = this.compressor !== undefined;

        // 8 byte GUI header
        const header = new RGBDataHeader(width, height, PixelFormat.I8, useCompress);
        const headerBuffer = header.pack();

        // 4 byte info: 高16位 = colorCount - 1, 低16位 = maxColors - 1
        const infoBuffer = Buffer.alloc(4);
        const highWord = (colorCount - 1) & 0xFFFF;
        const lowWord = (maxColors - 1) & 0xFFFF;
        infoBuffer.writeUInt32LE((highWord << 16) | lowWord, 0);

        // 颜色表：ABGR8888 格式，每个颜色 4 字节
        const paletteBuffer = Buffer.alloc(colorCount * 4);
        for (let i = 0; i < colorCount; i++) {
            const { r, g, b, a } = palette[i];
            // ABGR8888: 按照 [R, G, B, A] 的顺序存储
            paletteBuffer.writeUInt8(r, i * 4);
            paletteBuffer.writeUInt8(g, i * 4 + 1);
            paletteBuffer.writeUInt8(b, i * 4 + 2);
            paletteBuffer.writeUInt8(a, i * 4 + 3);
        }

        // Write output
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (useCompress && this.compressor) {
            // 压缩索引数据，每像素 1 字节
            const indexBuffer = Buffer.from(indices);
            const pixelBytes = 1;  // I8 格式每像素 1 字节
            const { compressedData, lineOffsets, params } = this.compressor.compress(
                indexBuffer,
                width,
                height,
                pixelBytes
            );

            // Build IMDC header
            const imdc = new IMDCFileHeader(
                this.compressor.getAlgorithmType(),
                params.feature_1,
                params.feature_2,
                FORMAT_TO_PIXEL_BYTES[PixelFormat.I8],
                width,
                height
            );
            const imdcBuffer = imdc.pack();

            // Calculate offsets relative to imdc_file_t start
            const imdcOffset = 12 + (height + 1) * 4;

            // Build offset table
            const offsetTable = Buffer.alloc((height + 1) * 4);
            for (let i = 0; i < height; i++) {
                const relativeOffset = imdcOffset + lineOffsets[i];
                offsetTable.writeUInt32LE(relativeOffset, i * 4);
            }
            // Write end offset
            const endOffset = imdcOffset + compressedData.length;
            offsetTable.writeUInt32LE(endOffset, height * 4);

            // Write output: header + info + palette + imdc + offsets + compressed indices
            const outputBuffer = Buffer.concat([
                headerBuffer,
                infoBuffer,
                paletteBuffer,
                imdcBuffer,
                offsetTable,
                compressedData
            ]);
            fs.writeFileSync(outputPath, outputBuffer);
        } else {
            // 未压缩：直接写入索引数据
            const indexBuffer = Buffer.from(indices);
            const outputBuffer = Buffer.concat([headerBuffer, infoBuffer, paletteBuffer, indexBuffer]);
            fs.writeFileSync(outputPath, outputBuffer);
        }
    }

    private async loadPNG(filePath: string): Promise<ImageLoadResult> {
        return new Promise((resolve, reject) => {
            const fileBuffer = fs.readFileSync(filePath);
            
            // 先用 pngjs 同步解析获取元数据
            const png = PNG.sync.read(fileBuffer);
            
            const pixels: RGBA[] = [];
            let hasAlpha = false;
            
            // Check if any pixel has alpha < 255
            for (let i = 0; i < png.data.length; i += 4) {
                const a = png.data[i + 3];
                if (a < 255) {
                    hasAlpha = true;
                }
                pixels.push({
                    r: png.data[i],
                    g: png.data[i + 1],
                    b: png.data[i + 2],
                    a: a,
                });
            }
            
            // 检查是否是索引色 PNG (colorType 3)
            // pngjs 会自动将索引色转换为 RGBA，但我们需要重建索引
            let indexed: IndexedImageData | undefined;
            
            // 对于 PNG8，我们需要从像素数据中提取唯一颜色并建立索引
            // 因为 pngjs 不直接暴露原始调色板，我们需要重建
            const pngPalette = (png as any).palette;
            if (pngPalette && Array.isArray(pngPalette) && pngPalette.length > 0) {
                // pngjs 7.x 支持 palette 属性
                indexed = this.buildIndexedDataFromPalette(pixels, pngPalette, 256);
            } else {
                // 尝试从像素数据中提取索引（适用于 256 色以内的图片）
                indexed = this.tryBuildIndexedData(pixels, 256);
            }
            
            resolve({
                pixels,
                width: png.width,
                height: png.height,
                hasAlpha,
                indexed,
            });
        });
    }

    private async loadJPEG(filePath: string): Promise<ImageLoadResult> {
        const buffer = fs.readFileSync(filePath);
        const rawImageData = jpeg.decode(buffer);
        
        const pixels: RGBA[] = [];
        for (let i = 0; i < rawImageData.data.length; i += 4) {
            pixels.push({
                r: rawImageData.data[i],
                g: rawImageData.data[i + 1],
                b: rawImageData.data[i + 2],
                a: rawImageData.data[i + 3] || 255,
            });
        }
        
        return {
            pixels,
            width: rawImageData.width,
            height: rawImageData.height,
            hasAlpha: false,
        };
    }

    private async loadBMP(filePath: string): Promise<ImageLoadResult> {
        const buffer = fs.readFileSync(filePath);
        const bmpData = bmp.decode(buffer) as any;
        
        const pixels: RGBA[] = [];
        let hasAlpha = false;
        
        // bmp-js 返回的数据是 ABGR 格式
        for (let i = 0; i < bmpData.data.length; i += 4) {
            let a = bmpData.data[i];
            const b = bmpData.data[i + 1];
            const g = bmpData.data[i + 2];
            const r = bmpData.data[i + 3];
            
            // 24 位 BMP 没有 Alpha 通道，bmp-js 会填 0，需要改为 255
            if (!bmpData.is_with_alpha) {
                a = 255;
            } else if (a < 255) {
                hasAlpha = true;
            }
            
            pixels.push({ r, g, b, a });
        }
        
        // 检查是否是 8 位 BMP（索引色）
        let indexed: IndexedImageData | undefined;
        
        // bmp-js 的 palette 属性包含调色板信息
        if (bmpData.palette && bmpData.palette.length > 0) {
            indexed = this.buildIndexedDataFromBmpPalette(pixels, bmpData.palette, 256);
        } else {
            // 尝试从像素数据中提取索引（适用于 256 色以内的图片）
            indexed = this.tryBuildIndexedData(pixels, 256);
        }
        
        return {
            pixels,
            width: bmpData.width,
            height: bmpData.height,
            hasAlpha,
            indexed,
        };
    }

    /**
     * 从 PNG 调色板构建索引数据
     */
    private buildIndexedDataFromPalette(
        pixels: RGBA[],
        palette: Array<[number, number, number, number]>,
        maxColors: number
    ): IndexedImageData {
        const paletteRGBA: RGBA[] = palette.map(([r, g, b, a]) => ({ r, g, b, a: a ?? 255 }));
        
        // 建立颜色到索引的映射
        const colorToIndex = new Map<string, number>();
        paletteRGBA.forEach((color, index) => {
            const key = `${color.r},${color.g},${color.b},${color.a}`;
            colorToIndex.set(key, index);
        });
        
        // 为每个像素找到对应的索引
        const indices: number[] = pixels.map(pixel => {
            const key = `${pixel.r},${pixel.g},${pixel.b},${pixel.a}`;
            return colorToIndex.get(key) ?? 0;
        });
        
        return {
            indices,
            palette: paletteRGBA,
            maxColors,
        };
    }

    /**
     * 从 BMP 调色板构建索引数据
     */
    private buildIndexedDataFromBmpPalette(
        pixels: RGBA[],
        palette: Array<{ red: number; green: number; blue: number; quad: number }>,
        maxColors: number
    ): IndexedImageData {
        const paletteRGBA: RGBA[] = palette.map(p => ({
            r: p.red,
            g: p.green,
            b: p.blue,
            a: 255,  // BMP 调色板通常没有 alpha
        }));
        
        // 建立颜色到索引的映射
        const colorToIndex = new Map<string, number>();
        paletteRGBA.forEach((color, index) => {
            const key = `${color.r},${color.g},${color.b},${color.a}`;
            colorToIndex.set(key, index);
        });
        
        // 为每个像素找到对应的索引
        const indices: number[] = pixels.map(pixel => {
            const key = `${pixel.r},${pixel.g},${pixel.b},${pixel.a}`;
            return colorToIndex.get(key) ?? 0;
        });
        
        return {
            indices,
            palette: paletteRGBA,
            maxColors,
        };
    }

    /**
     * 尝试从像素数据中构建索引数据（当没有调色板信息时）
     */
    private tryBuildIndexedData(pixels: RGBA[], maxColors: number): IndexedImageData | undefined {
        // 收集所有唯一颜色
        const colorMap = new Map<string, { color: RGBA; index: number }>();
        const indices: number[] = [];
        
        for (const pixel of pixels) {
            const key = `${pixel.r},${pixel.g},${pixel.b},${pixel.a}`;
            
            if (!colorMap.has(key)) {
                if (colorMap.size >= maxColors) {
                    // 颜色数超过最大值，不是索引色图片
                    return undefined;
                }
                colorMap.set(key, { color: pixel, index: colorMap.size });
            }
            
            indices.push(colorMap.get(key)!.index);
        }
        
        // 构建调色板
        const palette: RGBA[] = Array.from(colorMap.values())
            .sort((a, b) => a.index - b.index)
            .map(v => v.color);
        
        return {
            indices,
            palette,
            maxColors,
        };
    }
}
