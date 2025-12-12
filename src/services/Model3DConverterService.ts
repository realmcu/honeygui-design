import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface Model3DConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export class Model3DConverterService {
    private sdkPath: string;

    constructor(sdkPath: string) {
        this.sdkPath = sdkPath;
    }

    private getConverterScript(): string {
        return path.join(this.sdkPath, 'tool', '3D-tool', 'extract_desc_v3.py');
    }

    /**
     * Get Python command based on platform
     */
    private getPythonCommand(): string {
        // Windows 通常使用 'python'，Linux/macOS 使用 'python3'
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * Convert a single 3D model to descriptor bin file
     * @param inputPath - Path to .obj or .gltf file
     * @param outputPath - Path to output .bin file
     */
    async convert(inputPath: string, outputPath: string): Promise<Model3DConvertResult> {
        const script = this.getConverterScript();
        
        if (!fs.existsSync(script)) {
            console.error(`[3D转换] 脚本不存在: ${script}`);
            return { success: false, inputPath, outputPath, error: `Converter not found: ${script}` };
        }
        
        if (!fs.existsSync(inputPath)) {
            console.error(`[3D转换] 输入文件不存在: ${inputPath}`);
            return { success: false, inputPath, outputPath, error: `Input file not found: ${inputPath}` };
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 获取文件扩展名（在 Promise 外部定义，以便在清理时使用）
        const ext = path.extname(inputPath).toLowerCase();
        
        return new Promise((resolve) => {
            const pythonCmd = this.getPythonCommand();
            // extract_desc_v3.py 的参数格式：python extract_desc_v3.py xxx.obj
            // 输出文件会自动生成在当前工作目录
            
            // 先复制模型文件到输出目录，在输出目录运行转换
            // 这样可以避免 extract_desc_v3.py 调用 png2c.py 时找不到已转换的图片
            const outputDir = path.dirname(outputPath);
            const inputFileName = path.basename(inputPath);
            const tempModelPath = path.join(outputDir, inputFileName);
            
            try {
                // 复制模型文件
                fs.copyFileSync(inputPath, tempModelPath);
                console.log(`[3D转换] 复制模型文件到: ${tempModelPath}`);
                
                // 复制相关文件
                if (ext === '.obj') {
                    // OBJ 文件：复制 .mtl 材质文件
                    const mtlPath = inputPath.replace(/\.obj$/i, '.mtl');
                    if (fs.existsSync(mtlPath)) {
                        const tempMtlPath = path.join(outputDir, path.basename(mtlPath));
                        fs.copyFileSync(mtlPath, tempMtlPath);
                        console.log(`[3D转换] 复制材质文件到: ${tempMtlPath}`);
                    } else {
                        console.log(`[3D转换] 未找到材质文件: ${mtlPath}`);
                    }
                } else if (ext === '.gltf') {
                    // GLTF 文件：复制 .bin 数据文件
                    const binPath = inputPath.replace(/\.gltf$/i, '.bin');
                    if (fs.existsSync(binPath)) {
                        const tempBinPath = path.join(outputDir, path.basename(binPath));
                        fs.copyFileSync(binPath, tempBinPath);
                        console.log(`[3D转换] 复制 GLTF 数据文件到: ${tempBinPath}`);
                    } else {
                        console.log(`[3D转换] 未找到 GLTF 数据文件: ${binPath}`);
                    }
                }
                
                // 列出输出目录中的所有文件，帮助调试
                const filesInOutputDir = fs.readdirSync(outputDir);
                console.log(`[3D转换] 输出目录中的文件:`, filesInOutputDir);
            } catch (err: any) {
                console.error(`[3D转换] 复制文件失败: ${err.message}`);
                resolve({ success: false, inputPath, outputPath, error: `Failed to copy model: ${err.message}` });
                return;
            }
            
            console.log(`[3D转换] 工作目录: ${outputDir}`);
            console.log(`[3D转换] 执行命令: ${pythonCmd} ${script} ${inputFileName}`);
            const proc = spawn(pythonCmd, [script, inputFileName], {
                cwd: outputDir  // 在输出目录运行，这样可以访问已转换的图片
            });
            
            let stdout = '';
            let stderr = '';
            
            // 自动回答交互式问题：不转换图片（输入 'n'）
            proc.stdout.on('data', (data) => { 
                const text = data.toString();
                stdout += text;
                console.log(`[3D转换] stdout: ${text}`);
                
                // 检测是否在询问是否转换图片
                if (text.includes('convert') && text.includes('image') || 
                    text.includes('png2c') || 
                    text.includes('(y/n)') ||
                    text.includes('(Y/N)')) {
                    console.log(`[3D转换] 检测到交互式提示，自动回答 'n'（不转换图片）`);
                    proc.stdin.write('n\n');
                }
            });
            
            proc.stderr.on('data', (data) => { 
                const text = data.toString();
                stderr += text;
                console.log(`[3D转换] stderr: ${text}`);
            });
            
            proc.on('close', (code) => {
                console.log(`[3D转换] 进程退出，code: ${code}`);
                
                if (code === 0) {
                    // 脚本生成的文件名格式：
                    // OBJ: desc_xxx.bin
                    // GLTF: gltf_desc_xxx.bin
                    // 文件会生成在输出目录下
                    const inputBaseName = path.basename(inputPath, path.extname(inputPath));
                    const ext = path.extname(inputPath).toLowerCase();
                    
                    console.log(`[3D转换] inputBaseName: ${inputBaseName}`);
                    console.log(`[3D转换] ext: ${ext}`);
                    
                    // 列出目录中的所有文件
                    try {
                        const files = fs.readdirSync(outputDir);
                        console.log(`[3D转换] 输出目录中的文件:`, files.filter(f => f.includes('desc') || f.includes(inputBaseName)));
                    } catch (err: any) {
                        console.error(`[3D转换] 无法读取目录: ${err.message}`);
                    }
                    
                    // 生成的文件已经在输出目录，检查是否存在
                    console.log(`[3D转换] 期望的输出文件: ${outputPath}`);
                    console.log(`[3D转换] 文件是否存在: ${fs.existsSync(outputPath)}`);
                    
                    if (fs.existsSync(outputPath)) {
                        console.log(`[3D转换] 文件生成成功`);
                        
                        try {
                            // 删除临时复制的模型文件
                            if (fs.existsSync(tempModelPath)) {
                                fs.unlinkSync(tempModelPath);
                                console.log(`[3D转换] 删除临时模型文件: ${tempModelPath}`);
                            }
                            
                            // 删除临时复制的相关文件
                            if (ext === '.obj') {
                                // OBJ: 删除 .mtl 文件
                                const tempMtlPath = tempModelPath.replace(/\.obj$/i, '.mtl');
                                if (fs.existsSync(tempMtlPath)) {
                                    fs.unlinkSync(tempMtlPath);
                                    console.log(`[3D转换] 删除临时材质文件: ${tempMtlPath}`);
                                }
                            } else if (ext === '.gltf') {
                                // GLTF: 删除 .bin 数据文件
                                const tempBinPath = tempModelPath.replace(/\.gltf$/i, '.bin');
                                if (fs.existsSync(tempBinPath)) {
                                    fs.unlinkSync(tempBinPath);
                                    console.log(`[3D转换] 删除临时 GLTF 数据文件: ${tempBinPath}`);
                                }
                            }
                            
                            // 删除生成的 txt 文件（脚本同时生成的）
                            const generatedTxtPath = outputPath.replace(/\.bin$/i, '.txt');
                            if (fs.existsSync(generatedTxtPath)) {
                                fs.unlinkSync(generatedTxtPath);
                                console.log(`[3D转换] 删除临时 txt 文件: ${generatedTxtPath}`);
                            }
                        } catch (err: any) {
                            console.error(`[3D转换] 清理临时文件失败: ${err.message}`);
                        }
                        
                        resolve({ success: true, inputPath, outputPath });
                    } else {
                        console.error(`[3D转换] 输出文件未生成: ${outputPath}`);
                        resolve({ success: false, inputPath, outputPath, error: `Output file not generated: ${outputPath}\nstdout: ${stdout}\nstderr: ${stderr}` });
                    }
                } else {
                    console.error(`[3D转换] 转换失败，退出码: ${code}`);
                    resolve({ success: false, inputPath, outputPath, error: `Exit code: ${code}\nstdout: ${stdout}\nstderr: ${stderr}` });
                }
            });

            proc.on('error', (err) => {
                console.error(`[3D转换] 进程错误: ${err.message}`);
                resolve({ success: false, inputPath, outputPath, error: `Process error: ${err.message}` });
            });
        });
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
                    const ext = path.extname(entry.name).toLowerCase();
                    
                    // 输出文件名格式：
                    // OBJ: desc_xxx.bin
                    // GLTF: gltf_desc_xxx.bin
                    let outputFileName: string;
                    if (ext === '.obj') {
                        outputFileName = `desc_${baseName}.bin`;
                    } else if (ext === '.gltf') {
                        outputFileName = `gltf_desc_${baseName}.bin`;
                    } else {
                        outputFileName = `${baseName}.bin`;
                    }
                    
                    const outputPath = path.join(outputDir, relativeDir, outputFileName);
                    items.push({ input: fullPath, output: outputPath });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }
}
