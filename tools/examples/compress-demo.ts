/**
 * Image Compression Demo
 * 演示如何使用 RLE 压缩
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { ImageConverter } from '../image-converter/converter';
import { RLECompression } from '../image-converter/compress/rle';
import { PixelFormat } from '../image-converter/types';

async function main() {
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create test image (100x100 with gradient)
    const testImage = path.join(outputDir, 'gradient.png');
    const png = new PNG({ width: 100, height: 100 });
    
    for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 100; x++) {
            const idx = (png.width * y + x) << 2;
            png.data[idx] = x * 2.55;     // R: 0-255
            png.data[idx + 1] = y * 2.55; // G: 0-255
            png.data[idx + 2] = 128;      // B: constant
            png.data[idx + 3] = 255;      // A: opaque
        }
    }
    
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(testImage, buffer);
    console.log(`✓ Created test image: ${testImage}`);

    // Convert without compression
    const converter1 = new ImageConverter();
    const uncompressedPath = path.join(outputDir, 'gradient_uncompressed.bin');
    await converter1.convert(testImage, uncompressedPath, PixelFormat.RGB565);
    const uncompressedSize = fs.statSync(uncompressedPath).size;
    console.log(`✓ Uncompressed: ${uncompressedPath} (${uncompressedSize} bytes)`);

    // Convert with RLE compression
    const converter2 = new ImageConverter();
    const rle = new RLECompression(1, 0, 1); // Default parameters
    converter2.setCompressor(rle);
    const compressedPath = path.join(outputDir, 'gradient_rle.bin');
    await converter2.convert(testImage, compressedPath, PixelFormat.RGB565);
    const compressedSize = fs.statSync(compressedPath).size;
    console.log(`✓ RLE Compressed: ${compressedPath} (${compressedSize} bytes)`);

    // Calculate compression ratio
    const ratio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(2);
    console.log(`\n📊 Compression ratio: ${ratio}% reduction`);
    console.log(`   Original: ${uncompressedSize} bytes`);
    console.log(`   Compressed: ${compressedSize} bytes`);
    console.log(`   Saved: ${uncompressedSize - compressedSize} bytes`);

    // Verify binary format
    const data = fs.readFileSync(compressedPath);
    console.log('\n📋 Binary format verification:');
    console.log(`   Header size: 8 bytes`);
    console.log(`   Compress flag: ${(data[0] >> 4) & 0x01}`);
    console.log(`   Format: ${data[1]} (RGB565)`);
    console.log(`   Width: ${data.readInt16LE(2)}`);
    console.log(`   Height: ${data.readInt16LE(4)}`);
    
    const imdcStart = 8;
    const algorithmType = data[imdcStart];
    console.log(`\n   IMDC Header (offset ${imdcStart}):`);
    console.log(`   Algorithm: ${algorithmType & 0x03} (RLE)`);
    console.log(`   Feature 1: ${(algorithmType >> 2) & 0x03}`);
    console.log(`   Feature 2: ${(algorithmType >> 4) & 0x03}`);
    console.log(`   Pixel bytes: ${(algorithmType >> 6) & 0x03}`);
}

main().catch(console.error);
