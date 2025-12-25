import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface VideoConvertOptions {
    format: 'mjpeg' | 'avi' | 'h264';
    frameRate?: number;  // 帧率
    quality?: number;    // 质量: MJPEG/AVI 为 1-31（1最高），H264 为 CRF 值 0-51
    // 视频裁剪和缩放选项（FFmpeg 预处理）
    crop?: {
        x: number;       // 裁剪起始 X 坐标
        y: number;       // 裁剪起始 Y 坐标
        width: number;   // 裁剪宽度
        height: number;  // 裁剪高度
    };
    scale?: {
        width: number;   // 目标宽度
        height: number;  // 目标高度
        keepAspectRatio?: boolean; // 是否保持宽高比
    };
}

export interface VideoConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    error?: string;
    warning?: string;    // 警告信息（非致命错误）
    duration?: number;   // 转换耗时（秒）
}

/**
 * 日志回调函数类型
 */
export type LogCallback = (message: string) => void;

/**
 * 视频转换服务
 * 
 * 转换流程：
 * 1. FFmpeg 预处理（仅尺寸变换：缩放/裁剪），如有需要
 * 2. SDK video_converter 进行格式转换和编码
 * 3. 如果没有尺寸变换需求，直接调用 SDK 转换原始视频
 */
export class VideoConverterService {
    private sdkPath?: string;
    private logCallback?: LogCallback;

    constructor(sdkPath?: string, logCallback?: LogCallback) {
        this.sdkPath = sdkPath;
        this.logCallback = logCallback;
    }

    /**
     * 输出日志
     */
    private log(message: string): void {
        if (this.logCallback) {
            this.logCallback(message);
        }
        // 同时输出到控制台（用于调试）
        console.log(`[VideoConverter] ${message}`);
    }

    /**
     * 检查 FFmpeg 是否可用
     */
    async checkFFmpegAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = spawn('ffmpeg', ['-version'], { shell: true });
            
            proc.on('close', (code) => {
                resolve(code === 0);
            });
            
            proc.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * 根据格式构建输出文件扩展名
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
     * 检查是否需要 FFmpeg 预处理（尺寸变换）
     */
    private needsPreprocessing(options: VideoConvertOptions): boolean {
        return !!(options.crop || options.scale);
    }

    /**
     * 转换单个视频文件
     * 
     * 流程：
     * 1. 如果有尺寸变换需求，先用 FFmpeg 预处理
     * 2. 调用 SDK video_converter 进行格式转换
     */
    async convert(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): Promise<VideoConvertResult> {
        // 检查输入文件是否存在
        if (!fs.existsSync(inputPath)) {
            return {
                success: false,
                inputPath,
                outputPath,
                error: `Input file not found: ${inputPath}`
            };
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const startTime = Date.now();
        let videoToConvert = inputPath;
        let tempPreprocessFile: string | null = null;

        // 第一步：FFmpeg 预处理（如果需要尺寸变换）
        if (this.needsPreprocessing(options)) {
            const ffmpegAvailable = await this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                return {
                    success: false,
                    inputPath,
                    outputPath,
                    error: 'FFmpeg not found. Required for video scaling/cropping.'
                };
            }

            // 创建临时文件用于预处理输出
            const inputExt = path.extname(inputPath);
            const outputBase = outputPath.slice(0, -path.extname(outputPath).length);
            tempPreprocessFile = outputBase + '.preprocess' + inputExt;

            const preprocessResult = await this.ffmpegPreprocess(inputPath, tempPreprocessFile, options);
            if (!preprocessResult.success) {
                return preprocessResult;
            }

            videoToConvert = tempPreprocessFile;
        }

        // 第二步：SDK video_converter 格式转换
        const convertResult = await this.sdkConvert(videoToConvert, outputPath, options);

        // 保留预处理后的视频文件（不删除，方便调试）
        // 预处理文件位于输出目录，文件名为 xxx.preprocess.mp4

        // 计算总耗时
        const totalDuration = (Date.now() - startTime) / 1000;
        return {
            ...convertResult,
            duration: totalDuration
        };
    }

