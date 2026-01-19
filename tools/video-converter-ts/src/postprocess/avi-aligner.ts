/**
 * AviAligner - AVI file frame alignment to 8-byte boundaries
 * 
 * This module aligns AVI file frames to 8-byte boundaries through two passes:
 * 1. First pass: Adjust JUNK chunk size to align first frame
 * 2. Second pass: Pad each frame via APP1 segment to align subsequent frames
 */

import * as fs from 'fs';
import * as path from 'path';

/** Chunk header information */
interface ChunkHeader {
  id: string;
  size: number;
  dataOffset: number;
}

/** Chunk information with offset */
interface ChunkInfo {
  id: string;
  offset: number;
  size: number;
  dataOffset: number;
}

/** RIFF structure information */
interface RiffInfo {
  size: number;
  end: number;
  type: string;
  chunks: ChunkInfo[];
}

/**
 * AviAligner class for aligning AVI file frames to 8-byte boundaries
 */
export class AviAligner {
  private static readonly ALIGNMENT = 8;

  /**
   * Read chunk header at specified offset
   */
  private readChunkHeader(fd: number, offset: number): ChunkHeader | null {
    const header = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, header, 0, 8, offset);
    if (bytesRead < 8) {
      return null;
    }
    const id = header.toString('ascii', 0, 4);
    const size = header.readUInt32LE(4);
    return { id, size, dataOffset: offset + 8 };
  }

  /**
   * Find root chunks in RIFF structure
   */
  private findRootChunks(fd: number): RiffInfo | null {
    // Read RIFF header
    const riffHeader = Buffer.alloc(12);
    fs.readSync(fd, riffHeader, 0, 12, 0);
    
    const riffId = riffHeader.toString('ascii', 0, 4);
    if (riffId !== 'RIFF') {
      console.error(`File is not RIFF format: ${riffId}`);
      return null;
    }
    
    const riffSize = riffHeader.readUInt32LE(4);
    const riffType = riffHeader.toString('ascii', 8, 12);
    const riffEnd = 8 + riffSize;
    
    const chunks: ChunkInfo[] = [];
    let offset = 12;
    
    while (offset + 8 <= riffEnd) {
      const chunk = this.readChunkHeader(fd, offset);
      if (!chunk) break;
      
      chunks.push({
        id: chunk.id,
        offset,
        size: chunk.size,
        dataOffset: chunk.dataOffset
      });
      
      // Pad to word boundary
      const pad = chunk.size % 2;
      offset += 8 + chunk.size + pad;
    }
    
    return { size: riffSize, end: riffEnd, type: riffType, chunks };
  }


  /**
   * Find chunks within movi LIST
   */
  private findMoviChunks(fd: number, moviDataOffset: number, moviSize: number): ChunkInfo[] {
    let offset = moviDataOffset + 4; // Skip 'movi' type
    const end = moviDataOffset + moviSize;
    const chunks: ChunkInfo[] = [];
    
    while (offset + 8 <= end) {
      const chunk = this.readChunkHeader(fd, offset);
      if (!chunk || offset + 8 + chunk.size > end) break;
      
      // Only include frame chunks (not JUNK or LIST)
      if (chunk.id !== 'JUNK' && chunk.id !== 'LIST') {
        chunks.push({
          id: chunk.id,
          offset,
          size: chunk.size,
          dataOffset: chunk.dataOffset
        });
      }
      
      const pad = chunk.size % 2;
      offset += 8 + chunk.size + pad;
    }
    
    return chunks;
  }

  /**
   * Find first frame chunk in movi
   */
  private findFirstMoviChunk(fd: number, moviDataOffset: number, moviSize: number): ChunkInfo | null {
    let offset = moviDataOffset + 4; // Skip 'movi' type
    const end = moviDataOffset + moviSize;
    
    while (offset + 8 <= end) {
      const chunk = this.readChunkHeader(fd, offset);
      if (!chunk) break;
      
      if (chunk.id !== 'LIST' && chunk.id !== 'JUNK') {
        return {
          id: chunk.id,
          offset,
          size: chunk.size,
          dataOffset: chunk.dataOffset
        };
      }
      
      const pad = chunk.size % 2;
      offset += 8 + chunk.size + pad;
    }
    
    return null;
  }

  /**
   * Build APP1 segment with EXIF identifier
   */
  private buildApp1Segment(padLen: number): Buffer {
    const length = 6 + padLen; // 2 for length field + 4 for EXIF + padding
    const segment = Buffer.alloc(4 + 4 + padLen);
    segment[0] = 0xFF;
    segment[1] = 0xE1;
    segment.writeUInt16BE(length, 2);
    segment.write('EXIF', 4, 'ascii');
    return segment;
  }

  /**
   * Insert APP1 segment into JPEG data
   */
  private insertApp1ToJpeg(jpegData: Buffer, padLen: number): Buffer {
    // Check SOI marker
    if (jpegData[0] !== 0xFF || jpegData[1] !== 0xD8) {
      return jpegData;
    }
    
    const soi = jpegData.subarray(0, 2);
    let app0Seg: Buffer = Buffer.alloc(0);
    let app0End = 2; // Position after SOI
    
    // Check for existing APP0
    if (jpegData[2] === 0xFF && jpegData[3] === 0xE0) {
      const segLen = jpegData.readUInt16BE(4); // Length field value
      app0End = 2 + 2 + segLen; // SOI(2) + marker(2) + length field includes itself + data
      app0Seg = Buffer.from(jpegData.subarray(2, app0End));
    }
    
    const rest = jpegData.subarray(app0End);
    const app1Seg = this.buildApp1Segment(padLen);
    
    return Buffer.concat([soi, app0Seg, app1Seg, rest]);
  }

  /**
   * Extend existing APP1 segment with padding
   */
  private padAppn(jpegData: Buffer, padLen: number): Buffer | null {
    let pos = 2;
    
    while (pos + 4 < jpegData.length) {
      if (jpegData[pos] === 0xFF && jpegData[pos + 1] === 0xE1) {
        // Found APP1
        const segLen = jpegData.readUInt16BE(pos + 2);
        const segStart = pos;
        const segEnd = pos + 2 + segLen;
        
        // Build new APP1 with extended length
        const newLenWord = Buffer.alloc(2);
        newLenWord.writeUInt16BE(segLen + padLen, 0);
        
        const padding = Buffer.alloc(padLen, 0x00);
        const newAppn = Buffer.concat([
          jpegData.subarray(segStart, segStart + 2),
          newLenWord,
          jpegData.subarray(segStart + 4, segEnd),
          padding
        ]);
        
        return Buffer.concat([
          jpegData.subarray(0, segStart),
          newAppn,
          jpegData.subarray(segEnd)
        ]);
      } else if (jpegData[pos] === 0xFF) {
        const segLen = jpegData.readUInt16BE(pos + 2);
        pos += 2 + segLen;
      } else {
        break;
      }
    }
    
    return null; // APP1 not found
  }


  /**
   * First pass: Adjust JUNK chunk size to align first frame
   */
  async alignFirstFrame(inputPath: string, outputPath: string): Promise<void> {
    const fdIn = fs.openSync(inputPath, 'r');
    
    try {
      const riffInfo = this.findRootChunks(fdIn);
      if (!riffInfo) {
        throw new Error('Invalid AVI file format');
      }
      
      // Find movi LIST chunk
      let moviIdx = -1;
      let moviChunk: ChunkInfo | null = null;
      
      for (let i = 0; i < riffInfo.chunks.length; i++) {
        const chunk = riffInfo.chunks[i]!;
        if (chunk.id === 'LIST') {
          const typeBuffer = Buffer.alloc(4);
          fs.readSync(fdIn, typeBuffer, 0, 4, chunk.dataOffset);
          const type = typeBuffer.toString('ascii');
          if (type === 'movi') {
            moviIdx = i;
            moviChunk = chunk;
            break;
          }
        }
      }
      
      if (!moviChunk) {
        throw new Error('movi chunk not found');
      }
      
      // Find JUNK chunk before movi
      let junkIdx = -1;
      for (let i = moviIdx - 1; i >= 0; i--) {
        if (riffInfo.chunks[i]!.id === 'JUNK') {
          junkIdx = i;
          break;
        }
      }
      
      if (junkIdx === -1) {
        throw new Error('JUNK chunk not found before movi');
      }
      
      const junkChunk = riffInfo.chunks[junkIdx]!;
      
      // Find first frame in movi
      const firstFrame = this.findFirstMoviChunk(fdIn, moviChunk.dataOffset, moviChunk.size);
      if (!firstFrame) {
        throw new Error('No frames found in movi');
      }
      
      // Calculate padding needed
      const firstFrameDataOffset = firstFrame.dataOffset;
      const needPad = (AviAligner.ALIGNMENT - (firstFrameDataOffset % AviAligner.ALIGNMENT)) % AviAligner.ALIGNMENT;
      
      if (needPad === 0) {
        // Already aligned, just copy file
        fs.copyFileSync(inputPath, outputPath);
        console.log('First frame already 8-byte aligned');
        return;
      }
      
      // Calculate new sizes
      const newJunkSize = junkChunk.size + needPad;
      const newRiffSize = riffInfo.size + needPad;
      
      // Write output file
      const fdOut = fs.openSync(outputPath, 'w');
      
      try {
        // Write RIFF header with new size
        const riffHeader = Buffer.alloc(12);
        riffHeader.write('RIFF', 0, 'ascii');
        riffHeader.writeUInt32LE(newRiffSize, 4);
        riffHeader.write(riffInfo.type, 8, 'ascii');
        fs.writeSync(fdOut, riffHeader, 0, 12, 0);
        
        let writePos = 12;
        
        // Copy chunks, adjusting JUNK size
        for (let i = 0; i < riffInfo.chunks.length; i++) {
          const chunk = riffInfo.chunks[i]!;
          const originalSize = chunk.size; // Keep original size for padding calculation
          
          // Write chunk header
          const chunkHeader = Buffer.alloc(8);
          chunkHeader.write(chunk.id, 0, 'ascii');
          
          if (i === junkIdx) {
            // Write adjusted JUNK size
            chunkHeader.writeUInt32LE(newJunkSize, 4);
            fs.writeSync(fdOut, chunkHeader, 0, 8, writePos);
            writePos += 8;
            
            // Write JUNK data (all zeros)
            const junkData = Buffer.alloc(newJunkSize, 0x00);
            fs.writeSync(fdOut, junkData, 0, newJunkSize, writePos);
            writePos += newJunkSize;
            
            // Handle padding based on ORIGINAL size (like Python does)
            if (originalSize % 2 === 1) {
              const pad = Buffer.alloc(1, 0x00);
              fs.writeSync(fdOut, pad, 0, 1, writePos);
              writePos += 1;
            }
          } else {
            // Copy original chunk
            chunkHeader.writeUInt32LE(chunk.size, 4);
            fs.writeSync(fdOut, chunkHeader, 0, 8, writePos);
            writePos += 8;
            
            // Copy chunk data
            const data = Buffer.alloc(chunk.size);
            fs.readSync(fdIn, data, 0, chunk.size, chunk.dataOffset);
            fs.writeSync(fdOut, data, 0, chunk.size, writePos);
            writePos += chunk.size;
            
            // Handle padding based on original size
            if (originalSize % 2 === 1) {
              const pad = Buffer.alloc(1, 0x00);
              fs.writeSync(fdOut, pad, 0, 1, writePos);
              writePos += 1;
            }
          }
        }
        
        console.log(`JUNK adjusted to ${newJunkSize} bytes, RIFF size to ${newRiffSize}`);
      } finally {
        fs.closeSync(fdOut);
      }
    } finally {
      fs.closeSync(fdIn);
    }
  }


  /**
   * Second pass: Align all frames by padding each frame to align next frame's data start
   * 
   * Logic: For each frame (including the first), pad its data so that the next frame's
   * data start is 8-byte aligned. The first frame's data start is already aligned by pass 1.
   * We need to ensure each subsequent frame's data start is also aligned.
   * 
   * Key insight: If frame N's data start is at offset X (8-byte aligned), and frame N's
   * total chunk size (8 + data_len + word_pad) is a multiple of 8, then frame N+1's
   * data start will also be 8-byte aligned.
   */
  async alignAllFrames(inputPath: string, outputPath: string): Promise<void> {
    const fdIn = fs.openSync(inputPath, 'r');
    
    try {
      const riffInfo = this.findRootChunks(fdIn);
      if (!riffInfo) {
        throw new Error('Invalid AVI file format');
      }
      
      // Find movi and idx1 chunks
      let moviChunk: ChunkInfo | null = null;
      let idx1Chunk: ChunkInfo | null = null;
      
      for (let i = 0; i < riffInfo.chunks.length; i++) {
        const chunk = riffInfo.chunks[i]!;
        if (chunk.id === 'LIST') {
          const typeBuffer = Buffer.alloc(4);
          fs.readSync(fdIn, typeBuffer, 0, 4, chunk.dataOffset);
          const listType = typeBuffer.toString('ascii');
          if (listType === 'movi') {
            moviChunk = chunk;
          }
        } else if (chunk.id === 'idx1') {
          idx1Chunk = chunk;
        }
      }
      
      if (!moviChunk || !idx1Chunk) {
        throw new Error('movi or idx1 chunk not found');
      }
      
      // Get all frame chunks in movi
      const jpegChunks = this.findMoviChunks(fdIn, moviChunk.dataOffset, moviChunk.size);
      if (jpegChunks.length === 0) {
        throw new Error('No frames found in movi');
      }
      
      // Read all frame data
      const jpegDatas: Buffer[] = [];
      for (const chunk of jpegChunks) {
        const data = Buffer.alloc(chunk.size);
        fs.readSync(fdIn, data, 0, chunk.size, chunk.dataOffset);
        jpegDatas.push(data);
      }
      
      // Pad each frame (except the last) to ensure next frame's data is 8-byte aligned
      // For frame N with data length L:
      // - Chunk header: 8 bytes
      // - Data: L bytes  
      // - Word padding: L % 2 bytes (to make chunk 2-byte aligned)
      // - Total chunk size: 8 + L + (L % 2)
      // For next frame's data to be aligned, total chunk size must be multiple of 8
      // So we need: (8 + L + (L % 2)) % 8 == 0
      // => (L + (L % 2)) % 8 == 0
      const newJpegDatas: Buffer[] = [];
      
      for (let idx = 0; idx < jpegChunks.length; idx++) {
        let frameData = jpegDatas[idx]!;
        
        // For all frames except the last, pad to align next frame
        if (idx < jpegChunks.length - 1) {
          const dataLen = frameData.length;
          const wordPad = dataLen % 2;
          const totalWithWordPad = dataLen + wordPad;
          const needPad = (AviAligner.ALIGNMENT - (totalWithWordPad % AviAligner.ALIGNMENT)) % AviAligner.ALIGNMENT;
          
          if (needPad > 0) {
            // Pad this frame's JPEG data
            let padded = this.padAppn(frameData, needPad);
            if (!padded) {
              padded = this.insertApp1ToJpeg(frameData, needPad);
            }
            frameData = padded;
          }
        }
        
        newJpegDatas.push(frameData);
      }
      
      // Track new chunk offsets for idx1 update
      const newChunkOffsets: number[] = [];
      
      // Write output file (use 'w+' for read-write access)
      const fdOut = fs.openSync(outputPath, 'w+');
      
      try {
        // Copy everything before movi data
        const moviListOff = moviChunk.offset;
        const moviDataStart = moviChunk.dataOffset + 4; // After 'movi' type
        
        const beforeMovi = Buffer.alloc(moviDataStart);
        fs.readSync(fdIn, beforeMovi, 0, moviDataStart, 0);
        fs.writeSync(fdOut, beforeMovi, 0, moviDataStart, 0);
        
        let pos = moviDataStart;
        
        // Write each frame chunk
        for (let idx = 0; idx < jpegChunks.length; idx++) {
          const chunk = jpegChunks[idx]!;
          const data = newJpegDatas[idx]!;
          
          // Record this chunk's offset
          newChunkOffsets.push(pos);
          
          // Write chunk header
          const chunkHeader = Buffer.alloc(8);
          chunkHeader.write(chunk.id, 0, 'ascii');
          chunkHeader.writeUInt32LE(data.length, 4);
          fs.writeSync(fdOut, chunkHeader, 0, 8, pos);
          pos += 8;
          
          // Write chunk data
          fs.writeSync(fdOut, data, 0, data.length, pos);
          pos += data.length;
          
          // Handle word alignment padding (AVI requires 2-byte alignment)
          if (data.length % 2 === 1) {
            const pad = Buffer.alloc(1, 0x00);
            fs.writeSync(fdOut, pad, 0, 1, pos);
            pos += 1;
          }
        }
        
        // Copy rest of file (after movi)
        const moviEnd = moviListOff + 8 + moviChunk.size;
        const restStart = pos;
        
        // Read and write rest of file
        const fileSize = fs.fstatSync(fdIn).size;
        const restSize = fileSize - moviEnd;
        if (restSize > 0) {
          const rest = Buffer.alloc(restSize);
          fs.readSync(fdIn, rest, 0, restSize, moviEnd);
          fs.writeSync(fdOut, rest, 0, restSize, restStart);
        }
        
        // Update movi size
        const newMoviSize = restStart - (moviListOff + 8);
        const moviSizeBuffer = Buffer.alloc(4);
        moviSizeBuffer.writeUInt32LE(newMoviSize, 0);
        fs.writeSync(fdOut, moviSizeBuffer, 0, 4, moviListOff + 4);
        
        // Update RIFF size
        const newFileSize = restStart + restSize;
        const riffSizeBuffer = Buffer.alloc(4);
        riffSizeBuffer.writeUInt32LE(newFileSize - 8, 0);
        fs.writeSync(fdOut, riffSizeBuffer, 0, 4, 4);
        
        // Re-parse output file to find idx1 position
        const riffInfo2 = this.findRootChunks(fdOut);
        if (!riffInfo2) {
          throw new Error('Failed to re-parse output file');
        }
        
        let newMoviDataOffset: number | null = null;
        let newIdx1Offset: number | null = null;
        
        for (const chunk of riffInfo2.chunks) {
          if (chunk.id === 'LIST') {
            const typeBuffer = Buffer.alloc(4);
            fs.readSync(fdOut, typeBuffer, 0, 4, chunk.dataOffset);
            if (typeBuffer.toString('ascii') === 'movi') {
              newMoviDataOffset = chunk.dataOffset;
            }
          } else if (chunk.id === 'idx1') {
            newIdx1Offset = chunk.offset;
          }
        }
        
        if (newIdx1Offset === null || newMoviDataOffset === null) {
          console.log('Warning: idx1 chunk not found in output, skipping idx1 update');
        } else {
          // Update idx1 offsets
          let idx1Pos = newIdx1Offset + 8;
          
          for (let idx = 0; idx < jpegChunks.length; idx++) {
            // Read idx1 entry
            const entry = Buffer.alloc(16);
            fs.readSync(fdOut, entry, 0, 16, idx1Pos);
            
            // Calculate new offset (relative to 'movi' type)
            const newOff = newChunkOffsets[idx]! - newMoviDataOffset;
            const newLen = newJpegDatas[idx]!.length;
            
            // Write new offset and size
            entry.writeUInt32LE(newOff, 8);
            entry.writeUInt32LE(newLen, 12);
            fs.writeSync(fdOut, entry, 0, 16, idx1Pos);
            
            idx1Pos += 16;
          }
        }
        
        console.log(`All frames aligned, movi size: ${newMoviSize}, RIFF size: ${newFileSize - 8}`);
      } finally {
        fs.closeSync(fdOut);
      }
    } finally {
      fs.closeSync(fdIn);
    }
  }

  /**
   * Process AVI file with both alignment passes
   * @param inputPath - Input AVI file path
   * @param outputPath - Output AVI file path
   * @param debug - If true, keep intermediate files for inspection
   */
  async process(inputPath: string, outputPath: string, debug: boolean = false): Promise<void> {
    // Check input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error('Input file does not exist');
    }
    
    // Create output directory if needed
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create temp file for first pass (use .pass1.avi for debug mode)
    const pass1Path = debug 
      ? outputPath.replace(/\.avi$/i, '.pass1.avi')
      : outputPath + '.align.temp.avi';
    
    try {
      // First pass: align first frame via JUNK adjustment
      await this.alignFirstFrame(inputPath, pass1Path);
      
      if (debug) {
        console.log(`[DEBUG] First pass output saved: ${pass1Path}`);
      }
      
      // Second pass: align all frames via APP1 padding
      await this.alignAllFrames(pass1Path, outputPath);
      
      if (debug) {
        console.log(`[DEBUG] Final output saved: ${outputPath}`);
        console.log(`[DEBUG] Intermediate files preserved for inspection`);
      }
    } finally {
      // Clean up temp file only if not in debug mode
      if (!debug && fs.existsSync(pass1Path)) {
        fs.unlinkSync(pass1Path);
      }
    }
  }
}
