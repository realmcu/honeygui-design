/**
 * Pixel Format Converter
 */

import { PixelFormat } from './types';

interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

function rgbToRgb565(r: number, g: number, b: number): number {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

export function convertPixels(pixels: RGBA[], format: PixelFormat): Buffer {
    const buffers: Buffer[] = [];
    
    switch (format) {
        case PixelFormat.RGB565:
            for (const { r, g, b } of pixels) {
                const val = rgbToRgb565(r, g, b);
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(val, 0);
                buffers.push(buf);
            }
            break;
        
        case PixelFormat.RGB888:
            for (const { r, g, b } of pixels) {
                buffers.push(Buffer.from([b, g, r]));  // BGR order
            }
            break;
        
        case PixelFormat.ARGB8888:
            for (const { r, g, b, a } of pixels) {
                buffers.push(Buffer.from([b, g, r, a]));  // BGRA order
            }
            break;
        
        case PixelFormat.ARGB8565:
            for (const { r, g, b, a } of pixels) {
                const val = rgbToRgb565(r, g, b);
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(val, 0);  // RGB565 first
                buf.writeUInt8(a, 2);  // Alpha last
                buffers.push(buf);
            }
            break;
        
        case PixelFormat.A8:
            for (const { a } of pixels) {
                buffers.push(Buffer.from([a]));
            }
            break;
        
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
    
    return Buffer.concat(buffers);
}
