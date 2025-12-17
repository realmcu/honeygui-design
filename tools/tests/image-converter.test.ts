/**
 * Image Converter Test
 * 验证 JS 版本输出格式正确
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageConverter } from '../image-converter/converter';
import { PixelFormat } from '../image-converter/types';

const TEST_DIR = path.join(__dirname, 'temp-converter');

describe('ImageConverter', () => {
    let converter: ImageConverter;

    beforeAll(() => {
        converter = new ImageConverter();
    });

    beforeEach(() => {
        if (!fs.existsSync(TEST_DIR)) {
            fs.mkdirSync(TEST_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true });
        }
    });

    function createTestImage(width: number, height: number, hasAlpha: boolean): string {
        const PNG = require('pngjs').PNG;
        const png = new PNG({ width, height });

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (width * y + x) << 2;
                png.data[idx] = (x * 255) / width;     // R
                png.data[idx + 1] = (y * 255) / height; // G
                png.data[idx + 2] = 128;                // B
                png.data[idx + 3] = hasAlpha ? 200 : 255; // A
            }
        }

        const filePath = path.join(TEST_DIR, `test_${width}x${height}_${hasAlpha ? 'rgba' : 'rgb'}.png`);
        fs.writeFileSync(filePath, PNG.sync.write(png));
        return filePath;
    }

    function verifyBinFile(filePath: string, expectedFormat: PixelFormat, width: number, height: number): void {
        const buf = fs.readFileSync(filePath);
        
        // Verify header (8 bytes)
        expect(buf.length).toBeGreaterThanOrEqual(8);
        
        // Byte 1: format type
        const format = buf.readUInt8(1);
        expect(format).toBe(expectedFormat);
        
        // Bytes 2-3: width
        const w = buf.readInt16LE(2);
        expect(w).toBe(width);
        
        // Bytes 4-5: height
        const h = buf.readInt16LE(4);
        expect(h).toBe(height);
    }

    test('RGB565 format conversion', async () => {
        const inputPath = createTestImage(64, 64, false);
        const outputPath = path.join(TEST_DIR, 'rgb565.bin');

        await converter.convert(inputPath, outputPath, PixelFormat.RGB565);

        expect(fs.existsSync(outputPath)).toBe(true);
        verifyBinFile(outputPath, PixelFormat.RGB565, 64, 64);
        
        // Verify data size: 8 (header) + 64*64*2 (RGB565)
        const buf = fs.readFileSync(outputPath);
        expect(buf.length).toBe(8 + 64 * 64 * 2);
    });

    test('ARGB8888 format conversion', async () => {
        const inputPath = createTestImage(32, 32, true);
        const outputPath = path.join(TEST_DIR, 'argb8888.bin');

        await converter.convert(inputPath, outputPath, PixelFormat.ARGB8888);

        expect(fs.existsSync(outputPath)).toBe(true);
        verifyBinFile(outputPath, PixelFormat.ARGB8888, 32, 32);
        
        // Verify data size: 8 (header) + 32*32*4 (ARGB8888)
        const buf = fs.readFileSync(outputPath);
        expect(buf.length).toBe(8 + 32 * 32 * 4);
    });

    test('RGB888 format conversion', async () => {
        const inputPath = createTestImage(48, 48, false);
        const outputPath = path.join(TEST_DIR, 'rgb888.bin');

        await converter.convert(inputPath, outputPath, PixelFormat.RGB888);

        expect(fs.existsSync(outputPath)).toBe(true);
        verifyBinFile(outputPath, PixelFormat.RGB888, 48, 48);
        
        // Verify data size: 8 (header) + 48*48*3 (RGB888)
        const buf = fs.readFileSync(outputPath);
        expect(buf.length).toBe(8 + 48 * 48 * 3);
    });

    test('ARGB8565 format conversion', async () => {
        const inputPath = createTestImage(40, 40, true);
        const outputPath = path.join(TEST_DIR, 'argb8565.bin');

        await converter.convert(inputPath, outputPath, PixelFormat.ARGB8565);

        expect(fs.existsSync(outputPath)).toBe(true);
        verifyBinFile(outputPath, PixelFormat.ARGB8565, 40, 40);
        
        // Verify data size: 8 (header) + 40*40*3 (ARGB8565)
        const buf = fs.readFileSync(outputPath);
        expect(buf.length).toBe(8 + 40 * 40 * 3);
    });

    test('Auto format detection - no alpha', async () => {
        const inputPath = createTestImage(50, 50, false);
        const outputPath = path.join(TEST_DIR, 'auto_rgb.bin');

        await converter.convert(inputPath, outputPath, 'auto');

        expect(fs.existsSync(outputPath)).toBe(true);
        // Should auto-select RGB565
        verifyBinFile(outputPath, PixelFormat.RGB565, 50, 50);
    });

    test('Auto format detection - with alpha', async () => {
        const inputPath = createTestImage(50, 50, true);
        const outputPath = path.join(TEST_DIR, 'auto_rgba.bin');

        await converter.convert(inputPath, outputPath, 'auto');

        expect(fs.existsSync(outputPath)).toBe(true);
        // Should auto-select ARGB8888
        verifyBinFile(outputPath, PixelFormat.ARGB8888, 50, 50);
    });
});
