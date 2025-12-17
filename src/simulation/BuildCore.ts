import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { ProjectConfig } from '../common/ProjectConfig';
import { RomfsConfig } from '../common/RomfsConfig';

/**
 * 日志接口
 */
export interface Logger {
    log(message: string, isError?: boolean): void;
}

/**
 * 编译核心逻辑（不依赖 VSCode）
 */
export class BuildCore {
    protected buildDir: string;
    protected projectRoot: string;
    protected sdkPath: string;
    protected logger: Logger;
    protected projectConfig: ProjectConfig;

    constructor(projectRoot: string, sdkPath: string, projectConfig: ProjectConfig, logger: Logger) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.projectConfig = projectConfig;
        this.buildDir = path.join(projectRoot, 'build');
        this.logger = logger;
    }

    getBuildDir(): string {
        return this.buildDir;
    }

    async setupBuildDir(): Promise<void> {
        this.logger.log('准备编译目录...');

        const parentDir = path.dirname(this.buildDir);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        const sdkWin32Sim = path.join(this.sdkPath, 'win32_sim');
        if (!fs.existsSync(sdkWin32Sim)) {
            throw new Error(`SDK win32_sim 目录不存在: ${sdkWin32Sim}`);
        }

        if (!fs.existsSync(this.buildDir)) {
            this.logger.log('拷贝 win32_sim...');
            this.copyDirectory(sdkWin32Sim, this.buildDir);
            this.logger.log('win32_sim 拷贝完成');
        } else {
            this.logger.log('win32_sim 已存在，跳过拷贝');
        }

        const kconfigSource = path.join(this.sdkPath, 'Kconfig.gui');
        const kconfigDest = path.join(this.buildDir, 'Kconfig.gui');
        if (fs.existsSync(kconfigSource)) {
            fs.copyFileSync(kconfigSource, kconfigDest);
        }

        this.generateConfig();
        this.modifySConstruct();
        this.logger.log('编译目录准备完成');
    }

    async copyGeneratedCode(): Promise<void> {
        this.logger.log('检查生成的代码...');

        const srcAutogen = path.join(this.projectRoot, 'src', 'autogen');
        if (!fs.existsSync(srcAutogen)) {
            throw new Error(`生成的代码目录不存在: ${srcAutogen}`);
        }

        const sconscript = path.join(srcAutogen, 'SConscript');
        if (!fs.existsSync(sconscript)) {
            throw new Error(`SConscript 文件不存在: ${sconscript}，请先生成代码`);
        }

        this.logger.log('代码检查完成');
    }

    async convertAssets(): Promise<void> {
        const assetsDir = path.join(this.projectRoot, 'assets');
        const outputDir = path.join(this.buildDir, 'assets');

        // 转换图片资源
        this.logger.log('转换图片资源...');
        const imageConverter = new ImageConverterService(this.sdkPath);
        const imageResults = await imageConverter.convertAssetsDir(assetsDir, outputDir);

        const imageFailed = imageResults.filter(r => !r.success);
        if (imageFailed.length > 0) {
            for (const f of imageFailed) {
                this.logger.log(`图片转换失败: ${f.inputPath} - ${f.error}`, true);
            }
            throw new Error(`${imageFailed.length} 个图片转换失败`);
        }

        this.logger.log(`图片转换完成: ${imageResults.length} 个`);

        // 转换视频资源
        this.logger.log('转换视频资源...');
        // 传递日志回调，让 VideoConverterService 的日志输出到 Output Channel
        const videoConverter = new VideoConverterService(this.sdkPath, (msg) => {
            this.logger.log(msg);
        });
        
        // 检查 FFmpeg 是否可用
        const ffmpegAvailable = await videoConverter.checkFFmpegAvailable();
        if (!ffmpegAvailable) {
            this.logger.log('FFmpeg 未找到，跳过视频转换。请安装 FFmpeg 并添加到系统 PATH。', true);
            this.logger.log('视频转换跳过: 0 个');
        } else {
            // 获取视频组件配置并进行智能转换
            const videoResults = await this.convertVideosWithComponentConfig(
                videoConverter,
                assetsDir,
                outputDir
            );

            const videoFailed = videoResults.filter(r => !r.success);
            if (videoFailed.length > 0) {
                for (const f of videoFailed) {
                    this.logger.log(`视频转换失败: ${f.inputPath} - ${f.error}`, true);
                }
                throw new Error(`${videoFailed.length} 个视频转换失败`);
            }

            // 记录警告信息
            const videoWarnings = videoResults.filter(r => r.success && r.warning);
            if (videoWarnings.length > 0) {
                for (const w of videoWarnings) {
                    this.logger.log(`视频转换警告: ${w.inputPath} - ${w.warning}`, false);
                }
            }

            this.logger.log(`视频转换完成: ${videoResults.length} 个`);
        }



        // 打包 romfs
        await this.packRomfs();
    }

    private async packRomfs(): Promise<void> {
        this.logger.log('打包 romfs...');

        const assetsDir = path.join(this.buildDir, 'assets');
        const romfsOutput = path.join(this.buildDir, RomfsConfig.getFileName());
        const mkromfsScript = path.join(this.sdkPath, 'tool', 'mkromfs', 'mkromfs_for_honeygui.py');

        if (!fs.existsSync(mkromfsScript)) {
            throw new Error(`mkromfs 脚本不存在: ${mkromfsScript}`);
        }

        return new Promise((resolve, reject) => {
            // 尝试多个 Python 命令
            const pythonCandidates = process.platform === 'win32' 
                ? ['python', 'python3', 'py'] 
                : ['python3', 'python'];
            
            let pythonCmd = pythonCandidates[0];
            
            // 在 Windows 上，优先尝试 py launcher
            if (process.platform === 'win32') {
                pythonCmd = 'py';
            }

            const proc = spawn(pythonCmd, [mkromfsScript, '-i', assetsDir, '-o', romfsOutput], {
                cwd: this.buildDir,
                shell: true
            });

            proc.stdout?.on('data', (data) => {
                this.logger.log(data.toString().trim());
            });

            proc.stderr?.on('data', (data) => {
                this.logger.log(data.toString().trim(), true);
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    this.logger.log('romfs C 文件生成完成');
                    resolve();
                } else {
                    reject(new Error(`romfs 打包失败，退出码: ${code}`));
                }
            });

            proc.on('error', (err) => {
                // 如果命令未找到，提供更友好的错误信息
                if ((err as any).code === 'ENOENT') {
                    reject(new Error(`Python 未找到。请确保已安装 Python 并添加到系统 PATH 环境变量中。\n尝试的命令: ${pythonCmd}`));
                } else {
                    reject(err);
                }
            });
        });
    }

    async compile(): Promise<void> {
        this.logger.log('开始编译...');

        return new Promise((resolve, reject) => {
            const compileProcess = spawn('scons', ['-j4'], {
                cwd: this.buildDir,
                shell: true
            });

            compileProcess.stdout?.on('data', (data) => {
                this.logger.log(data.toString());
            });

            compileProcess.stderr?.on('data', (data) => {
                this.logger.log(data.toString(), true);
            });

            compileProcess.on('exit', (code) => {
                if (code === 0) {
                    this.logger.log('编译成功！');
                    resolve();
                } else {
                    reject(new Error(`编译失败，退出码: ${code}`));
                }
            });

            compileProcess.on('error', reject);
        });
    }

    getExecutablePath(): string {
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        return path.join(this.buildDir, exeName);
    }

    private generateConfig(): void {
        const configContent = 'CONFIG_REALTEK_HONEYGUI=y\n';
        fs.writeFileSync(path.join(this.buildDir, '.config'), configContent);
    }

    private modifySConstruct(): void {
        const sconstructPath = path.join(this.buildDir, 'SConstruct');
        if (!fs.existsSync(sconstructPath)) return;

        let content = fs.readFileSync(sconstructPath, 'utf-8');
        const sdkPathNormalized = this.sdkPath.replace(/\\/g, '/');
        const projectRootNormalized = this.projectRoot.replace(/\\/g, '/');
        
        content = content.replace(
            /PROJECT_ROOT\s*=\s*os\.path\.dirname\(os\.getcwd\(\)\)/,
            `PROJECT_ROOT = '${sdkPathNormalized}'`
        );

        // 从projectConfig获取分辨率
        const { width, height } = this.parseResolution(this.projectConfig.resolution);

        // 添加LCD宏定义到CFLAGS
        if (!content.includes('DRV_LCD_WIDTH')) {
            content = content.replace(
                /(env_params\s*=\s*{[^}]*'CFLAGS':\s*menu_config\.CFLAGS)/,
                `$1 + ' -DDRV_LCD_WIDTH=${width} -DDRV_LCD_HEIGHT=${height}'`
            );
        }

        // 在 DoBuilding 之前添加项目 autogen 代码的编译（仅当不存在时）
        if (!content.includes('PROJECT_AUTOGEN')) {
            const autogenInclude = `
# Include project autogen code
PROJECT_AUTOGEN = '${projectRootNormalized}/src/autogen'
if os.path.exists(os.path.join(PROJECT_AUTOGEN, 'SConscript')):
    objs.extend(SConscript(os.path.join(PROJECT_AUTOGEN, 'SConscript')))
`;
            content = content.replace(
                /# Build\s*\nDoBuilding\(TARGET, objs\)/,
                `${autogenInclude}\n# Build\nDoBuilding(TARGET, objs)`
            );
        }
        
        fs.writeFileSync(sconstructPath, content);
    }

    /**
     * 解析分辨率字符串（如 "480X272"）
     */
    private parseResolution(resolution?: string): { width: number; height: number } {
        const defaultResolution = { width: 480, height: 272 };
        
        if (!resolution) {
            return defaultResolution;
        }

        const match = resolution.match(/(\d+)X(\d+)/i);
        if (match) {
            return {
                width: parseInt(match[1]),
                height: parseInt(match[2])
            };
        }

        return defaultResolution;
    }

    /**
     * 根据组件配置转换视频资源
     */
    private async convertVideosWithComponentConfig(
        videoConverter: VideoConverterService,
        assetsDir: string,
        outputDir: string
    ): Promise<any[]> {
        if (!fs.existsSync(assetsDir)) {
            return [];
        }

        // 获取项目中所有视频组件的配置
        const videoComponentConfigs = await this.getVideoComponentConfigs();
        
        // 支持的视频格式
        const videoExts = [
            '.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv',
            '.m4v', '.3gp', '.asf', '.rm', '.rmvb', '.vob', '.ts'
        ];
        
        const convertTasks: Array<Promise<any>> = [];

        const scanDir = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (videoExts.includes(path.extname(entry.name).toLowerCase())) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const normalizedPath = relativePath.replace(/\\/g, '/');
                    
                    // 查找使用此视频的组件配置
                    const componentConfig = videoComponentConfigs.find(config => 
                        config.src === normalizedPath || 
                        config.src === `assets/${normalizedPath}` ||
                        config.src.endsWith(normalizedPath)
                    );
                    
                    // 使用组件配置或默认配置
                    const configFormat = componentConfig?.format || 
                        (this.projectConfig.videoFormat as 'mjpeg' | 'avi' | 'h264') || 'mjpeg';
                    
                    // 获取原始质量值
                    const rawQuality = componentConfig?.quality ?? this.projectConfig.videoQuality;
                    
                    // 根据格式校验和修正质量值
                    const quality = this.normalizeVideoQuality(rawQuality, configFormat);
                    
                    const options = componentConfig ? {
                        format: configFormat,
                        quality: quality,
                        frameRate: componentConfig.frameRate || 30,
                        crop: componentConfig.crop,
                        scale: componentConfig.scale
                    } : {
                        format: configFormat,
                        quality: quality,
                        frameRate: this.projectConfig.videoFrameRate || 30
                    };
                    
                    // 生成输出路径
                    const outputExt = this.getVideoOutputExtension(options.format);
                    const outputPath = path.join(
                        outputDir,
                        relativePath.replace(/\.[^.]+$/i, outputExt)
                    );
                    
                    // 添加转换任务
                    convertTasks.push(
                        videoConverter.convert(fullPath, outputPath, options)
                    );
                    
                    this.logger.log(`计划转换: ${normalizedPath} -> ${options.format} (${outputExt})`);
                }
            }
        };

        scanDir(assetsDir);
        
        // 并行执行所有转换任务
        return Promise.all(convertTasks);
    }

    /**
     * 获取项目中所有视频组件的配置
     */
    private async getVideoComponentConfigs(): Promise<Array<{
        src: string;
        format?: 'mjpeg' | 'avi' | 'h264';
        quality?: number;
        frameRate?: number;
        crop?: any;
        scale?: any;
    }>> {
        const configs: Array<any> = [];
        
        try {
            // 扫描 UI 目录中的所有 HML 文件
            const uiDir = path.join(this.projectRoot, 'ui');
            if (fs.existsSync(uiDir)) {
                await this.scanHmlFilesForVideoConfigs(uiDir, configs);
            }
        } catch (error) {
            this.logger.log(`读取视频组件配置时出错: ${error}`, true);
        }
        
        return configs;
    }

    /**
     * 扫描 HML 文件中的视频组件配置
     */
    private async scanHmlFilesForVideoConfigs(dir: string, configs: Array<any>): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                await this.scanHmlFilesForVideoConfigs(fullPath, configs);
            } else if (entry.name.endsWith('.hml')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    this.extractVideoConfigsFromHml(content, configs);
                } catch (error) {
                    this.logger.log(`读取 HML 文件失败: ${fullPath} - ${error}`, true);
                }
            }
        }
    }

    /**
     * 从 HML 内容中提取视频组件配置
     */
    private extractVideoConfigsFromHml(hmlContent: string, configs: Array<any>): void {
        // 使用正则表达式匹配 hg_video 标签
        const videoTagRegex = /<hg_video[^>]*>/g;
        let match;
        
        while ((match = videoTagRegex.exec(hmlContent)) !== null) {
            const tagContent = match[0];
            
            // 提取属性
            const config: any = {};
            
            // 提取 src 属性
            const srcMatch = tagContent.match(/src\s*=\s*["']([^"']+)["']/);
            if (srcMatch) {
                config.src = srcMatch[1];
            }
            
            // 提取 format 属性
            const formatMatch = tagContent.match(/format\s*=\s*["']([^"']+)["']/);
            if (formatMatch) {
                config.format = formatMatch[1];
            }
            
            // 提取 quality 属性
            const qualityMatch = tagContent.match(/quality\s*=\s*["']?(\d+)["']?/);
            if (qualityMatch) {
                config.quality = parseInt(qualityMatch[1]);
            }
            
            // 提取 frameRate 属性
            const frameRateMatch = tagContent.match(/frameRate\s*=\s*["']?(\d+)["']?/);
            if (frameRateMatch) {
                config.frameRate = parseInt(frameRateMatch[1]);
            }
            
            // 只有当有 src 属性时才添加配置
            if (config.src) {
                configs.push(config);
            }
        }
    }

    /**
     * 获取视频输出扩展名
     */
    private getVideoOutputExtension(format: string): string {
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
     * 校验和修正视频质量值
     * MJPEG/AVI: 1-31 (1=最高质量)
     * H.264: 0-51 (CRF值，23=默认)
     */
    private normalizeVideoQuality(quality: number | undefined, format: string): number {
        if (format === 'h264') {
            // H.264 CRF 值范围 0-51，默认 23
            if (quality === undefined || quality < 0 || quality > 51) {
                return 23;
            }
            return quality;
        } else {
            // MJPEG/AVI 质量范围 1-31，默认 1（最高质量）
            if (quality === undefined || quality < 1 || quality > 31) {
                return 1;
            }
            return quality;
        }
    }

    protected copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
