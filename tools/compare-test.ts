/**
 * 对比测试：SDK Python vs TS/JS 工具
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ImageConverter } from './image-converter/converter';
import { OBJConverter } from './model-converter/obj-converter';
import { GLTFConverter } from './model-converter/gltf-converter';
import { PixelFormat } from './image-converter/types';

const ASSETS_DIR = '/home/howie_wang/NewProject/assets';
const OUTPUT_DIR = path.join(__dirname, 'compare-output');
const SDK_TOOL_DIR = '/home/howie_wang/.HoneyGUI-SDK/tool';

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const pythonDir = path.join(OUTPUT_DIR, 'python');
const tsDir = path.join(OUTPUT_DIR, 'ts');
if (!fs.existsSync(pythonDir)) fs.mkdirSync(pythonDir, { recursive: true });
if (!fs.existsSync(tsDir)) fs.mkdirSync(tsDir, { recursive: true });

async function compareImage(imagePath: string) {
    const basename = path.basename(imagePath, path.extname(imagePath));
    console.log(`\n📷 测试图片: ${basename}`);

    // Python 工具转换
    const pythonOutput = path.join(pythonDir, `${basename}.bin`);
    try {
        execSync(
            `cd ${SDK_TOOL_DIR}/image-convert-tool && python image_converter.py -i ${imagePath} -o ${pythonOutput} -f auto`,
            { stdio: 'pipe' }
        );
        console.log(`  ✓ Python 生成: ${fs.statSync(pythonOutput).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ Python 失败: ${e.message}`);
        return;
    }

    // TS/JS 工具转换
    const tsOutput = path.join(tsDir, `${basename}.bin`);
    try {
        const converter = new ImageConverter();
        await converter.convert(imagePath, tsOutput, 'auto');
        console.log(`  ✓ TS/JS 生成: ${fs.statSync(tsOutput).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ TS/JS 失败: ${e.message}`);
        return;
    }

    // 对比文件
    const pythonData = fs.readFileSync(pythonOutput);
    const tsData = fs.readFileSync(tsOutput);

    if (pythonData.equals(tsData)) {
        console.log(`  ✅ 完全一致！`);
    } else {
        console.log(`  ⚠️  文件不同`);
        console.log(`     Python: ${pythonData.length} bytes`);
        console.log(`     TS/JS:  ${tsData.length} bytes`);
        
        // 对比头部
        console.log(`     头部对比:`);
        console.log(`       Python: ${pythonData.subarray(0, 8).toString('hex')}`);
        console.log(`       TS/JS:  ${tsData.subarray(0, 8).toString('hex')}`);
    }
}

async function compareOBJ(objPath: string) {
    const basename = path.basename(objPath, '.obj');
    console.log(`\n🎨 测试 OBJ: ${basename}`);

    // Python 工具转换
    const pythonBin = path.join(pythonDir, `desc_${basename}.bin`);
    const pythonTxt = path.join(pythonDir, `desc_${basename}.txt`);
    try {
        execSync(
            `cd ${SDK_TOOL_DIR}/3D-tool && python extract_desc_v3.py ${objPath}`,
            { stdio: 'pipe' }
        );
        // 移动生成的文件
        const sdkBin = path.join(SDK_TOOL_DIR, '3D-tool', `desc_${basename}.bin`);
        const sdkTxt = path.join(SDK_TOOL_DIR, '3D-tool', `desc_${basename}.txt`);
        if (fs.existsSync(sdkBin)) {
            fs.copyFileSync(sdkBin, pythonBin);
            fs.unlinkSync(sdkBin);
        }
        if (fs.existsSync(sdkTxt)) {
            fs.copyFileSync(sdkTxt, pythonTxt);
            fs.unlinkSync(sdkTxt);
        }
        console.log(`  ✓ Python 生成: ${fs.statSync(pythonBin).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ Python 失败: ${e.message}`);
        return;
    }

    // TS/JS 工具转换
    const tsBin = path.join(tsDir, `desc_${basename}.bin`);
    const tsTxt = path.join(tsDir, `desc_${basename}.txt`);
    try {
        const converter = new OBJConverter();
        converter.convert(objPath, tsBin, tsTxt);
        console.log(`  ✓ TS/JS 生成: ${fs.statSync(tsBin).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ TS/JS 失败: ${e.message}`);
        return;
    }

    // 对比文件
    const pythonData = fs.readFileSync(pythonBin);
    const tsData = fs.readFileSync(tsBin);

    if (pythonData.equals(tsData)) {
        console.log(`  ✅ 完全一致！`);
    } else {
        console.log(`  ⚠️  文件不同`);
        console.log(`     Python: ${pythonData.length} bytes`);
        console.log(`     TS/JS:  ${tsData.length} bytes`);
        
        // 对比头部
        console.log(`     头部对比 (前 16 字节):`);
        console.log(`       Python: ${pythonData.subarray(0, 16).toString('hex')}`);
        console.log(`       TS/JS:  ${tsData.subarray(0, 16).toString('hex')}`);
        
        // 对比属性计数
        console.log(`     属性计数 (16-40 字节):`);
        console.log(`       Python: ${pythonData.subarray(16, 40).toString('hex')}`);
        console.log(`       TS/JS:  ${tsData.subarray(16, 40).toString('hex')}`);
    }
}

async function compareGLTF(gltfPath: string) {
    const basename = path.basename(gltfPath, '.gltf');
    console.log(`\n🎮 测试 GLTF: ${basename}`);

    // Python 工具转换
    const pythonBin = path.join(pythonDir, `desc_${basename}.bin`);
    const pythonTxt = path.join(pythonDir, `desc_${basename}.txt`);
    try {
        execSync(
            `cd ${SDK_TOOL_DIR}/3D-tool && python extract_desc_v3.py ${gltfPath}`,
            { stdio: 'pipe' }
        );
        // 移动生成的文件
        const sdkBin = path.join(SDK_TOOL_DIR, '3D-tool', `desc_${basename}.bin`);
        const sdkTxt = path.join(SDK_TOOL_DIR, '3D-tool', `desc_${basename}.txt`);
        if (fs.existsSync(sdkBin)) {
            fs.copyFileSync(sdkBin, pythonBin);
            fs.unlinkSync(sdkBin);
        }
        if (fs.existsSync(sdkTxt)) {
            fs.copyFileSync(sdkTxt, pythonTxt);
            fs.unlinkSync(sdkTxt);
        }
        console.log(`  ✓ Python 生成: ${fs.statSync(pythonBin).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ Python 失败`);
        console.log(`     ${e.message.split('\n')[0]}`);
        return;
    }

    // TS/JS 工具转换
    const tsBin = path.join(tsDir, `desc_${basename}.bin`);
    const tsTxt = path.join(tsDir, `desc_${basename}.txt`);
    try {
        const converter = new GLTFConverter();
        converter.convert(gltfPath, tsBin, tsTxt);
        console.log(`  ✓ TS/JS 生成: ${fs.statSync(tsBin).size} bytes`);
    } catch (e: any) {
        console.log(`  ✗ TS/JS 失败: ${e.message}`);
        return;
    }

    // 对比文件
    const pythonData = fs.readFileSync(pythonBin);
    const tsData = fs.readFileSync(tsBin);

    if (pythonData.equals(tsData)) {
        console.log(`  ✅ 完全一致！`);
    } else {
        console.log(`  ⚠️  文件不同`);
        console.log(`     Python: ${pythonData.length} bytes`);
        console.log(`     TS/JS:  ${tsData.length} bytes`);
        
        // 对比头部
        console.log(`     头部对比 (前 16 字节):`);
        console.log(`       Python: ${pythonData.subarray(0, 16).toString('hex')}`);
        console.log(`       TS/JS:  ${tsData.subarray(0, 16).toString('hex')}`);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('SDK Python vs TS/JS 工具对比测试');
    console.log('='.repeat(60));

    // 测试图片
    console.log('\n📦 图片转换测试');
    console.log('-'.repeat(60));
    const images = [
        'BP_icon01.png',
        'US_Flag_Dirty.png',
        'P17x26White.png'
    ];
    for (const img of images) {
        const imgPath = path.join(ASSETS_DIR, img);
        if (fs.existsSync(imgPath)) {
            await compareImage(imgPath);
        }
    }

    // 测试 OBJ
    console.log('\n📦 OBJ 模型转换测试');
    console.log('-'.repeat(60));
    const objs = [
        'butterfly.obj',
        'earth_tria.obj',
        'face.obj'
    ];
    for (const obj of objs) {
        const objPath = path.join(ASSETS_DIR, obj);
        if (fs.existsSync(objPath)) {
            await compareOBJ(objPath);
        }
    }

    // 测试 GLTF
    console.log('\n📦 GLTF 模型转换测试');
    console.log('-'.repeat(60));
    const gltfs = [
        'flag.gltf',
        'Pikachu_resize.gltf'
    ];
    for (const gltf of gltfs) {
        const gltfPath = path.join(ASSETS_DIR, gltf);
        if (fs.existsSync(gltfPath)) {
            await compareGLTF(gltfPath);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试完成！');
    console.log(`输出目录: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));
}

main().catch(console.error);
