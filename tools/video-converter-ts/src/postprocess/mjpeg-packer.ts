/**
 * MjpegPacker - MJPEG stream packing with 8-byte alignment
 * 
 * This module packs JPEG frames into an MJPEG stream with 8-byte alignment.
 * It reads JPEG files from a directory, pads each frame via APP1 segment,
 * and concatenates them into a single output file.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Information about APP1 segment position in JPEG data
 */
interface App1Info {
  type: 'exist' | 'new';
  start: number;
  end: number;
}

/**
 * MjpegPacker class for packing JPEG frames into MJPEG stream
 */
export class MjpegPacker {
  /** 8-byte alignment requirement */
  private static readonly ALIGNMENT = 8;

  /**
   * Calculate padding needed to achieve 8-byte alignment
   * @param size Current size in bytes
   * @returns Number of padding bytes needed
   */
  private calculatePadding(size: number): number {
    if (size % MjpegPacker.ALIGNMENT === 0) {
      return 0;
    }
    return MjpegPacker.ALIGNMENT - (size % MjpegPacker.ALIGNMENT);
  }

  /**
   * Check if JPEG is baseline encoded (SOF0 marker 0xFFC0)
   * @param data JPEG data buffer
   * @returns true if baseline JPEG, false otherwise
   */
  private isBaselineJpeg(data: Buffer): boolean {
    let pos = 0;
    while (pos < data.length - 1) {
      if (data[pos] === 0xFF) {
        const marker = data[pos + 1];
        if (marker === 0xC0) {
          // SOF0 - Baseline DCT
          return true;
        } else if (marker === 0xC2) {
          // SOF2 - Progressive DCT
          return false;
        }
        // Skip segments with length field
        // SOI (0xD8) and EOI (0xD9) have no length field
        if (marker !== 0xD8 && marker !== 0xD9) {
          if (pos + 3 >= data.length) {
            break;
          }
          const length = data.readUInt16BE(pos + 2);
          pos += 2 + length;
          continue;
        }
      }
      pos += 1;
    }
    return false;
  }

  /**
   * Find APP1 segment position or insertion point
   * JPEG format: SOI (FFD8) | APPx segments | ... | SOS
   * @param data JPEG data buffer
   * @returns App1Info with type and position
   */
  private findApp1InsertPosition(data: Buffer): App1Info {
    let pos = 2; // Skip SOI (0xFFD8)
    const length = data.length;

    while (pos < length) {
      if (data[pos] !== 0xFF) {
        // Bad image, stop scanning
        break;
      }
      const marker = data[pos + 1];
      
      if (marker === 0xDA) {
        // SOS (Start of Scan) - stop here
        break;
      }
      
      if (marker === 0xE1) {
        // APP1 found
        if (pos + 3 >= length) {
          break;
        }
        const segLen = data.readUInt16BE(pos + 2);
        const app1End = pos + 2 + segLen;
        return { type: 'exist', start: pos, end: app1End };
      } else {
        // Other markers
        if (marker === 0xD8 || marker === 0xD9) {
          // SOI or EOI - no length field
          pos += 2;
        } else {
          // Marker with length field
          if (pos + 3 >= length) {
            break;
          }
          const segLen = data.readUInt16BE(pos + 2);
          pos += 2 + segLen;
        }
      }
    }
    
    // APP1 doesn't exist, return insertion point
    return { type: 'new', start: pos, end: pos };
  }

  /**
   * Pad JPEG via APP1 segment to achieve 8-byte alignment
   * If APP1 exists, extend it with padding bytes.
   * If APP1 doesn't exist, insert a new APP1 segment with EXIF identifier.
   * @param data JPEG data buffer
   * @returns Padded JPEG data buffer
   */
  private padJpegViaApp1(data: Buffer): Buffer {
    const origLen = data.length;
    const padding = this.calculatePadding(origLen);
    
    if (padding === 0) {
      return data; // Already aligned
    }

    const app1Info = this.findApp1InsertPosition(data);
    
    if (app1Info.type === 'exist') {
      // Extend existing APP1 segment
      const app1Start = app1Info.start;
      const app1End = app1Info.end;
      
      // Original APP1 content length (excluding marker and length field)
      const oldContentLen = app1End - app1Start - 4;
      const newContentLen = oldContentLen + padding;
      const newApp1Len = newContentLen + 2; // +2 for length field itself
      
      // Build new APP1 header
      const newApp1Head = Buffer.alloc(4);
      newApp1Head[0] = 0xFF;
      newApp1Head[1] = 0xE1;
      newApp1Head.writeUInt16BE(newApp1Len, 2);
      
      // Original content + padding
      const originalContent = data.subarray(app1Start + 4, app1End);
      const paddingBytes = Buffer.alloc(padding, 0x00);
      const newApp1Content = Buffer.concat([originalContent, paddingBytes]);
      
      // Combine: before APP1 + new APP1 header + new content + after APP1
      const beforeApp1 = data.subarray(0, app1Start);
      const afterApp1 = data.subarray(app1End);
      
      return Buffer.concat([beforeApp1, newApp1Head, newApp1Content, afterApp1]);
    } else {
      // Insert new APP1 segment with EXIF identifier
      const app1InjectPos = app1Info.start;
      
      // APP1 segment: marker (2) + length (2) + "EXIF" (4) + padding
      const newApp1Len = 2 + 4 + padding; // length field value includes itself (2) + EXIF (4) + padding
      
      const app1Segment = Buffer.alloc(4 + 4 + padding);
      app1Segment[0] = 0xFF;
      app1Segment[1] = 0xE1;
      app1Segment.writeUInt16BE(newApp1Len, 2);
      app1Segment.write('EXIF', 4, 'ascii');
      // Remaining bytes are already 0x00 from Buffer.alloc
      
      // Combine: before insertion point + APP1 segment + after insertion point
      const beforeInject = data.subarray(0, app1InjectPos);
      const afterInject = data.subarray(app1InjectPos);
      
      return Buffer.concat([beforeInject, app1Segment, afterInject]);
    }
  }

  /**
   * Pack JPEG frames from input directory into MJPEG stream
   * @param inputDir Directory containing JPEG frames
   * @param outputPath Output MJPEG file path
   */
  async pack(inputDir: string, outputPath: string): Promise<void> {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check input directory exists
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    // Read and sort files from input directory
    const files = fs.readdirSync(inputDir).sort();
    
    // Create/truncate output file
    fs.writeFileSync(outputPath, Buffer.alloc(0));
    
    let frameCount = 0;
    
    for (const fileName of files) {
      const filePath = path.join(inputDir, fileName);
      
      // Skip directories
      if (!fs.statSync(filePath).isFile()) {
        continue;
      }
      
      // Read JPEG file
      const imgBytes = fs.readFileSync(filePath);
      
      // Skip non-baseline JPEGs
      if (!this.isBaselineJpeg(imgBytes)) {
        console.warn(`Skipping non-baseline JPEG: ${filePath}`);
        continue;
      }
      
      // Pad JPEG via APP1 segment
      const paddedBytes = this.padJpegViaApp1(imgBytes);
      
      // Append to output file
      fs.appendFileSync(outputPath, paddedBytes);
      
      frameCount++;
    }
    
    console.log(`Done! ${frameCount} frames packed into ${outputPath}`);
  }
}
