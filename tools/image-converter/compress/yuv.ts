/**
 * YUV Sampling + Blur Compression
 * 
 * YUV 格式:
 * - YUV444: [Y U V] 每像素3字节
 * - YUV422: [Y0 U0 Y1 V0 Y2 U1 Y3 V1] 每4像素8字节
 * - YUV411: [Y0 U0 Y1 Y2 V0 Y3] 每4像素6字节
 */

import { CompressionAlgorithm, CompressionResult } from './base';
import { FastLzCompression } from './fastlz';

const COMPRESS_YUV = 3;
const COMPRESS_YUV_FASTLZ = 2;

type SampleMode = 'yuv444' | 'yuv422' | 'yuv411';
type BlurBits = 0 | 1 | 2 | 4;

export class YUVCompression implements CompressionAlgorithm {
  private sampleMode: SampleMode;
  private blurBits: BlurBits;
  private useFastlz: boolean;
  private fastlz?: FastLzCompression;

  constructor(sampleMode: SampleMode = 'yuv444', blurBits: BlurBits = 0, useFastlz: boolean = false) {
    this.sampleMode = sampleMode;
    this.blurBits = blurBits;
    this.useFastlz = useFastlz;
    if (useFastlz) {
      this.fastlz = new FastLzCompression();
    }
  }

  compress(
    pixelData: Buffer,
    width: number,
    height: number,
    pixelBytes: number
  ): CompressionResult {
    const compressedLines: Buffer[] = [];
    const bytesPerLine = width * pixelBytes;

    // Process each line
    for (let line = 0; line < height; line++) {
      const lineStart = line * bytesPerLine;
      const lineEnd = lineStart + bytesPerLine;
      const lineData = pixelData.subarray(lineStart, lineEnd);

      // Convert to YUV and apply sampling
      const yuvData = this.rgbToYuvLine(lineData, width, pixelBytes);
      const sampledData = this.applySampling(yuvData, width);
      const blurredData = this.applyBlur(sampledData);

      compressedLines.push(blurredData);
    }

    // Optional FastLz compression
    if (this.useFastlz && this.fastlz) {
      return this.fastlz.compress(Buffer.concat(compressedLines), width, height, pixelBytes);
    }

    // Build compressed data
    const compressedData: number[] = [];
    const lineOffsets: number[] = [];

    for (const line of compressedLines) {
      lineOffsets.push(compressedData.length);
      compressedData.push(...line);
    }

    // Map sample_mode to feature_1
    const sampleModeMap: Record<SampleMode, number> = {
      yuv444: 0,
      yuv422: 1,
      yuv411: 2,
    };

    // Map blur_bits to feature_2
    const blurBitsMap: Record<BlurBits, number> = {
      0: 0,
      1: 1,
      2: 2,
      4: 3,
    };

    return {
      compressedData: Buffer.from(compressedData),
      lineOffsets,
      params: {
        feature_1: sampleModeMap[this.sampleMode],
        feature_2: blurBitsMap[this.blurBits],
      },
    };
  }

  private rgbToYuvLine(data: Buffer, width: number, pixelBytes: number): Array<[number, number, number]> {
    const yuvData: Array<[number, number, number]> = [];

    for (let i = 0; i < data.length; i += pixelBytes) {
      let r: number, g: number, b: number;

      if (pixelBytes === 2) {
        // RGB565
        const pixel = data.readUInt16LE(i);
        r = ((pixel >> 11) & 0x1f) << 3;
        g = ((pixel >> 5) & 0x3f) << 2;
        b = (pixel & 0x1f) << 3;
      } else if (pixelBytes === 3) {
        // RGB888 or ARGB8565
        b = data[i];
        g = data[i + 1];
        r = data[i + 2];
      } else {
        // ARGB8888
        b = data[i];
        g = data[i + 1];
        r = data[i + 2];
      }

      // RGB to YUV conversion (ITU-R BT.601)
      let y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      let u = Math.round(-0.169 * r - 0.331 * g + 0.5 * b + 128);
      let v = Math.round(0.5 * r - 0.419 * g - 0.081 * b + 128);

      // Clamp to 0-255
      y = Math.max(0, Math.min(255, y));
      u = Math.max(0, Math.min(255, u));
      v = Math.max(0, Math.min(255, v));

      yuvData.push([y, u, v]);
    }

    return yuvData;
  }

