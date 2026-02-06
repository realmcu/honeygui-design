/**
 * Vector Font Header Serialization
 * 
 * This module provides the VectorFontHeader class for creating and serializing
 * vector font headers in the packed binary format matching C++ implementation.
 * 
 * Requirements: 5.1, 5.3, 5.4
 */

import { BinaryWriter } from './binary-writer';
import { FileFlag, IndexMethod } from './types';
import { VERSION, BINARY_FORMAT } from './constants';

/**
 * Configuration for VectorFontHeader
 */
export interface VectorFontHeaderConfig {
  /** Font name (without extension) */
  fontName: string;
  
  /** Font size */
  fontSize: number;
  
  /** Render mode (unused for vector, but stored for compatibility) */
  renderMode: number;
  
  /** Bold flag */
  bold: boolean;
  
  /** Italic flag */
  italic: boolean;
  
  /** Index method (ADDRESS or OFFSET) */
  indexMethod: IndexMethod;
  
  /** Font ascent */
  ascent: number;
  
  /** Font descent */
  descent: number;
  
  /** Line gap */
  lineGap: number;
  
  /** Number of characters in the font */
  characterCount: number;
}

/**
 * VectorFontHeader class for creating and serializing vector font headers
 * 
 * Binary layout (packed, little-endian):
 * - length (1 byte): Total header length
 * - fileFlag (1 byte): 2 for vector
 * - version_major (1 byte): 1
 * - version_minor (1 byte): 0
 * - version_revision (1 byte): 2
 * - version_buildnum (1 byte): 0
 * - fontSize (1 byte): Font size
 * - renderMode (1 byte): Render mode (unused)
 * - bitfield (1 byte): bold, italic, rvd, indexMethod, reserved
 * - indexAreaSize (4 bytes, int32): Size of index array in bytes
 * - fontNameLength (1 byte): Length of font name including null terminator
 * - ascent (2 bytes, int16): Font ascent
 * - descent (2 bytes, int16): Font descent
 * - lineGap (2 bytes, int16): Line gap
 * - fontName (variable): Null-terminated font name
 */
export class VectorFontHeader {
  /** Total header length in bytes */
  public readonly length: number;
  
  /** File flag (always VECTOR = 2) */
  public readonly fileFlag: FileFlag = FileFlag.VECTOR;
  
  /** 
   * Version major (always 0 for vector fonts)
   * 
   * IMPORTANT: Vector fonts use version 0.0.0.1, not 1.0.2!
   * C++ Reference: VectorFontHeader in FontDefine.h
   */
  public readonly versionMajor: number = VERSION.VECTOR.MAJOR;
  
  /** Version minor (always 0 for vector fonts) */
  public readonly versionMinor: number = VERSION.VECTOR.MINOR;
  
  /** Version revision (always 0 for vector fonts) */
  public readonly versionRevision: number = VERSION.VECTOR.REVISION;
  
  /** Version build number (always 1 for vector fonts) */
  public readonly versionBuildnum: number = VERSION.VECTOR.BUILD;
  
  /** Font size */
  public readonly fontSize: number;
  
  /** Render mode (unused for vector) */
  public readonly renderMode: number;
  
  /** Bold flag */
  public readonly bold: boolean;
  
  /** Italic flag */
  public readonly italic: boolean;
  
  /** Reserved flag (always false) */
  public readonly rvd: boolean = false;
  
  /** Index method */
  public readonly indexMethod: IndexMethod;
  
  /** Reserved bits (always 0) */
  public readonly rsvd: number = 0;
  
  /** Index area size in bytes */
  public readonly indexAreaSize: number;
  
  /** Font name length including null terminator */
  public readonly fontNameLength: number;
  
  /** Font ascent */
  public readonly ascent: number;
  
  /** Font descent */
  public readonly descent: number;
  
  /** Line gap */
  public readonly lineGap: number;
  
  /** Font name (without extension) */
  public readonly fontName: string;

  /** Size of fixed header fields before fontName */
  private static readonly FIXED_HEADER_SIZE = 20; // 1+1+1+1+1+1+1+1+1+4+1+2+2+2

  /**
   * Creates a new VectorFontHeader
   * 
   * @param config - Header configuration
   */
  constructor(config: VectorFontHeaderConfig) {
    this.fontName = config.fontName;
    this.fontNameLength = config.fontName.length + 1; // +1 for null terminator
    this.fontSize = config.fontSize;
    this.renderMode = config.renderMode;
    this.bold = config.bold;
    this.italic = config.italic;
    this.indexMethod = config.indexMethod;
    this.ascent = config.ascent;
    this.descent = config.descent;
    this.lineGap = config.lineGap;
    
    // Calculate index area size based on indexMethod
    this.indexAreaSize = this.calculateIndexAreaSize(
      config.indexMethod,
      config.characterCount
    );
    
    // Calculate total header length
    this.length = VectorFontHeader.FIXED_HEADER_SIZE + this.fontNameLength;
  }

