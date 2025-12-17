/**
 * 简化对比测试：直接生成并分析二进制格式
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageConverter } from './image-converter/converter';
import { OBJConverter } from './model-converter/obj-converter';
import { GLTFConverter } from './model-converter/gltf-converter';

const ASSETS_DIR = '/home/howie_wang/NewProject/assets';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function analyzeImageBin(filePath: string) {
    const data = fs.readFileSync(filePath);
    console.log(`  文件大小: ${data.length} bytes`);
    console.log(`  头部 (8 bytes):`);
    console.log(`    Flags: 0x${data[0].toString(16).padStart(2, '0')}`);
    console.log(`    Format: ${data[1]}`);
    console.log(`    Width: ${data.readInt16LE(2)}`);
    console.log(`    Height: ${data.readInt16LE(4)}`);
    console.log(`    Version: ${data[6]}`);
}

function analyzeModelBin(filePath: string) {
    const data = fs.readFileSync(filePath);
    console.log(`  文件大小: ${data.length} bytes`);
    console.log(`  头部 (16 bytes):`);
    console.log(`    Magic: 0x${data.readUInt16LE(0).toString(16)}`);
    console.log(`    ModelType: ${data[2]}`);
    console.log(`    Version: ${data[3]}`);
    console.log(`    FileSize: ${data.readUInt32LE(4)}`);
    console.log(`    FaceType: ${data[8]}`);
    console.log(`    PayloadOffset: ${data[9]}`);
    
    console.log(`  属性计数 (24 bytes):`);
    console.log(`    Vertices: ${data.readUInt32LE(16)}`);
    console.log(`    Normals: ${data.readUInt32LE(20)}`);
    console.log(`    Texcoords: ${data.readUInt32LE(24)}`);
    console.log(`    Indices: ${data.readUInt32LE(28)}`);
    console.log(`    Faces: ${data.readUInt32LE(32)}`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('TS/JS 工具生成测试');
    console.log('='.repeat(60));

    // 测试图片
    console.log('\n📷 图片转换测试');
    console.log('-'.repeat(60));
    
    const testImage = path.join(ASSETS_DIR, 'BP_icon01.png');
    const imageOutput = path.join(OUTPUT_DIR, 'BP_icon01.bin');
    const converter = new ImageConverter();
    await converter.convert(testImage, imageOutput, 'auto');
    console.log(`✓ 生成: ${path.basename(imageOutput)}`);
    analyzeImageBin(imageOutput);

    // 测试 OBJ
    console.log('\n🎨 OBJ 模型转换测试');
    console.log('-'.repeat(60));
    
    const objFiles = ['butterfly.obj', 'earth_tria.obj', 'face.obj'];
    for (const objFile of objFiles) {
        const objPath = path.join(ASSETS_DIR, objFile);
        if (!fs.existsSync(objPath)) continue;
        
        const basename = path.basename(objFile, '.obj');
        const binOutput = path.join(OUTPUT_DIR, `desc_${basename}.bin`);
        const txtOutput = path.join(OUTPUT_DIR, `desc_${basename}.txt`);
        
        try {
            const objConverter = new OBJConverter();
            objConverter.convert(objPath, binOutput, txtOutput);
            console.log(`\n✓ 生成: ${basename}`);
            analyzeModelBin(binOutput);
        } catch (e: any) {
            console.log(`\n✗ 失败: ${basename}`);
            console.log(`  错误: ${e.message}`);
        }
    }

    // 测试 GLTF
    console.log('\n🎮 GLTF 模型转换测试');
    console.log('-'.repeat(60));
    
    const gltfFiles = ['flag.gltf', 'Pikachu_resize.gltf'];
    for (const gltfFile of gltfFiles) {
        const gltfPath = path.join(ASSETS_DIR, gltfFile);
        if (!fs.existsSync(gltfPath)) continue;
        
        const basename = path.basename(gltfFile, '.gltf');
        const binOutput = path.join(OUTPUT_DIR, `desc_${basename}.bin`);
        const txtOutput = path.join(OUTPUT_DIR, `desc_${basename}.txt`);
        
        try {
            const gltfConverter = new GLTFConverter();
            gltfConverter.convert(gltfPath, binOutput, txtOutput);
            console.log(`\n✓ 生成: ${basename}`);
            analyzeModelBin(binOutput);
        } catch (e: any) {
            console.log(`\n✗ 失败: ${basename}`);
            console.log(`  错误: ${e.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`输出目录: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));
}

main().catch(console.error);
