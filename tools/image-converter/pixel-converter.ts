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

export interface ConvertOptions {
    dither?: boolean;
}

function clamp(v: number): number {
    return Math.max(0, Math.min(255, Math.round(v)));
}

function floydSteinbergDither(pixels: RGBA[], width: number): RGBA[] {
    const height = Math.ceil(pixels.length / width);
    // Create a copy to avoid modifying the original array
    const dithered = pixels.map(p => ({ ...p }));

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (idx >= dithered.length) break;

            const p = dithered[idx];
            
            // Calculate quantization error for RGB565
            // RGB565: R=5bits, G=6bits, B=5bits
            
            // Quantized values (simulating what happens in rgbToRgb565)
            const oldR = p.r;
            const oldG = p.g;
            const oldB = p.b;
            
            const newR = (oldR >> 3) << 3;
            const newG = (oldG >> 2) << 2;
            const newB = (oldB >> 3) << 3;
            
            // We update the current pixel to the quantized value?
            // Actually, convertPixels will do the quantization (truncation).
            // But for error diffusion, we need to know the error between "what we have" and "what we will get".
            // So yes, the error is old - new.
            
            const errR = oldR - newR;
            const errG = oldG - newG;
            const errB = oldB - newB;

            // Distribute error to neighbors
            // Right
            if (x + 1 < width) {
                const nid = idx + 1;
                if (nid < dithered.length) {
                    dithered[nid].r = clamp(dithered[nid].r + errR * 7 / 16);
                    dithered[nid].g = clamp(dithered[nid].g + errG * 7 / 16);
                    dithered[nid].b = clamp(dithered[nid].b + errB * 7 / 16);
                }
            }
            
            // Bottom Left
            if (x - 1 >= 0 && y + 1 < height) {
                const nid = idx + width - 1;
                if (nid < dithered.length) {
                    dithered[nid].r = clamp(dithered[nid].r + errR * 3 / 16);
                    dithered[nid].g = clamp(dithered[nid].g + errG * 3 / 16);
                    dithered[nid].b = clamp(dithered[nid].b + errB * 3 / 16);
                }
            }
            
            // Bottom
            if (y + 1 < height) {
                const nid = idx + width;
                if (nid < dithered.length) {
                    dithered[nid].r = clamp(dithered[nid].r + errR * 5 / 16);
                    dithered[nid].g = clamp(dithered[nid].g + errG * 5 / 16);
                    dithered[nid].b = clamp(dithered[nid].b + errB * 5 / 16);
                }
            }
            
            // Bottom Right
            if (x + 1 < width && y + 1 < height) {
                const nid = idx + width + 1;
                if (nid < dithered.length) {
                    dithered[nid].r = clamp(dithered[nid].r + errR * 1 / 16);
                    dithered[nid].g = clamp(dithered[nid].g + errG * 1 / 16);
                    dithered[nid].b = clamp(dithered[nid].b + errB * 1 / 16);
                }
            }
        }
    }
    return dithered;
}

export function convertPixels(pixels: RGBA[], width: number, format: PixelFormat, options?: ConvertOptions): Buffer {
    const buffers: Buffer[] = [];
    
    // Apply dithering if enabled and target format is 16-bit
    let processedPixels = pixels;
    if (options?.dither && (format === PixelFormat.RGB565 || format === PixelFormat.ARGB8565)) {
        processedPixels = floydSteinbergDither(pixels, width);
    }

    switch (format) {
        case PixelFormat.RGB565:
            for (const { r, g, b } of processedPixels) {
                const val = rgbToRgb565(r, g, b);
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(val, 0);
                buffers.push(buf);
            }
            break;
        
        case PixelFormat.RGB888:
            for (const { r, g, b } of processedPixels) {
                buffers.push(Buffer.from([b, g, r]));  // BGR order
            }
            break;
        
        case PixelFormat.ARGB8888:
            for (const { r, g, b, a } of processedPixels) {
                buffers.push(Buffer.from([b, g, r, a]));  // BGRA order
            }
            break;
        
        case PixelFormat.ARGB8565:
            for (const { r, g, b, a } of processedPixels) {
                const val = rgbToRgb565(r, g, b);
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(val, 0);  // RGB565 first
                buf.writeUInt8(a, 2);  // Alpha last
                buffers.push(buf);
            }
            break;
        
        case PixelFormat.A8:
            for (const { a } of processedPixels) {
                buffers.push(Buffer.from([a]));
            }
            break;
        
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
    
    return Buffer.concat(buffers);
}
