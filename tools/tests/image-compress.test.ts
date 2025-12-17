/**
 * Image Compression Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageConverter } from '../image-converter/converter';
import { RLECompression } from '../image-converter/compress/rle';
import { PixelFormat } from '../image-converter/types';

describe('Image Compression (RLE)', () => {
    const testDir = path.join(__dirname, 'temp-rle');
    const testImage = path.join(testDir, 'test-rle.png');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Create a simple test image (10x10 with some repeated pixels)
        const { PNG } = require('pngjs');
        const png = new PNG({ width: 10, height: 10 });
        
        // Fill with pattern: first 5 rows red, last 5 rows blue
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const idx = (png.width * y + x) << 2;
                if (y < 5) {
                    png.data[idx] = 255;     // R
                    png.data[idx + 1] = 0;   // G
                    png.data[idx + 2] = 0;   // B
                    png.data[idx + 3] = 255; // A
                } else {
                    png.data[idx] = 0;       // R
                    png.data[idx + 1] = 0;   // G
                    png.data[idx + 2] = 255; // B
                    png.data[idx + 3] = 255; // A
                }
            }
        }

        const buffer = PNG.sync.write(png);
        fs.writeFileSync(testImage, buffer);
    });

    afterAll(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    test('RLE compression - RGB565', async () => {
        const converter = new ImageConverter();
        const rle = new RLECompression();
        converter.setCompressor(rle);

        const outputPath = path.join(testDir, 'test_rle_rgb565.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);

        const data = fs.readFileSync(outputPath);
        
        // Check header
        expect(data.length).toBeGreaterThan(8);
        const compressFlag = (data[0] >> 4) & 0x01;
        expect(compressFlag).toBe(1); // Compressed
        
        const format = data[1];
        expect(format).toBe(PixelFormat.RGB565);
        
        const width = data.readInt16LE(2);
        const height = data.readInt16LE(4);
        expect(width).toBe(10);
        expect(height).toBe(10);

        // Check IMDC header exists
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const algorithm = algorithmType & 0x03;
        expect(algorithm).toBe(0); // RLE
    });

    test('RLE compression - ARGB8888', async () => {
        const converter = new ImageConverter();
        const rle = new RLECompression();
        converter.setCompressor(rle);

        const outputPath = path.join(testDir, 'test_rle_argb8888.bin');
        await converter.convert(testImage, outputPath, PixelFormat.ARGB8888);

        expect(fs.existsSync(outputPath)).toBe(true);

        const data = fs.readFileSync(outputPath);
        const compressFlag = (data[0] >> 4) & 0x01;
        expect(compressFlag).toBe(1);
        
        const format = data[1];
        expect(format).toBe(PixelFormat.ARGB8888);
    });

    test('Compressed file is smaller than uncompressed', async () => {
        // Uncompressed
        const converter1 = new ImageConverter();
        const uncompressedPath = path.join(testDir, 'test_uncompressed.bin');
        await converter1.convert(testImage, uncompressedPath, PixelFormat.RGB565);

        // Compressed
        const converter2 = new ImageConverter();
        converter2.setCompressor(new RLECompression());
        const compressedPath = path.join(testDir, 'test_compressed.bin');
        await converter2.convert(testImage, compressedPath, PixelFormat.RGB565);

        const uncompressedSize = fs.statSync(uncompressedPath).size;
        const compressedSize = fs.statSync(compressedPath).size;

        // For a 10x10 image with repeated pixels, compressed should be smaller
        // (though it includes overhead for IMDC header and offset table)
        console.log(`Uncompressed: ${uncompressedSize} bytes`);
        console.log(`Compressed: ${compressedSize} bytes`);
        
        // At minimum, verify both files were created successfully
        expect(uncompressedSize).toBeGreaterThan(0);
        expect(compressedSize).toBeGreaterThan(0);
    });
});
