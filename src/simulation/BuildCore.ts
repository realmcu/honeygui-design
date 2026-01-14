import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { Model3DConverterService } from '../services/Model3DConverterService';
import { FontConverterService, FontConvertOptions } from '../services/FontConverterService';
import { ProjectConfig, DEFAULT_ROMFS_BASE_ADDR } from '../common/ProjectConfig';
import { RomfsConfig } from '../common/RomfsConfig';
import { buildSConstruct } from './SConstructTemplate';

/**
 * 日志接口
 */
export interface Logger {
    log(message: string, isError?: boolean): void;
}

/**
 * 编译核心逻辑（不依赖 VSCode）
 * sdkPath 现在指向插件内置的 lib/sim 目录
 */
export class BuildCore {
    protected buildDir: string;
    protected projectRoot: string;
    protected libSimPath: string;  // 插件内置的 lib/sim 路径
    protected logger: Logger;
    protected projectConfig: ProjectConfig;

    constructor(projectRoot: string, libSimPath: string, projectConfig: ProjectConfig, logger: Logger) {
        this.projectRoot = projectRoot;
        this.libSimPath = libSimPath;
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

        // 使用内置的 win32_sim
        const win32SimSource = path.join(this.libSimPath, 'win32_sim');
        if (!fs.existsSync(win32SimSource)) {
            throw new Error(`内置 win32_sim 目录不存在: ${win32SimSource}`);
        }

        if (!fs.existsSync(this.buildDir)) {
            this.logger.log('拷贝 win32_sim...');
            this.copyDirectory(win32SimSource, this.buildDir);
            this.logger.log('win32_sim 拷贝完成');
        } else {
            this.logger.log('编译目录已存在，跳过拷贝');
        }

        // 拷贝 .config
        const configSource = path.join(win32SimSource, '.config');
        const configDest = path.join(this.buildDir, '.config');
        if (fs.existsSync(configSource)) {
            fs.copyFileSync(configSource, configDest);
            this.logger.log('.config 拷贝完成');
        } else {
            this.logger.log('.config 不存在，生成默认配置');
            this.generateConfig();
        }

        this.modifySConstruct();
        this.logger.log('编译目录准备完成');
    }

    async copyGeneratedCode(): Promise<void> {
        this.logger.log('检查生成的代码...');

        const srcDir = path.join(this.projectRoot, 'src');
        if (!fs.existsSync(srcDir)) {
            throw new Error(`生成的代码目录不存在: ${srcDir}`);
        }

        const sconscript = path.join(srcDir, 'SConscript');
        if (!fs.existsSync(sconscript)) {
            throw new Error(`SConscript 文件不存在: ${sconscript}，请先生成代码`);
        }

        this.logger.log('代码检查完成');
    }

