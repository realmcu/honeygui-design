/**
 * FastLZ Compression Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageConverter } from '../image-converter/converter';
import { FastLzCompression } from '../image-converter/compress/fastlz';
import { PixelFormat } from '../image-converter/types';

describe('FastLZ Compression', () => {
    const testDir = path.join(__dirname, 'temp');
    const testImage = path.join(testDir, 'test_fastlz.png');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Create test image
        const { PNG } = require('pngjs');
        const png = new PNG({ width: 20, height: 20 });
        
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 20; x++) {
                const idx = (png.width * y + x) << 2;
                png.data[idx] = x * 12;
                png.data[idx + 1] = y * 12;
                png.data[idx + 2] = 128;
                png.data[idx + 3] = 255;
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

    test('FastLZ compression - RGB565', async () => {
        const converter = new ImageConverter();
        const fastlz = new FastLzCompression();
        converter.setCompressor(fastlz);

        const outputPath = path.join(testDir, 'test_fastlz_rgb565.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);

        const data = fs.readFileSync(outputPath);
        
        // Check header
        const compressFlag = (data[0] >> 4) & 0x01;
        expect(compressFlag).toBe(1);
        
        const format = data[1];
        expect(format).toBe(PixelFormat.RGB565);
        
        // Check IMDC header
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const algorithm = algorithmType & 0x03;
        expect(algorithm).toBe(1); // FastLZ
    });

    test('FastLZ produces valid output', async () => {
        const converter = new ImageConverter();
        converter.setCompressor(new FastLzCompression());

        const outputPath = path.join(testDir, 'test_fastlz_output.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        const data = fs.readFileSync(outputPath);
        
        // File should have: header(8) + imdc(12) + offsets + compressed data
        expect(data.length).toBeGreaterThan(20);
        
        console.log(`FastLZ compressed size: ${data.length} bytes`);
    });
});
