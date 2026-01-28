/**
 * HoneyGUI Binary File Headers
 */

import { PixelFormat, PixelBytes } from './types';

/**
 * GIF 文件头信息（从 GIF 文件中解析）
 */
export interface GIFInfo {
    width: number;
    height: number;
}

/**
 * gui_rgb_data_head_t - 8 bytes
 */
export class RGBDataHeader {
    scan = 0;
    align = 0;
    resize = 0;  // 0=no, 1=50%, 2=70%, 3=80%
    compress = 0;
    jpeg = 0;
    idu = 0;
    rsvd = 0;
    type: PixelFormat;
    width: number;
    height: number;
    version = 0;
    rsvd2 = 0;

    constructor(width: number, height: number, format: PixelFormat, compress = false) {
        this.width = width;
        this.height = height;
        this.type = format;
        this.compress = compress ? 1 : 0;
    }

    pack(): Buffer {
        const buffer = Buffer.alloc(8);
        
        // Byte 0: flags (bitfield)
        const flags = (
            (this.scan & 0x01) |
            ((this.align & 0x01) << 1) |
            ((this.resize & 0x03) << 2) |
            ((this.compress & 0x01) << 4) |
            ((this.jpeg & 0x01) << 5) |
            ((this.idu & 0x01) << 6) |
            ((this.rsvd & 0x01) << 7)
        );
        
        buffer.writeUInt8(flags & 0xFF, 0);
        buffer.writeUInt8(this.type & 0xFF, 1);
        buffer.writeInt16LE(this.width, 2);
        buffer.writeInt16LE(this.height, 4);
        buffer.writeUInt8(this.version & 0xFF, 6);
        buffer.writeUInt8(this.rsvd2 & 0xFF, 7);
        
        return buffer;
    }
}

/**
 * imdc_file_header_t - 12 bytes
 */
export class IMDCFileHeader {
    algorithm: number;
    feature_1: number;
    feature_2: number;
    pixel_bytes: PixelBytes;
    reserved = [0, 0, 0];
    raw_pic_width: number;
    raw_pic_height: number;

    constructor(
        algorithm: number,
        feature_1: number,
        feature_2: number,
        pixel_bytes: PixelBytes,
        width: number,
        height: number
    ) {
        this.algorithm = algorithm & 0x03;
        this.feature_1 = feature_1 & 0x03;
        this.feature_2 = feature_2 & 0x03;
        this.pixel_bytes = pixel_bytes & 0x03;
        this.raw_pic_width = width;
        this.raw_pic_height = height;
    }

    pack(): Buffer {
        const buffer = Buffer.alloc(12);
        
        // Byte 0: algorithm_type (bitfield)
        const algorithm_type = (
            (this.algorithm & 0x03) |
            ((this.feature_1 & 0x03) << 2) |
            ((this.feature_2 & 0x03) << 4) |
            ((this.pixel_bytes & 0x03) << 6)
        );
        
        buffer.writeUInt8(algorithm_type, 0);
        buffer.writeUInt8(this.reserved[0], 1);
        buffer.writeUInt8(this.reserved[1], 2);
        buffer.writeUInt8(this.reserved[2], 3);
        buffer.writeUInt32LE(this.raw_pic_width, 4);
        buffer.writeUInt32LE(this.raw_pic_height, 8);
        
        return buffer;
    }
}


/**
 * gui_gif_file_head_t - 16 bytes header + GIF data
 * 
 * Structure:
 * - gui_rgb_data_head_t img_header (8 bytes)
 * - uint32_t size (4 bytes) - GIF 原始数据大小
 * - uint32_t dummy (4 bytes) - 对齐填充
 * - uint8_t gif[] - GIF 原始数据
 */
export class GIFFileHeader {
    private header: RGBDataHeader;
    private gifSize: number;

    constructor(width: number, height: number, gifDataSize: number) {
        this.header = new RGBDataHeader(width, height, PixelFormat.GIF, false);
        this.gifSize = gifDataSize;
    }

    pack(): Buffer {
        const headerBuffer = this.header.pack();  // 8 bytes
        const sizeBuffer = Buffer.alloc(8);       // size (4) + dummy (4)
        
        sizeBuffer.writeUInt32LE(this.gifSize, 0);
        sizeBuffer.writeUInt32LE(0, 4);  // dummy for alignment
        
        return Buffer.concat([headerBuffer, sizeBuffer]);
    }
}

/**
 * 从 GIF 文件数据中解析宽高信息
 * GIF 文件格式：
 * - 0-2: 'GIF'
 * - 3-5: '87a' 或 '89a'
 * - 6-7: 宽度 (little-endian)
 * - 8-9: 高度 (little-endian)
 */
export function parseGIFInfo(buffer: Buffer): GIFInfo | null {
    // 检查 GIF 签名
    if (buffer.length < 10) {
        return null;
    }
    
    const signature = buffer.toString('ascii', 0, 3);
    const version = buffer.toString('ascii', 3, 6);
    
    if (signature !== 'GIF' || (version !== '87a' && version !== '89a')) {
        return null;
    }
    
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    
    return { width, height };
}
