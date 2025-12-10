import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface VideoConvertOptions {
    format: 'mjpeg' | 'avi' | 'h264';
    frameRate?: number;  // 帧率
    quality?: number;    // 质量 (0-100)，用于 MJPEG 和 H.264
    bitrate?: string;    // 码率，如 '1M', '500k'
    // 视频裁剪和缩放选项
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
    duration?: number;   // 转换耗时（秒）
}

export class VideoConverterService {
    constructor() {
        // FFmpeg 不需要 SDK 路径，假定已在系统 PATH 中
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
     * 根据格式和选项构建输出文件扩展名
     */
    private getOutputExtension(format: string): string {
        switch (format) {
            case 'mjpeg':
                return '.mjpeg';
            case 'avi':
                return '.avi';
            case 'h264':
                return '.h264';  // H.264 原始流格式
            default:
                return '.mjpeg';
        }
    }

    /**
     * 构建 FFmpeg 命令参数
     */
    private buildFFmpegArgs(
        inputPath: string,
        outputPath: string,
        options: VideoConvertOptions
    ): string[] {
        const args = [
            '-i', inputPath,  // 输入文件
            '-y',             // 覆盖输出文件
        ];

        // 添加视频滤镜（裁剪和缩放）
        const videoFilters: string[] = [];
        
        // 裁剪滤镜
        if (options.crop) {
            const { x, y, width, height } = options.crop;
            videoFilters.push(`crop=${width}:${height}:${x}:${y}`);
        }
        
        // 缩放滤镜
        if (options.scale) {
            const { width, height, keepAspectRatio } = options.scale;
            if (keepAspectRatio) {
                // 保持宽高比，使用 scale 滤镜的 force_original_aspect_ratio
                videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
                videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
            } else {
                // 拉伸到指定尺寸
                videoFilters.push(`scale=${width}:${height}`);
            }
        }
        
        // 如果有视频滤镜，添加 -vf 参数
        if (videoFilters.length > 0) {
            args.push('-vf', videoFilters.join(','));
        }

        switch (options.format) {
            case 'mjpeg':
                // 帧率设置（MJPEG 格式）
                if (options.frameRate !== undefined) {
                    args.push('-r', options.frameRate.toString());
                }
                
                args.push(
                    '-vcodec', 'mjpeg',        // 视频编码器
                    '-pix_fmt', 'yuvj420p',    // 像素格式：yuvj420p（MJPEG 专用）
                    '-an'                      // 无音频输出
                );
                
                // 质量设置（MJPEG 使用 -q:v 参数，范围 1-31，数值越小质量越高）
                if (options.quality !== undefined) {
                    // 将 0-100 映射到 31-1，推荐范围 2-8
                    const qValue = Math.max(1, Math.round(31 - (options.quality / 100) * 30));
                    args.push('-q:v', qValue.toString());
                } else {
                    args.push('-q:v', '5');    // 默认质量
                }
                break;

            case 'avi':
                // 帧率设置（AVI 格式）
                if (options.frameRate !== undefined) {
                    args.push('-r', options.frameRate.toString());
                } else {
                    args.push('-r', '25');     // 默认 25fps
                }
                
                args.push(
                    '-an',                     // 无音频输出
                    '-vcodec', 'mjpeg',        // 视频编码器
                    '-pix_fmt', 'yuvj420p'     // 像素格式：yuvj420p
                );
                
                // 质量设置
                if (options.quality !== undefined) {
                    const qValue = Math.max(1, Math.round(31 - (options.quality / 100) * 30));
                    args.push('-q:v', qValue.toString());
                } else {
                    args.push('-q:v', '5');    // 默认质量
                }
                break;

            case 'h264':
                // 帧率设置（H.264 格式）
                if (options.frameRate !== undefined) {
                    args.push('-r', options.frameRate.toString());
                } else {
                    args.push('-r', '30');     // 默认 30fps
                }
                
                args.push(
                    '-c:v', 'libx264',         // H.264 编码器
                    '-x264-params', 'cabac=0:ref=3:deblock=1:0:0:analyse=0x1:0x111:me=hex:subme=7:psy=1:psy_rd=1.0:0.0:mixed_ref=1:me_range=16:chroma_me=1:trellis=1:8x8dct=0:deadzone-inter=21:deadzone-intra=11:fast_pskip=1:chroma_qp_offset=-2:threads=11:lookahead_threads=1:sliced_threads=0:nr=0:decimate=1:interlaced=0:bluray_compat=0:constrained_intra=0:bframes=0:weightp=0:keyint=40:min-keyint=4:scenecut=40:intra_refresh=0:rc_lookahead=40:mbtree=1:qcomp=0.60:qpmin=0:qpmax=69:qpstep=4:ipratio=1.40:aq-mode=1:aq-strength=1.00',
                    '-an',                     // 无音频输出
                    '-f', 'rawvideo'           // 原始视频格式
                );
                
                // 质量设置（H.264 使用 CRF）
                if (options.quality !== undefined) {
                    // 将 0-100 映射到 51-18
                    const crfValue = Math.round(51 - (options.quality / 100) * 33);
                    // 在 x264-params 中已经包含了 crf=23，这里需要替换
                    const lastArgIndex = args.length - 3; // -x264-params 的索引
                    const x264Params = args[lastArgIndex + 1];
                    args[lastArgIndex + 1] = x264Params.replace('crf=23', `crf=${crfValue}`);
                }
                break;
        }

        // 码率设置（优先级高于质量）
        if (options.bitrate) {
            args.push('-b:v', options.bitrate);
        }

        // 输出文件
        args.push(outputPath);

        return args;
    }

    /**
     * Convert a single video file using FFmpeg
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

        // 检查 FFmpeg 是否可用
        const ffmpegAvailable = await this.checkFFmpegAvailable();
        if (!ffmpegAvailable) {
            return {
                success: false,
                inputPath,
                outputPath,
                error: 'FFmpeg not found in system PATH. Please install FFmpeg and add it to PATH.'
            };
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const startTime = Date.now();

        return new Promise((resolve) => {
            const args = this.buildFFmpegArgs(inputPath, outputPath, options);
            
            const proc = spawn('ffmpeg', args, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
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
                const duration = (Date.now() - startTime) / 1000;
                
                if (code === 0) {
                    resolve({ 
                        success: true, 
                        inputPath, 
                        outputPath,
                        duration
                    });
                } else {
                    resolve({
                        success: false,
                        inputPath,
                        outputPath,
                        error: this.parseFFmpegError(stderr) || `FFmpeg exit code: ${code}`,
                        duration
                    });
                }
            });

            proc.on('error', (err) => {
                const duration = (Date.now() - startTime) / 1000;
                resolve({
                    success: false,
                    inputPath,
                    outputPath,
                    error: `FFmpeg process error: ${err.message}`,
                    duration
                });
            });
        });
    }

    /**
     * 解析 FFmpeg 错误信息，提取有用的错误描述
     */
    private parseFFmpegError(stderr: string): string {
        if (!stderr) return '';
        
        // 常见错误模式
        const errorPatterns = [
            /No such file or directory/,
            /Invalid data found when processing input/,
            /Unknown encoder/,
            /Permission denied/,
            /Disk full/
        ];
        
        for (const pattern of errorPatterns) {
            const match = stderr.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        // 返回最后几行错误信息
        const lines = stderr.trim().split('\n');
        return lines.slice(-3).join('\n');
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

        // 支持更多视频格式
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
            bitrate?: string;
            // 新增裁剪和缩放选项
            crop?: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            scale?: {
                width: number;
                height: number;
                keepAspectRatio?: boolean;
            };
        }
    ): Promise<VideoConvertResult> {
        const options: VideoConvertOptions = {
            format: componentData.format || 'mjpeg',
            frameRate: componentData.frameRate,
            quality: componentData.quality || 85,
            bitrate: componentData.bitrate,
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
     * 转换视频并应用裁剪和缩放
     * 便捷方法，用于快速应用视频处理
     */
    async convertWithProcessing(
        inputPath: string,
        outputPath: string,
        options: {
            format: 'mjpeg' | 'avi' | 'h264';
            frameRate?: number;
            quality?: number;
            // 裁剪选项
            cropX?: number;
            cropY?: number;
            cropWidth?: number;
            cropHeight?: number;
            // 缩放选项
            scaleWidth?: number;
            scaleHeight?: number;
            keepAspectRatio?: boolean;
        }
    ): Promise<VideoConvertResult> {
        const convertOptions: VideoConvertOptions = {
            format: options.format,
            frameRate: options.frameRate,
            quality: options.quality
        };

        // 添加裁剪选项
        if (options.cropX !== undefined && options.cropY !== undefined && 
            options.cropWidth !== undefined && options.cropHeight !== undefined) {
            convertOptions.crop = {
                x: options.cropX,
                y: options.cropY,
                width: options.cropWidth,
                height: options.cropHeight
            };
        }

        // 添加缩放选项
        if (options.scaleWidth !== undefined && options.scaleHeight !== undefined) {
            convertOptions.scale = {
                width: options.scaleWidth,
                height: options.scaleHeight,
                keepAspectRatio: options.keepAspectRatio || false
            };
        }

        return this.convert(inputPath, outputPath, convertOptions);
    }

    /**
     * 获取视频信息（时长、分辨率、帧率等）
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
                    } catch (err) {
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
     * 解析帧率字符串（如 "30/1" -> 30）
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
