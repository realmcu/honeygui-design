import * as path from 'path';
import * as fs from 'fs';
import { OBJConverter } from '../../tools/model-converter/obj-converter';
import { GLTFConverter } from '../../tools/model-converter/gltf-converter';

export interface Model3DConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export class Model3DConverterService {
    private objConverter: OBJConverter;
    private gltfConverter: GLTFConverter;

    constructor(sdkPath?: string) {
        // SDK path 不再需要，但保留参数以兼容现有代码
        this.objConverter = new OBJConverter();
        this.gltfConverter = new GLTFConverter();
    }

    /**
     * Convert a single 3D model to descriptor bin file
     * @param inputPath - Path to .obj or .gltf file
     * @param outputPath - Path to output .bin file
     */
    async convert(inputPath: string, outputPath: string): Promise<Model3DConvertResult> {
        try {
            if (!fs.existsSync(inputPath)) {
                return { success: false, inputPath, outputPath, error: `Input file not found: ${inputPath}` };
            }

            const ext = path.extname(inputPath).toLowerCase();
            
            // GLTF 预检查：检查 buffer 文件
            if (ext === '.gltf') {
                const binPath = inputPath.replace(/\.gltf$/i, '.bin');
                if (!fs.existsSync(binPath)) {
                    console.warn(`[3D转换] GLTF buffer 文件缺失，跳过: ${path.basename(binPath)}`);
                    return { 
                        success: false, 
                        inputPath, 
                        outputPath, 
                        error: `GLTF incomplete: missing ${path.basename(binPath)}` 
                    };
                }
            }

            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const txtPath = outputPath.replace(/\.bin$/i, '.txt');

            if (ext === '.obj') {
                this.objConverter.convert(inputPath, outputPath, txtPath);
            } else if (ext === '.gltf') {
                this.gltfConverter.convert(inputPath, outputPath, txtPath);
            } else {
                return { success: false, inputPath, outputPath, error: `Unsupported file type: ${ext}` };
            }

            // 删除生成的 txt 文件（不需要）
            if (fs.existsSync(txtPath)) {
                fs.unlinkSync(txtPath);
            }

            return { success: true, inputPath, outputPath };
        } catch (error: any) {
            return { success: false, inputPath, outputPath, error: error.message };
        }
    }

    /**
     * Convert multiple 3D models in batch
     */
    async convertBatch(items: Array<{ input: string; output: string }>): Promise<Model3DConvertResult[]> {
        return Promise.all(items.map(item => this.convert(item.input, item.output)));
    }

    /**
     * Convert all 3D models in assets directory to build output
     */
    async convertAssetsDir(assetsDir: string, outputDir: string): Promise<Model3DConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const modelExts = ['.obj', '.gltf'];
        const items: Array<{ input: string; output: string }> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (modelExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const relativeDir = path.dirname(relativePath);
                    const baseName = path.basename(entry.name, path.extname(entry.name));
                    
                    // 输出文件名格式：desc_xxx.bin
                    const outputFileName = `desc_${baseName}.bin`;
                    const outputPath = path.join(outputDir, relativeDir, outputFileName);
                    items.push({ input: fullPath, output: outputPath });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }
}