  /**
   * Calculates the index area size based on index method
   * 
   * Index modes for vector fonts:
   * 1. indexMethod=ADDRESS: 65536 × 4 bytes (file offsets, NOT char indices!)
   * 2. indexMethod=OFFSET: N × 6 bytes (unicode + file offset)
   * 
   * CRITICAL: Vector fonts use file offsets (4 bytes) in address mode because
   * glyph data sizes vary. Bitmap fonts use character indices (2 bytes) because
   * all glyphs have the same size.
   * 
   * C++ Reference (fontDictionary_o.cpp line 694-701):
   *   if (indexMethod == OFFSET) indexAreaSize = cstNum * (2 + 4)
   *   else indexAreaSize = 65536 * 4
   * 
   * @param indexMethod - Index method (ADDRESS or OFFSET)
   * @param characterCount - Number of characters
   * @returns Index area size in bytes
   */
  private calculateIndexAreaSize(
    indexMethod: IndexMethod,
    characterCount: number
  ): number {
    if (indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 entries × 4 bytes (uint32 file offsets)
      return BINARY_FORMAT.MAX_INDEX_SIZE * 4;
    } else {
      // Offset mode: N entries × 6 bytes (uint16 unicode + uint32 offset)
      return characterCount * 6;
    }
  }

  /**
   * Serializes the header to a Buffer
   * 
   * @returns Buffer containing the serialized header
   */
  toBytes(): Buffer {
    const writer = new BinaryWriter(this.length);
    
    // Write length (1 byte)
    writer.writeUint8(this.length);
    
    // Write fileFlag (1 byte)
    writer.writeUint8(this.fileFlag);
    
    // Write version (4 bytes)
    writer.writeUint8(this.versionMajor);
    writer.writeUint8(this.versionMinor);
    writer.writeUint8(this.versionRevision);
    writer.writeUint8(this.versionBuildnum);
    
    // Write fontSize (1 byte)
    writer.writeUint8(this.fontSize);
    
    // Write renderMode (1 byte)
    writer.writeUint8(this.renderMode);
    
    // Write bitfield (1 byte)
    writer.writeVectorFontBitfield(
      this.bold,
      this.italic,
      this.rvd,
      this.indexMethod
    );
    
    // Write indexAreaSize (4 bytes, int32, little-endian)
    writer.writeInt32LE(this.indexAreaSize);
    
    // Write fontNameLength (1 byte)
    writer.writeUint8(this.fontNameLength);
    
    // Write ascent (2 bytes, int16, little-endian)
    writer.writeInt16LE(this.ascent);
    
    // Write descent (2 bytes, int16, little-endian)
    writer.writeInt16LE(this.descent);
    
    // Write lineGap (2 bytes, int16, little-endian)
    writer.writeInt16LE(this.lineGap);
    
    // Write fontName (null-terminated)
    writer.writeNullTerminatedString(this.fontName);
    
    return writer.getBuffer();
  }

  /**
   * Gets the total size of the header in bytes
   * 
   * @returns Header size in bytes
   */
  getSize(): number {
    return this.length;
  }

  /**
   * Creates a VectorFontHeader from raw binary data
   * 
   * @param data - Buffer containing header data
   * @returns Parsed VectorFontHeader
   */
  static fromBytes(data: Buffer): VectorFontHeader {
    let offset = 0;
    
    // Read length
    const length = data.readUInt8(offset++);
    
    // Read fileFlag
    const fileFlag = data.readUInt8(offset++) as FileFlag;
    
    // Read version
    const versionMajor = data.readUInt8(offset++);
    const versionMinor = data.readUInt8(offset++);
    const versionRevision = data.readUInt8(offset++);
    const versionBuildnum = data.readUInt8(offset++);
    
    // Read fontSize
    const fontSize = data.readUInt8(offset++);
    
    // Read renderMode
    const renderMode = data.readUInt8(offset++);
    
    // Read bitfield
    const bitfield = data.readUInt8(offset++);
    const bold = (bitfield & 0x01) !== 0;
    const italic = (bitfield & 0x02) !== 0;
    const rvd = (bitfield & 0x04) !== 0;
    const indexMethod = ((bitfield & 0x08) !== 0 ? IndexMethod.OFFSET : IndexMethod.ADDRESS);
    
    // Read indexAreaSize (4 bytes, little-endian)
    const indexAreaSize = data.readInt32LE(offset);
    offset += 4;
    
    // Read fontNameLength
    const fontNameLength = data.readUInt8(offset++);
    
    // Read ascent (2 bytes, little-endian)
    const ascent = data.readInt16LE(offset);
    offset += 2;
    
    // Read descent (2 bytes, little-endian)
    const descent = data.readInt16LE(offset);
    offset += 2;
    
    // Read lineGap (2 bytes, little-endian)
    const lineGap = data.readInt16LE(offset);
    offset += 2;
    
    // Read fontName (excluding null terminator)
    const fontName = data.toString('utf8', offset, offset + fontNameLength - 1);
    
    // Calculate character count from indexAreaSize
    let characterCount = 0;
    if (indexMethod === IndexMethod.ADDRESS) {
      characterCount = 0; // Will be determined from actual data
    } else {
      characterCount = indexAreaSize / 6;
    }
    
    return new VectorFontHeader({
      fontName,
      fontSize,
      renderMode,
      bold,
      italic,
      indexMethod,
      ascent,
      descent,
      lineGap,
      characterCount
    });
  }
}
