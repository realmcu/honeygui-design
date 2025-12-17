/**
 * YUV Compression Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageConverter } from '../image-converter/converter';
import { YUVCompression } from '../image-converter/compress/yuv';
import { PixelFormat } from '../image-converter/types';

describe('YUV Compression', () => {
    const testDir = path.join(__dirname, 'temp-yuv');
    const testImage = path.join(testDir, 'test-yuv.png');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Create test image
        const { PNG } = require('pngjs');
        const png = new PNG({ width: 16, height: 16 });
        
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const idx = (png.width * y + x) << 2;
                png.data[idx] = x * 16;
                png.data[idx + 1] = y * 16;
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

    test('YUV444 compression', async () => {
        const converter = new ImageConverter();
        const yuv = new YUVCompression('yuv444', 0, false);
        converter.setCompressor(yuv);

        const outputPath = path.join(testDir, 'test_yuv444.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);

        const data = fs.readFileSync(outputPath);
        const compressFlag = (data[0] >> 4) & 0x01;
        expect(compressFlag).toBe(1);
        
        // Check IMDC header
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const algorithm = algorithmType & 0x03;
        expect(algorithm).toBe(3); // YUV
    });

    test('YUV422 compression', async () => {
        const converter = new ImageConverter();
        const yuv = new YUVCompression('yuv422', 0, false);
        converter.setCompressor(yuv);

        const outputPath = path.join(testDir, 'test_yuv422.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);
        
        const data = fs.readFileSync(outputPath);
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const feature1 = (algorithmType >> 2) & 0x03;
        expect(feature1).toBe(1); // YUV422
    });

    test('YUV411 compression', async () => {
        const converter = new ImageConverter();
        const yuv = new YUVCompression('yuv411', 0, false);
        converter.setCompressor(yuv);

        const outputPath = path.join(testDir, 'test_yuv411.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);
        
        const data = fs.readFileSync(outputPath);
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const feature1 = (algorithmType >> 2) & 0x03;
        expect(feature1).toBe(2); // YUV411
    });

    test('YUV with blur', async () => {
        const converter = new ImageConverter();
        const yuv = new YUVCompression('yuv444', 1, false);
        converter.setCompressor(yuv);

        const outputPath = path.join(testDir, 'test_yuv_blur.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);
        
        const data = fs.readFileSync(outputPath);
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const feature2 = (algorithmType >> 4) & 0x03;
        expect(feature2).toBe(1); // 1-bit blur
    });

    test('YUV + FastLZ compression', async () => {
        const converter = new ImageConverter();
        const yuv = new YUVCompression('yuv444', 0, true);
        converter.setCompressor(yuv);

        const outputPath = path.join(testDir, 'test_yuv_fastlz.bin');
        await converter.convert(testImage, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);
        
        const data = fs.readFileSync(outputPath);
        const imdcStart = 8;
        const algorithmType = data[imdcStart];
        const algorithm = algorithmType & 0x03;
        expect(algorithm).toBe(2); // YUV_FASTLZ
    });

    test('Compression ratio comparison', async () => {
        const sizes: Record<string, number> = {};

        // Uncompressed
        const converter1 = new ImageConverter();
        const uncompressedPath = path.join(testDir, 'test_uncompressed.bin');
        await converter1.convert(testImage, uncompressedPath, PixelFormat.RGB565);
        sizes.uncompressed = fs.statSync(uncompressedPath).size;

        // YUV444
        const converter2 = new ImageConverter();
        converter2.setCompressor(new YUVCompression('yuv444', 0, false));
        const yuv444Path = path.join(testDir, 'test_yuv444_compare.bin');
        await converter2.convert(testImage, yuv444Path, PixelFormat.RGB565);
        sizes.yuv444 = fs.statSync(yuv444Path).size;

        // YUV422
        const converter3 = new ImageConverter();
        converter3.setCompressor(new YUVCompression('yuv422', 0, false));
        const yuv422Path = path.join(testDir, 'test_yuv422_compare.bin');
        await converter3.convert(testImage, yuv422Path, PixelFormat.RGB565);
        sizes.yuv422 = fs.statSync(yuv422Path).size;

        // YUV411
        const converter4 = new ImageConverter();
        converter4.setCompressor(new YUVCompression('yuv411', 0, false));
        const yuv411Path = path.join(testDir, 'test_yuv411_compare.bin');
        await converter4.convert(testImage, yuv411Path, PixelFormat.RGB565);
        sizes.yuv411 = fs.statSync(yuv411Path).size;

        console.log('Compression sizes:');
        console.log(`  Uncompressed: ${sizes.uncompressed} bytes`);
        console.log(`  YUV444: ${sizes.yuv444} bytes`);
        console.log(`  YUV422: ${sizes.yuv422} bytes`);
        console.log(`  YUV411: ${sizes.yuv411} bytes`);

        // YUV422 and YUV411 should be smaller than YUV444
        expect(sizes.yuv422).toBeLessThan(sizes.yuv444);
        expect(sizes.yuv411).toBeLessThan(sizes.yuv422);
    });
});
