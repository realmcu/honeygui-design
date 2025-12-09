import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface VideoConvertOptions {
    format: 'mjpeg' | 'avi' | 'h264';
    frameRate?: number;  // 帧率，仅 avi 格式支持
    quality?: number;    // 质量 (0-100)，仅 mjpeg 格式支持
}

export interface VideoConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
}

export class VideoConverterService {
    private sdkPath: string;

    constructor(sdkPath: string) {
        this.sdkPath = sdkPath;
    }

    private getConverterScript(): string {
        return path.join(this.sdkPath, 'tool', 'video-convert-tool', 'video_converter');
    }

    /**
     * Get Python command based on platform
     */
    private getPythonCommand(): string {
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * 根据格式和选项构建输出文件扩展名
     */
    private getOutputExtension(format: string): string {
        switch (format) {
            case 'mjpeg':
                return '.mjpeg';
            case 'avi':
                return '.avi';
            case 'h264':
                return '.h264';
            default:
                return '.mjpeg';
        }
    }

    /**
     * 构建转换命令参数
     */
    private buildConvertArgs(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): string[] {
        const args = [
            '-m', 'video_converter',
            '-i', inputPath,
            '-o', outputPath,
            '-f', options.format === 'avi' ? 'avi_mjpeg' : options.format
        ];

        // 添加质量参数（仅 mjpeg 格式）
        if (options.format === 'mjpeg' && options.quality !== undefined) {
            args.push('-q', options.quality.toString());
        }

        // 添加帧率参数（仅 avi 格式）
        if (options.format === 'avi' && options.frameRate !== undefined) {
            args.push('-r', options.frameRate.toString());
        }

        return args;
    }

    /**
     * Convert a single video file
     */
    async convert(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): Promise<VideoConvertResult> {
        const script = this.getConverterScript();
        
        if (!fs.existsSync(script)) {
            return {
                success: false,
                inputPath,
                outputPath,
                error: `Video converter not found: ${script}`
            };
        }

        return new Promise((resolve) => {
            const pythonCmd = this.getPythonCommand();
            const args = this.buildConvertArgs(inputPath, outputPath, options);
            
            const proc = spawn(pythonCmd, args, {
                cwd: path.dirname(script),
                shell: true
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, inputPath, outputPath });
                } else {
                    resolve({
                        success: false,
                        inputPath,
                        outputPath,
                        error: stderr || stdout || `Exit code: ${code}`
                    });
                }
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    inputPath,
                    outputPath,
                    error: err.message
                });
            });
        });
    }

    /**
     * Convert multiple videos in batch
     */
    async convertBatch(
        items: Array<{
            input: string;
            output: string;
            options: VideoConvertOptions;
        }>
    ): Promise<VideoConvertResult[]> {
        return Promise.all(
            items.map(item => this.convert(item.input, item.output, item.options))
        );
    }

    /**
     * Convert all videos in assets directory to build output
     * 根据项目配置或组件数据中的设置进行转换
     */
    async convertAssetsDir(
        assetsDir: string,
        outputDir: string,
        defaultOptions: VideoConvertOptions = { format: 'mjpeg', quality: 85 }
    ): Promise<VideoConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
        const items: Array<{ input: string; output: string; options: VideoConvertOptions }> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (videoExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const outputExt = this.getOutputExtension(defaultOptions.format);
                    const outputPath = path.join(
                        outputDir,
                        relativePath.replace(/\.(mp4|avi|mov|mkv|webm|flv|wmv)$/i, outputExt)
                    );
                    
                    items.push({
                        input: fullPath,
                        output: outputPath,
                        options: defaultOptions
                    });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }

    /**
     * 根据组件配置转换特定视频
     * 支持每个视频组件有不同的转换设置
     */
    async convertWithComponentConfig(
        inputPath: string,
        outputDir: string,
        componentData: {
            format?: 'mjpeg' | 'avi' | 'h264';
            frameRate?: number;
            quality?: number;
        }
    ): Promise<VideoConvertResult> {
        const options: VideoConvertOptions = {
            format: componentData.format || 'mjpeg',
            frameRate: componentData.frameRate,
            quality: componentData.quality || 85
        };

        const inputFileName = path.basename(inputPath);
        const outputExt = this.getOutputExtension(options.format);
        const outputFileName = inputFileName.replace(/\.[^.]+$/, outputExt);
        const outputPath = path.join(outputDir, outputFileName);

        return this.convert(inputPath, outputPath, options);
    }
}
