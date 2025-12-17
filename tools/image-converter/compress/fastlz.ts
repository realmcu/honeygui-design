/**
 * FastLZ Compression (Pure JavaScript Implementation)
 * Based on FastLZ algorithm by Ariya Hidayat
 */

import { CompressionAlgorithm, CompressionResult } from './base';

const COMPRESS_FASTLZ = 1;

export class FastLzCompression implements CompressionAlgorithm {
  compress(
    pixelData: Buffer,
    width: number,
    height: number,
    pixelBytes: number
  ): CompressionResult {
    const compressedLines: Buffer[] = [];
    const bytesPerLine = width * pixelBytes;

    // Compress each line
    for (let line = 0; line < height; line++) {
      const lineStart = line * bytesPerLine;
      const lineEnd = lineStart + bytesPerLine;
      const lineData = pixelData.subarray(lineStart, lineEnd);
      
      const compressed = this.compressLine(lineData);
      compressedLines.push(compressed);
    }

    // Build compressed data with metadata
    const compressedData: number[] = [];
    const lineOffsets: number[] = [];

    // Calculate metadata (last two offsets)
    const tempSize = compressedLines.reduce((sum, line) => sum + line.length, 0);
    const imdcOffset = 12 + (height + 1) * 4;
    const lastLineOffset = imdcOffset + tempSize - compressedLines[compressedLines.length - 1].length;
    const endOffset = imdcOffset + tempSize;

    // Build compressed data
    for (let i = 0; i < compressedLines.length; i++) {
      lineOffsets.push(compressedData.length);
      
      if (i === 0) {
        // Add 8-byte metadata for first line (will overlap with offset table)
        compressedData.push(
          lastLineOffset & 0xff,
          (lastLineOffset >> 8) & 0xff,
          (lastLineOffset >> 16) & 0xff,
          (lastLineOffset >> 24) & 0xff,
          endOffset & 0xff,
          (endOffset >> 8) & 0xff,
          (endOffset >> 16) & 0xff,
          (endOffset >> 24) & 0xff
        );
      }
      
      compressedData.push(...compressedLines[i]);
    }

    return {
      compressedData: Buffer.from(compressedData),
      lineOffsets,
      params: {
        feature_1: 0,
        feature_2: 0,
      },
    };
  }

  private compressLine(input: Buffer): Buffer {
    const output: number[] = [];
    let ip = 0;
    const ipLimit = input.length - 2;
    let op = 0;

    // Hash table for finding matches
    const htab = new Int32Array(8192);
    htab.fill(-1);

    let anchor = 0;

    while (ip < ipLimit) {
      let ref = 0;
      let distance = 0;
      let len = 0;

      // Find match
      const hash = this.hashFunction(input, ip);
      ref = htab[hash];
      htab[hash] = ip;

      if (ref >= 0 && ref < ip) {
        distance = ip - ref;
        if (distance < 8192) {
          // Check match length
          len = this.compareBytes(input, ref, ip, input.length);
          
          if (len >= 3) {
            // Copy literals before match
            const literals = ip - anchor;
            if (literals > 0) {
              this.copyLiterals(input, anchor, literals, output);
            }

            // Encode match
            len -= 2;
            if (len < 7) {
              output.push((len << 5) | ((distance >> 8) & 0x1f));
              output.push(distance & 0xff);
            } else {
              output.push(0xe0 | ((distance >> 8) & 0x1f));
              output.push(distance & 0xff);
              len -= 7;
              while (len >= 255) {
                output.push(255);
                len -= 255;
              }
              output.push(len);
            }

            ip += len + 2;
            anchor = ip;
            continue;
          }
        }
      }

      ip++;
    }

    // Copy remaining literals
    const literals = input.length - anchor;
    if (literals > 0) {
      this.copyLiterals(input, anchor, literals, output);
    }

    return Buffer.from(output);
  }

  private hashFunction(data: Buffer, pos: number): number {
    const v = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
    return ((v * 2654435761) >>> 19) & 0x1fff;
  }

  private compareBytes(data: Buffer, ref: number, ip: number, limit: number): number {
    let len = 0;
    while (ip + len < limit && data[ref + len] === data[ip + len]) {
      len++;
    }
    return len;
  }

  private copyLiterals(input: Buffer, start: number, len: number, output: number[]): void {
    let remaining = len;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 32);
      output.push((chunk - 1) << 5);
      for (let i = 0; i < chunk; i++) {
        output.push(input[start + i]);
      }
      start += chunk;
      remaining -= chunk;
    }
  }

  getAlgorithmType(): number {
    return COMPRESS_FASTLZ;
  }
}