  private applySampling(yuvData: Array<[number, number, number]>, width: number): Buffer {
    const result: number[] = [];

    if (this.sampleMode === 'yuv444') {
      // 4:4:4 - No subsampling: [Y U V] per pixel
      for (const [y, u, v] of yuvData) {
        result.push(y, u, v);
      }
    } else if (this.sampleMode === 'yuv422') {
      // 4:2:2 - Format: [Y0 U0 Y1 V0 Y2 U1 Y3 V1]
      for (let i = 0; i < yuvData.length; i += 4) {
        const pixels = yuvData.slice(i, i + 4);
        if (pixels.length < 4) {
          // Handle remainder
          for (const [y, u, v] of pixels) {
            result.push(y, u, v);
          }
          break;
        }

        const [y0, u0, v0] = pixels[0];
        const [y1, u1, v1] = pixels[1];
        const [y2, u2, v2] = pixels[2];
        const [y3, u3, v3] = pixels[3];

        // Average U/V for pairs
        const uAvg0 = Math.round((u0 + u1) / 2);
        const vAvg0 = Math.round((v0 + v1) / 2);
        const uAvg1 = Math.round((u2 + u3) / 2);
        const vAvg1 = Math.round((v2 + v3) / 2);

        result.push(y0, uAvg0, y1, vAvg0, y2, uAvg1, y3, vAvg1);
      }
    } else if (this.sampleMode === 'yuv411') {
      // 4:1:1 - Format: [Y0 U0 Y1 Y2 V0 Y3]
      for (let i = 0; i < yuvData.length; i += 4) {
        const pixels = yuvData.slice(i, i + 4);
        if (pixels.length < 4) {
          // Handle remainder
          for (const [y, u, v] of pixels) {
            result.push(y, u, v);
          }
          break;
        }

        // Average U/V for all 4 pixels
        const uAvg = Math.round(pixels.reduce((sum, p) => sum + p[1], 0) / 4);
        const vAvg = Math.round(pixels.reduce((sum, p) => sum + p[2], 0) / 4);

        result.push(pixels[0][0], uAvg, pixels[1][0], pixels[2][0], vAvg, pixels[3][0]);
      }
    }

    return Buffer.from(result);
  }

  private applyBlur(data: Buffer): Buffer {
    if (this.blurBits === 0) {
      return data;
    }

    // Calculate bits remaining after blur
    const bitsPerByte = 8 - this.blurBits;

    // Bit packing
    const result: number[] = [];
    let bitBuffer = 0;
    let bitsInBuffer = 0;

    for (const byteVal of data) {
      // Shift right to discard low bits
      const value = byteVal >> this.blurBits;

      // Add to bit buffer
      bitBuffer = (bitBuffer << bitsPerByte) | value;
      bitsInBuffer += bitsPerByte;

      // Output complete bytes
      while (bitsInBuffer >= 8) {
        bitsInBuffer -= 8;
        const outputByte = (bitBuffer >> bitsInBuffer) & 0xff;
        result.push(outputByte);
      }
    }

    // Output remaining bits if any
    if (bitsInBuffer > 0) {
      const outputByte = (bitBuffer << (8 - bitsInBuffer)) & 0xff;
      result.push(outputByte);
    }

    return Buffer.from(result);
  }

  getAlgorithmType(): number {
    return this.useFastlz ? COMPRESS_YUV_FASTLZ : COMPRESS_YUV;
  }
}
