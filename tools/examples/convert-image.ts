/**
 * Image Conversion Example
 */

import { ImageConverter, PixelFormat } from '../index';
import * as path from 'path';

async function main() {
    const converter = new ImageConverter();

    // Example 1: Auto format detection
    console.log('Converting with auto format...');
    await converter.convert(
        path.join(__dirname, 'sample.png'),
        path.join(__dirname, 'output_auto.bin'),
        'auto'
    );
    console.log('✓ Auto format conversion complete');

    // Example 2: Specific format - RGB565
    console.log('\nConverting to RGB565...');
    await converter.convert(
        path.join(__dirname, 'sample.png'),
        path.join(__dirname, 'output_rgb565.bin'),
        PixelFormat.RGB565
    );
    console.log('✓ RGB565 conversion complete');

    // Example 3: ARGB8888 for images with alpha
    console.log('\nConverting to ARGB8888...');
    await converter.convert(
        path.join(__dirname, 'sample_alpha.png'),
        path.join(__dirname, 'output_argb8888.bin'),
        PixelFormat.ARGB8888
    );
    console.log('✓ ARGB8888 conversion complete');
}

main().catch(console.error);
