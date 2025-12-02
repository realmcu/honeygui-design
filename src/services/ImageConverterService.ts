import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface ConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export class ImageConverterService {
    private sdkPath: string;

    constructor(sdkPath: string) {
        this.sdkPath = sdkPath;
    }

    private getConverterScript(): string {
        return path.join(this.sdkPath, 'tool', 'image-convert-tool', 'image_converter.py');
    }

    /**
     * Get Python command based on platform
     */
    private getPythonCommand(): string {
        // Windows 通常使用 'python'，Linux/macOS 使用 'python3'
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * Convert a single image to bin format
     */
    async convert(inputPath: string, outputPath: string, format: string = 'auto'): Promise<ConvertResult> {
        const script = this.getConverterScript();
        
        if (!fs.existsSync(script)) {
            return { success: false, inputPath, outputPath, error: `Converter not found: ${script}` };
        }

        return new Promise((resolve) => {
            const pythonCmd = this.getPythonCommand();
            const proc = spawn(pythonCmd, [script, '-i', inputPath, '-o', outputPath, '-f', format]);
            
            let stderr = '';
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, inputPath, outputPath });
                } else {
                    resolve({ success: false, inputPath, outputPath, error: stderr || `Exit code: ${code}` });
                }
            });

            proc.on('error', (err) => {
                resolve({ success: false, inputPath, outputPath, error: err.message });
            });
        });
    }

    /**
     * Convert multiple images in batch
     */
    async convertBatch(items: Array<{ input: string; output: string; format?: string }>): Promise<ConvertResult[]> {
        return Promise.all(items.map(item => this.convert(item.input, item.output, item.format || 'auto')));
    }

    /**
     * Convert all images in assets directory to build output
     */
    async convertAssetsDir(assetsDir: string, outputDir: string): Promise<ConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const imageExts = ['.png', '.jpg', '.jpeg'];
        const items: Array<{ input: string; output: string }> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (imageExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const outputPath = path.join(outputDir, relativePath.replace(/\.(png|jpe?g)$/i, '.bin'));
                    items.push({ input: fullPath, output: outputPath });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }
}
