/**
 * RLE (Run-Length Encoding) Compression
 * 
 * RLE 节点格式:
 * - RGB565:    [len:1] [pixel:2]
 * - ARGB8565:  [len:1] [pixel:2] [alpha:1]
 * - RGB888:    [len:1] [b:1] [g:1] [r:1]
 * - ARGB8888:  [len:1] [pixel:4]
 */

import { CompressionAlgorithm, CompressionResult } from './base';

const COMPRESS_RLE = 0;

export class RLECompression implements CompressionAlgorithm {
  private runLength1: number;
  private runLength2: number;
  private level: number;
  private minRun: number;

  constructor(runLength1: number = 1, runLength2: number = 0, level: number = 1) {
    this.runLength1 = runLength1 & 0x03;
    this.runLength2 = runLength2 & 0x03;
    this.level = level;
    this.minRun = this.runLength1 + 1;
  }

  compress(
    pixelData: Buffer,
    width: number,
    height: number,
    pixelBytes: number
  ): CompressionResult {
    const compressedData: number[] = [];
    const lineOffsets: number[] = [];
    const bytesPerLine = width * pixelBytes;

    for (let line = 0; line < height; line++) {
      const lineStart = line * bytesPerLine;
      const lineEnd = lineStart + bytesPerLine;
      const lineData = pixelData.subarray(lineStart, lineEnd);

      // Record offset for this line
      lineOffsets.push(compressedData.length);

      // Compress line
      const compressedLine = this.compressLine(lineData, pixelBytes);
      compressedData.push(...compressedLine);
    }

    return {
      compressedData: Buffer.from(compressedData),
      lineOffsets,
      params: {
        feature_1: this.runLength1,
        feature_2: this.runLength2,
      },
    };
  }

  private compressLine(data: Buffer, pixelBytes: number): number[] {
    const result: number[] = [];
    let i = 0;

    while (i < data.length) {
      // Get current pixel
      const pixel = data.subarray(i, i + pixelBytes);

      // Find consecutive repeated pixels
      let runLength = 1;
      let j = i + pixelBytes;
      while (j < data.length && runLength < 255) {
        const nextPixel = data.subarray(j, j + pixelBytes);
        if (pixel.equals(nextPixel)) {
          runLength++;
          j += pixelBytes;
        } else {
          break;
        }
      }

      // Write RLE node: [len] [pixel_data]
      result.push(runLength);
      result.push(...pixel);

      i = j;
    }

    return result;
  }

  getAlgorithmType(): number {
    return COMPRESS_RLE;
  }
}
