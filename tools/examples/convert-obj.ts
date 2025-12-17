/**
 * OBJ Model Conversion Example
 */

import { OBJConverter } from '../index';
import * as path from 'path';

function main() {
    const converter = new OBJConverter();

    console.log('Converting OBJ model...');
    
    converter.convert(
        path.join(__dirname, 'model.obj'),
        path.join(__dirname, 'desc_model.bin'),
        path.join(__dirname, 'desc_model.txt')
    );
    
    console.log('✓ OBJ conversion complete');
    console.log('  - Binary file: desc_model.bin');
    console.log('  - C array file: desc_model.txt');
}

main();
