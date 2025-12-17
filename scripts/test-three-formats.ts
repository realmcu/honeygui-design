#!/usr/bin/env node

/**
 * 测试三种视频格式转换
 * 测试 MJPEG、AVI、H.264 三种格式的转换功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { VideoConverterService } from '../src/services/VideoConverterService';

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function info(msg: string) { console.log(`${colors.blue}ℹ${colors.reset} ${msg}`); }
function success(msg: string) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg: string) { console.log(`${colors.yellow}⚠${colors.reset} ${msg}`); }
function error(msg: string) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function step(msg: string) { console.log(`${colors.cyan}▶${colors.reset} ${msg}`); }

async function testThreeFormats() {
    console.log('🎬 测试三种视频格式转换\n');

    // 检查测试视频是否存在
    const testVideoDir = path.join(process.cwd(), 'assets_test');
    if (!fs.existsSync(testVideoDir)) {
        error(`测试目录不存在: ${testVideoDir}`);
        error('请创建 assets_test 目录并放入测试视频文件');
        return;
    }

    // 查找测试视频文件
    const videoFiles = fs.readdirSync(testVideoDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
    });

    if (videoFiles.length === 0) {
        error('未找到测试视频文件');
        error('请在 assets_test 目录中放入至少一个视频文件（.mp4, .avi, .mov, .mkv）');
        return;
    }

    info(`找到 ${videoFiles.length} 个测试视频文件:`);
    videoFiles.forEach(file => {
        console.log(`  - ${file}`);
    });
    console.log('');

    // 创建输出目录
    const outputDir = path.join(process.cwd(), 'assets_test_output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        info(`创建输出目录: ${outputDir}\n`);
    }

    // 创建视频转换服务（带 SDK 路径，测试完整的转换流程）
    // 尝试从环境变量或默认路径获取 SDK 路径
    let sdkPath = process.env.HONEYGUI_SDK_PATH;
    
    if (!sdkPath) {
        // 尝试默认路径
        const defaultPaths = process.platform === 'win32' 
            ? ['C:\\HoneyGUI-SDK', path.join(process.env.USERPROFILE || 'C:\\', '.HoneyGUI-SDK')]
            : [path.join(process.env.HOME || '~', '.HoneyGUI-SDK'), '/opt/HoneyGUI-SDK'];
        
        for (const defaultPath of defaultPaths) {
            if (fs.existsSync(defaultPath)) {
                sdkPath = defaultPath;
                break;
            }
        }
    }
    
    if (sdkPath) {
        info(`SDK 路径: ${sdkPath}`);
        if (!fs.existsSync(sdkPath)) {
            warn(`SDK 目录不存在: ${sdkPath}`);
            warn('将跳过 SDK 后处理步骤');
            sdkPath = undefined;
        }
    } else {
        warn('未配置 SDK 路径');
        warn('将跳过 SDK 后处理步骤');
        console.log('');
        console.log('💡 配置 SDK 路径:');
        console.log('  Windows CMD: set HONEYGUI_SDK_PATH=C:\\path\\to\\SDK');
        console.log('  Windows PowerShell: $env:HONEYGUI_SDK_PATH="C:\\path\\to\\SDK"');
        console.log('  Linux/macOS: export HONEYGUI_SDK_PATH=/path/to/SDK');
        console.log('');
        console.log('或者将 SDK 放在默认路径:');
        if (process.platform === 'win32') {
            console.log('  - C:\\HoneyGUI-SDK');
            console.log(`  - ${path.join(process.env.USERPROFILE || 'C:\\', '.HoneyGUI-SDK')}`);
        } else {
            console.log(`  - ${path.join(process.env.HOME || '~', '.HoneyGUI-SDK')}`);
            console.log('  - /opt/HoneyGUI-SDK');
        }
    }
    console.log('');
    
    const videoConverter = new VideoConverterService(sdkPath);

    // 检查 FFmpeg 是否可用
    step('检查 FFmpeg 可用性...');
    const ffmpegAvailable = await videoConverter.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
        error('FFmpeg 未找到，请安装 FFmpeg 并添加到系统 PATH');
        return;
    }
    success('FFmpeg 可用');

    // 检查 SDK 后处理脚本是否存在
    if (sdkPath) {
        step('检查 SDK 后处理脚本...');
        const possibleScriptPaths = [
            path.join(sdkPath, 'tool', 'video-convert-tool', 'video_converter.py'),
            path.join(sdkPath, 'tool', 'video_converter.py'),
            path.join(sdkPath, 'tools', 'video_converter.py'),
            path.join(sdkPath, 'video_converter.py')
        ];

        let scriptFound = false;
        let foundScriptPath = '';
        for (const scriptPath of possibleScriptPaths) {
            if (fs.existsSync(scriptPath)) {
                scriptFound = true;
                foundScriptPath = scriptPath;
                break;
            }
        }

        if (scriptFound) {
            success(`SDK 后处理脚本已找到: ${foundScriptPath}`);
        } else {
            warn('SDK 后处理脚本未找到');
            warn('将使用 FFmpeg 直接转换（跳过后处理）');
            console.log('  尝试的路径:');
            possibleScriptPaths.forEach(p => console.log(`    - ${p}`));
        }
        console.log('');
    }

    // 测试每个视频文件的三种格式转换
    for (const videoFile of videoFiles) {
        const inputPath = path.join(testVideoDir, videoFile);
        const baseName = path.basename(videoFile, path.extname(videoFile));

        console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.magenta}📹 测试视频: ${videoFile}${colors.reset}`);
        console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

        // 获取视频信息
        step('获取视频信息...');
        const videoInfo = await videoConverter.getVideoInfo(inputPath);
        if (videoInfo) {
            console.log(`  分辨率: ${videoInfo.width}x${videoInfo.height}`);
            console.log(`  帧率: ${videoInfo.frameRate?.toFixed(2)} fps`);
            console.log(`  时长: ${videoInfo.duration?.toFixed(2)} 秒`);
            console.log(`  格式: ${videoInfo.format}`);
            console.log('');
        }

        // 测试三种格式
        const formats: Array<{
            name: string;
            format: 'mjpeg' | 'avi' | 'h264';
            ext: string;
            quality: number;
            frameRate: number;
        }> = [
            { name: 'MJPEG', format: 'mjpeg', ext: '.mjpeg', quality: 85, frameRate: 30 },
            { name: 'AVI (MJPEG)', format: 'avi', ext: '.avi', quality: 85, frameRate: 25 },
            { name: 'H.264', format: 'h264', ext: '.h264', quality: 85, frameRate: 30 }
        ];

        const results: Array<{ format: string; success: boolean; time: number; size: number; warning?: string }> = [];

        for (const formatConfig of formats) {
            step(`转换为 ${formatConfig.name} 格式...`);

            const outputPath = path.join(outputDir, `${baseName}${formatConfig.ext}`);

            const startTime = Date.now();
            const result = await videoConverter.convert(inputPath, outputPath, {
                format: formatConfig.format,
                quality: formatConfig.quality,
                frameRate: formatConfig.frameRate
            });
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            if (result.success) {
                const fileSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
                const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

                success(`${formatConfig.name} 转换成功`);
                console.log(`  输出文件: ${path.basename(outputPath)}`);
                console.log(`  文件大小: ${fileSizeMB} MB`);
                console.log(`  转换耗时: ${duration.toFixed(2)} 秒`);

                if (result.warning) {
                    warn(`  警告: ${result.warning}`);
                    if (result.warning.includes('post-processing')) {
                        warn(`  → 未使用 SDK 后处理，使用了直接文件复制`);
                    }
                } else {
                    info(`  ✓ 已完成 SDK 后处理`);
                }

                results.push({
                    format: formatConfig.name,
                    success: true,
                    time: duration,
                    size: fileSize,
                    warning: result.warning
                });
            } else {
                error(`${formatConfig.name} 转换失败`);
                console.log(`  错误: ${result.error}`);

                results.push({
                    format: formatConfig.name,
                    success: false,
                    time: duration,
                    size: 0
                });
            }

            console.log('');
        }

        // 显示对比结果
        console.log(`${colors.cyan}📊 转换结果对比:${colors.reset}`);
        console.log('┌─────────────────┬──────────┬──────────────┬──────────────┐');
        console.log('│ 格式            │ 状态     │ 文件大小     │ 转换时间     │');
        console.log('├─────────────────┼──────────┼──────────────┼──────────────┤');

        results.forEach(result => {
            const status = result.success ? '✓ 成功' : '✗ 失败';
            const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : '-';
            const time = `${result.time.toFixed(2)}s`;

            const formatPadded = result.format.padEnd(15);
            const statusPadded = status.padEnd(8);
            const sizePadded = size.padEnd(12);
            const timePadded = time.padEnd(12);

            console.log(`│ ${formatPadded} │ ${statusPadded} │ ${sizePadded} │ ${timePadded} │`);
        });

        console.log('└─────────────────┴──────────┴──────────────┴──────────────┘');
        console.log('');
    }

    // 总结
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}✅ 测试完成！${colors.reset}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    info(`输出目录: ${outputDir}`);
    info('请检查输出文件以验证转换质量');
}

// 运行测试
testThreeFormats().catch(err => {
    error(`测试失败: ${err.message}`);
    console.error(err);
    process.exit(1);
});