    /**
     * FFmpeg 预处理（仅尺寸变换）
     */
    private async ffmpegPreprocess(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): Promise<VideoConvertResult> {
        return new Promise((resolve) => {
            // 构建 FFmpeg 参数（仅尺寸变换，保持原格式）
            const args = [
                '-i', inputPath,
                '-y',
            ];

            const videoFilters: string[] = [];
            
            if (options.crop) {
                const { x, y, width, height } = options.crop;
                videoFilters.push(`crop=${width}:${height}:${x}:${y}`);
            }
            
            if (options.scale) {
                const { width, height, keepAspectRatio } = options.scale;
                if (keepAspectRatio) {
                    videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
                    videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
                } else {
                    videoFilters.push(`scale=${width}:${height}`);
                }
            }

            if (videoFilters.length > 0) {
                args.push('-vf', videoFilters.join(','));
            }

            // 重新编码为通用格式（因为有滤镜无法直接复制流）
            args.push(
                '-c:v', 'libx264',  // 使用 H.264 编码
                '-preset', 'fast',
                '-crf', '18',       // 高质量
                '-an',              // 无音频
                outputPath
            );

            // 打印 FFmpeg 预处理命令
            const ffmpegCmd = `ffmpeg ${args.join(' ')}`;
            this.log(`FFmpeg 预处理命令: ${ffmpegCmd}`);

            const proc = spawn('ffmpeg', args, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stderr = '';
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        inputPath,
                        outputPath
                    });
                } else {
                    resolve({
                        success: false,
                        inputPath,
                        outputPath,
                        error: `FFmpeg preprocessing failed: ${this.parseFFmpegError(stderr)}`
                    });
                }
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    inputPath,
                    outputPath,
                    error: `FFmpeg process error: ${err.message}`
                });
            });
        });
    }

    /**
     * SDK video_converter 格式转换
     */
    private async sdkConvert(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): Promise<VideoConvertResult> {
        // 检查 SDK 路径
        if (!this.sdkPath) {
            return {
                success: false,
                inputPath,
                outputPath,
                error: 'SDK path not configured. Cannot perform video conversion.'
            };
        }

        // 检查 SDK 转换工具是否存在
        const converterPath = this.getConverterPath();
        if (!fs.existsSync(converterPath)) {
            return {
                success: false,
                inputPath,
                outputPath,
                error: `SDK video_converter not found at: ${converterPath}`
            };
        }

        return new Promise((resolve) => {
            const pythonCmd = this.getPythonCommand();
            const args: string[] = [];

            // 检查是否是 Python 包（目录）
            const isPackage = fs.statSync(converterPath).isDirectory() &&
                             fs.existsSync(path.join(converterPath, '__main__.py'));

            if (isPackage) {
                const moduleName = path.basename(converterPath);
                args.push('-m', moduleName);
            } else {
                args.push(converterPath);
            }

            // SDK 格式参数映射
            const sdkFormat = options.format === 'avi' ? 'avi_mjpeg' : options.format;

            // 添加参数
            args.push('-i', inputPath);
            args.push('-o', outputPath);
            args.push('-f', sdkFormat);

            // 添加可选参数
            if (options.quality !== undefined) {
                args.push('-q', options.quality.toString());
            }
            if (options.frameRate !== undefined) {
                args.push('-r', options.frameRate.toString());
            }

            // 设置环境变量
            const env = { ...process.env };
            if (isPackage) {
                const toolDir = path.dirname(converterPath);
                env.PYTHONPATH = toolDir + (env.PYTHONPATH ? path.delimiter + env.PYTHONPATH : '');
            }

            // 打印 SDK 转换命令
            const sdkCmd = `${pythonCmd} ${args.join(' ')}`;
            this.log(`SDK 转换命令: ${sdkCmd}`);
            if (isPackage) {
                this.log(`PYTHONPATH: ${env.PYTHONPATH}`);
            }

            const proc = spawn(pythonCmd, args, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env
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
                    // 检查输出文件
                    if (fs.existsSync(outputPath)) {
                        resolve({
                            success: true,
                            inputPath,
                            outputPath
                        });
                    } else {
                        // SDK 可能修改了输出文件扩展名，尝试查找
                        const foundFile = this.findOutputFile(outputPath);
                        if (foundFile) {
                            try {
                                fs.renameSync(foundFile, outputPath);
                                resolve({
                                    success: true,
                                    inputPath,
                                    outputPath
                                });
                            } catch (err) {
                                resolve({
                                    success: false,
                                    inputPath,
                                    outputPath,
                                    error: `Failed to rename output file: ${err}`
                                });
                            }
                        } else {
                            resolve({
                                success: false,
                                inputPath,
                                outputPath,
                                error: `SDK conversion completed but output file not found`
                            });
                        }
                    }
                } else {
                    resolve({
                        success: false,
                        inputPath,
                        outputPath,
                        error: `SDK video_converter failed (exit code: ${code}): ${stderr}`
                    });
                }
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    inputPath,
                    outputPath,
                    error: `SDK video_converter process error: ${err.message}`
                });
            });
        });
    }

    /**
     * 查找 SDK 可能生成的输出文件
     */
    private findOutputFile(expectedPath: string): string | null {
        const outputDir = path.dirname(expectedPath);
        const baseName = path.basename(expectedPath, path.extname(expectedPath));
        const possibleExtensions = ['.avi', '.mjpeg', '.h264'];

        for (const ext of possibleExtensions) {
            const possiblePath = path.join(outputDir, baseName + ext);
            if (fs.existsSync(possiblePath) && possiblePath !== expectedPath) {
                return possiblePath;
            }
        }
        return null;
    }

    /**
     * 解析 FFmpeg 错误信息
     */
    private parseFFmpegError(stderr: string): string {
        if (!stderr) return 'Unknown error';
        const lines = stderr.trim().split('\n');
        return lines.slice(-3).join('\n');
    }

    /**
     * 批量转换视频
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
     * 转换 assets 目录下的所有视频
     */
    async convertAssetsDir(
        assetsDir: string,
        outputDir: string,
        defaultOptions: VideoConvertOptions = { format: 'mjpeg', quality: 1 }
    ): Promise<VideoConvertResult[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        const videoExts = [
            '.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv',
            '.m4v', '.3gp', '.asf', '.rm', '.rmvb', '.vob', '.ts'
        ];
        
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
                        relativePath.replace(/\.[^.]+$/i, outputExt)
                    );
                    
                    items.push({
                        input: fullPath,
                        output: outputPath,
                        options: { ...defaultOptions }
                    });
                }
            }
        };

        scanDir(assetsDir);
        return this.convertBatch(items);
    }

    /**
     * 根据组件配置转换视频
     */
    async convertWithComponentConfig(
        inputPath: string,
        outputDir: string,
        componentData: {
            format?: 'mjpeg' | 'avi' | 'h264';
            frameRate?: number;
            quality?: number;
            crop?: { x: number; y: number; width: number; height: number };
            scale?: { width: number; height: number; keepAspectRatio?: boolean };
        }
    ): Promise<VideoConvertResult> {
        const options: VideoConvertOptions = {
            format: componentData.format || 'mjpeg',
            frameRate: componentData.frameRate,
            quality: componentData.quality || 1,
            crop: componentData.crop,
            scale: componentData.scale
        };

        const inputFileName = path.basename(inputPath);
        const outputExt = this.getOutputExtension(options.format);
        const outputFileName = inputFileName.replace(/\.[^.]+$/, outputExt);
        const outputPath = path.join(outputDir, outputFileName);

        return this.convert(inputPath, outputPath, options);
    }

    /**
     * 获取视频信息
     */
    async getVideoInfo(videoPath: string): Promise<{
        duration?: number;
        width?: number;
        height?: number;
        frameRate?: number;
        bitrate?: number;
        format?: string;
    } | null> {
        if (!fs.existsSync(videoPath)) {
            return null;
        }

        return new Promise((resolve) => {
            const proc = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                videoPath
            ], { shell: true });

            let stdout = '';
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    try {
                        const info = JSON.parse(stdout);
                        const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
                        
                        if (videoStream) {
                            resolve({
                                duration: parseFloat(info.format?.duration) || undefined,
                                width: videoStream.width,
                                height: videoStream.height,
                                frameRate: this.parseFrameRate(videoStream.r_frame_rate),
                                bitrate: parseInt(videoStream.bit_rate) || undefined,
                                format: videoStream.codec_name
                            });
                        } else {
                            resolve({});
                        }
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });

            proc.on('error', () => {
                resolve(null);
            });
        });
    }

    /**
     * 获取 SDK video_converter 路径
     */
    private getConverterPath(): string {
        if (!this.sdkPath) {
            return '';
        }
        
        const possiblePaths = [
            path.join(this.sdkPath, 'tool', 'video-convert-tool', 'video_converter'),
            path.join(this.sdkPath, 'tool', 'video-convert-tool', 'video_converter.py'),
            path.join(this.sdkPath, 'tool', 'video_converter'),
            path.join(this.sdkPath, 'tool', 'video_converter.py'),
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return possiblePaths[0];
    }

    /**
     * 获取 Python 命令
     * 优先尝试 python，如果不存在则尝试 py（Python Launcher）
     */
    private getPythonCommand(): string {
        if (process.platform === 'win32') {
            // Windows: 优先使用 python，如果不存在则使用 py
            return 'python';
        }
        return 'python3';
    }

    /**
     * 解析帧率字符串
     */
    private parseFrameRate(frameRateStr: string): number | undefined {
        if (!frameRateStr) return undefined;
        
        const parts = frameRateStr.split('/');
        if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            return den !== 0 ? num / den : undefined;
        }
        
        return parseFloat(frameRateStr) || undefined;
    }
}