    async convertAssets(): Promise<void> {
        const assetsDir = path.join(this.projectRoot, 'assets');
        const outputDir = path.join(this.buildDir, 'assets');

        // 确保 build/assets 目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 转换图片资源（不再需要 sdkPath）
        this.logger.log('转换图片资源...');
        const imageConverter = new ImageConverterService();
        const imageResults = await imageConverter.convertAssetsDir(assetsDir, outputDir);

        const imageFailed = imageResults.filter(r => !r.success);
        if (imageFailed.length > 0) {
            for (const f of imageFailed) {
                this.logger.log(`图片转换失败: ${f.inputPath} - ${f.error}`, true);
            }
            throw new Error(`${imageFailed.length} 个图片转换失败`);
        }

        this.logger.log(`图片转换完成: ${imageResults.length} 个`);

        // 拷贝 SVG 资源（不需要转换）
        this.logger.log('拷贝 SVG 资源...');
        const svgCount = this.copySvgAssets(assetsDir, outputDir);
        this.logger.log(`SVG 拷贝完成: ${svgCount} 个`);

        // 转换视频资源（暂时跳过，需要 FFmpeg）
        this.logger.log('检查视频资源...');
        const videoConverter = new VideoConverterService(undefined, (msg) => {
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



        // 转换 3D 模型资源（不再需要 sdkPath）
        this.logger.log('转换 3D 模型资源...');
        const model3DConverter = new Model3DConverterService();
        const model3DResults = await model3DConverter.convertAssetsDir(assetsDir, outputDir);

        const model3DFailed = model3DResults.filter(r => !r.success);
        if (model3DFailed.length > 0) {
            for (const f of model3DFailed) {
                this.logger.log(`3D模型转换失败: ${f.inputPath} - ${f.error}`, true);
            }
            throw new Error(`${model3DFailed.length} 个3D模型转换失败`);
        }

        this.logger.log(`3D模型转换完成: ${model3DResults.length} 个`);

        // 转换字体资源
        this.logger.log('转换字体资源...');
        const fontResults = await this.convertFontsWithLabelConfig(assetsDir, outputDir);
        const fontFailed = fontResults.filter(r => !r.success);
        if (fontFailed.length > 0) {
            for (const f of fontFailed) {
                this.logger.log(`字体转换失败: ${f.inputPath} - ${f.error}`, true);
            }
            // 字体转换失败不阻止编译，只是警告
            this.logger.log(`警告: ${fontFailed.length} 个字体转换失败`, true);
        }
        this.logger.log(`字体转换完成: ${fontResults.filter(r => r.success).length} 个`);

        // 拷贝 ui 目录到 build/assets
        const uiSrcDir = path.join(this.projectRoot, 'ui');
        const uiDestDir = path.join(outputDir, 'ui');
        if (fs.existsSync(uiSrcDir)) {
            this.copyDirectory(uiSrcDir, uiDestDir);
            this.logger.log('UI 目录已拷贝到 assets');
        }

        // 拷贝 project.json 到 build/assets
        const projectJsonSrc = path.join(this.projectRoot, 'project.json');
        const projectJsonDest = path.join(outputDir, 'project.json');
        if (fs.existsSync(projectJsonSrc)) {
            fs.copyFileSync(projectJsonSrc, projectJsonDest);
            this.logger.log('project.json 已拷贝到 assets');
        }

        // 打包 romfs
        await this.packRomfs();
    }

    private async packRomfs(): Promise<void> {
        this.logger.log('打包 romfs...');

        const assetsDir = path.join(this.buildDir, 'assets');
        const romfsOutput = path.join(this.buildDir, RomfsConfig.getFileName());
        const romfsBinOutput = path.join(this.buildDir, 'app_romfs.bin');
        // 使用内置的 mkromfs 脚本
        const mkromfsScript = path.join(this.libSimPath, 'tool', 'mkromfs', 'mkromfs_for_honeygui.py');

        if (!fs.existsSync(mkromfsScript)) {
            throw new Error(`mkromfs 脚本不存在: ${mkromfsScript}`);
        }

        // 获取 romfs 基地址
        const baseAddr = this.projectConfig.romfsBaseAddr || DEFAULT_ROMFS_BASE_ADDR;

        // 生成 C 文件
        await this.runMkromfs(mkromfsScript, assetsDir, romfsOutput, false, baseAddr);
        this.logger.log('romfs C 文件生成完成');

        // 生成二进制文件
        await this.runMkromfs(mkromfsScript, assetsDir, romfsBinOutput, true, baseAddr);
        this.logger.log(`romfs 二进制文件生成完成 (基地址: ${baseAddr})`);
    }

    private async runMkromfs(script: string, inputDir: string, outputFile: string, binary: boolean, baseAddr: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // 尝试多个 Python 命令
            const pythonCandidates = process.platform === 'win32' 
                ? ['python', 'python3', 'py'] 
                : ['python3', 'python'];
            
            let pythonCmd = pythonCandidates[0];
            
            // 在 Windows 上，优先使用 python（而不是 py launcher）
            if (process.platform === 'win32') {
                pythonCmd = 'python';
            }

            const args = [script, '-i', inputDir, '-o', outputFile, '-a', baseAddr];
            if (binary) {
                args.push('-b');
            }

            const proc = spawn(pythonCmd, args, {
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

            let compiledCount = 0;

            compileProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                const lines = output.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    
                    // 过滤掉不需要的日志
                    if (trimmed.includes('Warning: Command is too long')) continue;
                    
                    // 显示所有编译信息
                    if (trimmed.startsWith('CC ') || trimmed.startsWith('Compiling ')) {
                        compiledCount++;
                        this.logger.log(trimmed);  // 显示每个文件的编译信息
                    } else if (trimmed.startsWith('LINK ') || trimmed.includes('Linking')) {
                        this.logger.log(`链接中... (已编译 ${compiledCount} 个文件)`);
                    } else if (trimmed.includes('error:') || trimmed.includes('Error:') ||
                               trimmed.includes('undefined reference') ||
                               trimmed.includes('multiple definition') ||
                               trimmed.includes('collect2') ||
                               trimmed.includes('ld returned')) {
                        // 显示所有错误信息，包括链接错误
                        this.logger.log(trimmed, true);
                    } else if (trimmed.includes('warning:') && !trimmed.includes('Command is too long')) {
                        // 只显示重要警告，跳过常见无害警告
                        if (!trimmed.includes('unused') && !trimmed.includes('deprecated')) {
                            this.logger.log(trimmed);
                        }
                    } else if (trimmed.startsWith('scons:')) {
                        this.logger.log(trimmed);
                    } else {
                        // 显示其他所有输出
                        this.logger.log(trimmed);
                    }
                }
            });

            compileProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                const lines = output.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    if (trimmed.includes('Warning: Command is too long')) continue;
                    
                    // stderr 通常是错误信息，显示出来
                    // 包括：error:, Error:, undefined reference, multiple definition, collect2
                    if (trimmed.includes('error:') || trimmed.includes('Error:') ||
                        trimmed.includes('undefined reference') || 
                        trimmed.includes('multiple definition') ||
                        trimmed.includes('collect2') ||
                        trimmed.includes('ld returned')) {
                        this.logger.log(trimmed, true);
                    }
                }
            });

            compileProcess.on('exit', (code) => {
                if (code === 0) {
                    this.logger.log(`编译成功！共编译 ${compiledCount} 个文件`);
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
        // 固定配置，不依赖 Kconfig.gui
        const configLines: string[] = [
            'CONFIG_REALTEK_HONEYGUI=y',
            'CONFIG_REALTEK_BUILD_PINYIN=y',
            'CONFIG_REALTEK_BUILD_LETTER_SHELL=y',
            'CONFIG_REALTEK_BUILD_MONKEY_TEST=y',
            'CONFIG_REALTEK_H264_DECODER=y',
            'CONFIG_REALTEK_H264BSD=y',
            'CONFIG_REALTEK_BUILD_GUI_BOX2D=y',
            'CONFIG_REALTEK_BUILD_LITE3D=y'
        ];
        
        const configPath = path.join(this.buildDir, '.config');
        fs.writeFileSync(configPath, configLines.join('\n') + '\n');
        this.logger.log(`.config 文件已生成，包含 ${configLines.length} 个配置项`);
    }

    private modifySConstruct(): void {
        const sconstructPath = path.join(this.buildDir, 'SConstruct');
        if (!fs.existsSync(sconstructPath)) return;

        const libSim = this.libSimPath.replace(/\\/g, '/');
        const projectSrc = this.projectRoot.replace(/\\/g, '/') + '/src';
        const { width, height } = this.parseResolution(this.projectConfig.resolution);
        const cornerRadius = this.projectConfig.cornerRadius || 0;
        const platform = process.platform === 'win32' ? 'win32' : 'linux';

        const content = buildSConstruct({
            libSim,
            projectSrc,
            lcd: { width, height, cornerRadius },
            platform
        });

        fs.writeFileSync(sconstructPath, content, 'utf-8');
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

    /**
     * 拷贝 SVG 资源（不需要转换，直接拷贝）
     */
    protected copySvgAssets(assetsDir: string, outputDir: string): number {
        let count = 0;
        
        const scanDir = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.name.toLowerCase().endsWith('.svg')) {
                    const relativePath = path.relative(assetsDir, fullPath);
                    const destPath = path.join(outputDir, relativePath);
                    const destDir = path.dirname(destPath);
                    
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    fs.copyFileSync(fullPath, destPath);
                    count++;
                }
            }
        };
        
        scanDir(assetsDir);
        return count;
    }

    /**
     * 根据 Label 组件配置转换字体资源
     * 
     * 从 HML 文件中提取所有 hg_label 组件的字体配置，
     * 使用组件的文本内容作为字符集进行转换
     */
    private async convertFontsWithLabelConfig(
        assetsDir: string,
        outputDir: string
    ): Promise<any[]> {
        // 获取项目中所有 Label 组件的字体配置
        const labelConfigs = await this.getLabelFontConfigs();
        
        if (labelConfigs.length === 0) {
            this.logger.log('未找到需要转换的字体配置');
            return [];
        }

        // 按字体文件+配置分组，合并相同配置的字符集
        const fontGroups = this.groupLabelConfigsByFont(labelConfigs);
        
        const fontConverter = new FontConverterService();
        const results: any[] = [];

        for (const group of fontGroups) {
            const fontPath = path.join(assetsDir, group.fontFile);
            
            // 检查字体文件是否存在
            if (!fs.existsSync(fontPath)) {
                this.logger.log(`字体文件不存在: ${group.fontFile}`, true);
                results.push({
                    success: false,
                    inputPath: fontPath,
                    outputPath: outputDir,
                    error: '字体文件不存在'
                });
                continue;
            }

            // 确定输出目录（保持原始目录结构）
            const fontDir = path.dirname(group.fontFile);
            const fontOutputDir = fontDir ? path.join(outputDir, fontDir) : outputDir;

            // 构建转换选项
            const options: FontConvertOptions = {
                fontSize: group.fontSize,
                renderMode: group.renderMode,
                outputFormat: group.fontType,
                characterSets: [
                    // 使用合并后的字符集（自定义字符）
                    { type: 'string', value: group.characters }
                ]
            };

            this.logger.log(`转换字体: ${group.fontFile} (${group.fontType}, size=${group.fontSize}, bits=${group.renderMode})`);
            this.logger.log(`  字符集: "${group.characters.substring(0, 50)}${group.characters.length > 50 ? '...' : ''}" (${group.characters.length} 字符)`);

            try {
                const result = await fontConverter.convert(fontPath, fontOutputDir, options);
                results.push(result);
                
                if (result.success) {
                    this.logger.log(`  ✓ 成功: ${result.processedCount} 字符`);
                } else {
                    this.logger.log(`  ✗ 失败: ${result.error}`, true);
                }
            } catch (error: any) {
                results.push({
                    success: false,
                    inputPath: fontPath,
                    outputPath: fontOutputDir,
                    error: error.message
                });
                this.logger.log(`  ✗ 异常: ${error.message}`, true);
            }
        }

        return results;
    }

    /**
     * 获取项目中所有 Label 组件的字体配置
     */
    private async getLabelFontConfigs(): Promise<Array<{
        fontFile: string;
        fontSize: number;
        fontType: 'bitmap' | 'vector';
        renderMode: number;
        text: string;
    }>> {
        const configs: Array<any> = [];
        
        try {
            const uiDir = path.join(this.projectRoot, 'ui');
            if (fs.existsSync(uiDir)) {
                await this.scanHmlFilesForLabelConfigs(uiDir, configs);
            }
        } catch (error) {
            this.logger.log(`读取 Label 组件配置时出错: ${error}`, true);
        }
        
        return configs;
    }

    /**
     * 扫描 HML 文件中的 Label 组件配置
     */
    private async scanHmlFilesForLabelConfigs(dir: string, configs: Array<any>): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                await this.scanHmlFilesForLabelConfigs(fullPath, configs);
            } else if (entry.name.endsWith('.hml')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    this.extractLabelConfigsFromHml(content, configs);
                } catch (error) {
                    this.logger.log(`读取 HML 文件失败: ${fullPath} - ${error}`, true);
                }
            }
        }
    }

    /**
     * 从 HML 内容中提取 Label 组件的字体配置
     */
    private extractLabelConfigsFromHml(hmlContent: string, configs: Array<any>): void {
        // 匹配 hg_label 标签
        const labelTagRegex = /<hg_label[^>]*>/g;
        let match;
        
        while ((match = labelTagRegex.exec(hmlContent)) !== null) {
            const tagContent = match[0];
            
            // 提取 fontFile 属性
            const fontFileMatch = tagContent.match(/fontFile\s*=\s*["']([^"']+)["']/);
            if (!fontFileMatch) {
                continue; // 没有指定字体文件，跳过
            }
            
            const config: any = {
                fontFile: fontFileMatch[1],
                fontSize: 16,
                fontType: 'bitmap',
                renderMode: 4,
                text: ''
            };
            
            // 提取 fontSize 属性
            const fontSizeMatch = tagContent.match(/fontSize\s*=\s*["']?(\d+)["']?/);
            if (fontSizeMatch) {
                config.fontSize = parseInt(fontSizeMatch[1]);
            }
            
            // 提取 fontType 属性
            const fontTypeMatch = tagContent.match(/fontType\s*=\s*["']([^"']+)["']/);
            if (fontTypeMatch) {
                config.fontType = fontTypeMatch[1] === 'vector' ? 'vector' : 'bitmap';
            }
            
            // 提取 renderMode 属性
            const renderModeMatch = tagContent.match(/renderMode\s*=\s*["']?(\d+)["']?/);
            if (renderModeMatch) {
                config.renderMode = parseInt(renderModeMatch[1]);
            }
            
            // 提取 text 属性
            const textMatch = tagContent.match(/text\s*=\s*["']([^"']*)["']/);
            if (textMatch) {
                config.text = textMatch[1];
            }
            
            configs.push(config);
        }
    }

    /**
     * 按字体文件和配置分组，合并相同配置的字符集
     * 
     * 相同的字体文件 + fontSize + fontType + renderMode 视为同一组，
     * 合并它们的文本内容作为字符集
     */
    private groupLabelConfigsByFont(configs: Array<{
        fontFile: string;
        fontSize: number;
        fontType: 'bitmap' | 'vector';
        renderMode: number;
        text: string;
    }>): Array<{
        fontFile: string;
        fontSize: number;
        fontType: 'bitmap' | 'vector';
        renderMode: number;
        characters: string;
    }> {
        const groups = new Map<string, {
            fontFile: string;
            fontSize: number;
            fontType: 'bitmap' | 'vector';
            renderMode: number;
            charSet: Set<string>;
        }>();

        for (const config of configs) {
            // 生成分组键
            const key = `${config.fontFile}|${config.fontSize}|${config.fontType}|${config.renderMode}`;
            
            if (!groups.has(key)) {
                groups.set(key, {
                    fontFile: config.fontFile,
                    fontSize: config.fontSize,
                    fontType: config.fontType,
                    renderMode: config.renderMode,
                    charSet: new Set()
                });
            }
            
            // 将文本中的每个字符添加到字符集
            const group = groups.get(key)!;
            for (const char of config.text) {
                group.charSet.add(char);
            }
        }

        // 转换为数组，并将字符集转为字符串
        return Array.from(groups.values()).map(group => ({
            fontFile: group.fontFile,
            fontSize: group.fontSize,
            fontType: group.fontType,
            renderMode: group.renderMode,
            characters: Array.from(group.charSet).join('')
        }));
    }

    protected copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            let destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                // 如果是 .hml 文件，改为 .xml 后缀
                if (entry.name.endsWith('.hml')) {
                    const newName = entry.name.replace(/\.hml$/, '.xml');
                    destPath = path.join(dest, newName);
                }
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
