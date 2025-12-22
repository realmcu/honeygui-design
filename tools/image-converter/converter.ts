/**
 * Image Converter Main Module
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { PixelFormat, FORMAT_TO_PIXEL_BYTES, FORMAT_TO_BPP } from './types';
import { RGBDataHeader, IMDCFileHeader } from './headers';
import { convertPixels } from './pixel-converter';
import { CompressionAlgorithm } from './compress/base';

interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
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
        
        let pixels: RGBA[];
        let width: number;
        let height: number;
        let hasAlpha: boolean;

        if (isPNG) {
            const result = await this.loadPNG(inputPath);
            pixels = result.pixels;
            width = result.width;
            height = result.height;
            hasAlpha = result.hasAlpha;
        } else if (isJPEG) {
            const result = await this.loadJPEG(inputPath);
            pixels = result.pixels;
            width = result.width;
            height = result.height;
            hasAlpha = false;
        } else if (isBMP) {
            const result = await this.loadBMP(inputPath);
            pixels = result.pixels;
            width = result.width;
            height = result.height;
            hasAlpha = result.hasAlpha;
        } else {
            throw new Error(`Unsupported image format (not PNG, JPEG or BMP)`);
        }

        // Auto-detect format
        let pixelFormat: PixelFormat;
        if (format === 'auto') {
            pixelFormat = hasAlpha ? PixelFormat.ARGB8888 : PixelFormat.RGB565;
        } else {
            pixelFormat = format;
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

    private async loadPNG(filePath: string): Promise<{
        pixels: RGBA[];
        width: number;
        height: number;
        hasAlpha: boolean;
    }> {
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(new PNG())
                .on('parsed', function(this: PNG) {
                    const pixels: RGBA[] = [];
                    let hasAlpha = false;
                    
                    // Check if any pixel has alpha < 255
                    for (let i = 0; i < this.data.length; i += 4) {
                        const a = this.data[i + 3];
                        if (a < 255) {
                            hasAlpha = true;
                        }
                        pixels.push({
                            r: this.data[i],
                            g: this.data[i + 1],
                            b: this.data[i + 2],
                            a: a,
                        });
                    }
                    
                    resolve({
                        pixels,
                        width: this.width,
                        height: this.height,
                        hasAlpha,
                    });
                })
                .on('error', reject);
        });
    }

    private async loadJPEG(filePath: string): Promise<{
        pixels: RGBA[];
        width: number;
        height: number;
        hasAlpha: boolean;
    }> {
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

    private async loadBMP(filePath: string): Promise<{
        pixels: RGBA[];
        width: number;
        height: number;
        hasAlpha: boolean;
    }> {
        const buffer = fs.readFileSync(filePath);
        
        // BMP 文件头 (14 bytes)
        const dataOffset = buffer.readUInt32LE(10);
        
        // DIB 头 (40 bytes for BITMAPINFOHEADER)
        const width = buffer.readInt32LE(18);
        const height = Math.abs(buffer.readInt32LE(22)); // 可能为负（自上而下）
        const bitsPerPixel = buffer.readUInt16LE(28);
        const compression = buffer.readUInt32LE(30);
        
        // 只支持未压缩的 24-bit 和 32-bit BMP
        if (compression !== 0) {
            throw new Error('Compressed BMP not supported');
        }
        
        if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
            throw new Error(`BMP with ${bitsPerPixel} bits per pixel not supported (only 24 and 32 bit)`);
        }
        
        const pixels: RGBA[] = [];
        const bytesPerPixel = bitsPerPixel / 8;
        const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4; // 行对齐到 4 字节
        const isTopDown = buffer.readInt32LE(22) < 0;
        let hasAlpha = false;
        
        // BMP 通常是从下到上存储的
        for (let y = 0; y < height; y++) {
            const actualY = isTopDown ? y : (height - 1 - y);
            const rowOffset = dataOffset + actualY * rowSize;
            
            for (let x = 0; x < width; x++) {
                const pixelOffset = rowOffset + x * bytesPerPixel;
                const b = buffer[pixelOffset];
                const g = buffer[pixelOffset + 1];
                const r = buffer[pixelOffset + 2];
                const a = bytesPerPixel === 4 ? buffer[pixelOffset + 3] : 255;
                
                if (a < 255) {
                    hasAlpha = true;
                }
                
                pixels.push({ r, g, b, a });
            }
        }
        
        return {
            pixels,
            width,
            height,
            hasAlpha,
        };
    }
}
