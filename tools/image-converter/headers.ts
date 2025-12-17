/**
 * HoneyGUI Binary File Headers
 */

import { PixelFormat, PixelBytes } from './types';

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
