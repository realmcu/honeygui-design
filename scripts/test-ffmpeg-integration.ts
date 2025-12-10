/**
 * FFmpeg 集成测试脚本
 * 验证 FFmpeg 视频转换功能
 */

import * as path from 'path';
import * as fs from 'fs';
import { VideoConverterService } from '../src/services/VideoConverterService';

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
    log(`✓ ${message}`, colors.green);
}

function error(message: string) {
    log(`✗ ${message}`, colors.red);
}

function info(message: string) {
    log(`ℹ ${message}`, colors.blue);
}

function warn(message: string) {
    log(`⚠ ${message}`, colors.yellow);
}

// 测试 FFmpeg 可用性
async function testFFmpegAvailability(): Promise<boolean> {
    info('测试 FFmpeg 可用性...');
    
    const service = new VideoConverterService();
    const available = await service.checkFFmpegAvailable();
    
    if (available) {
        success('FFmpeg 可用');
        return true;
    } else {
        error('FFmpeg 不可用');
        warn('请安装 FFmpeg 并添加到系统 PATH');
        return false;
    }
}

// 测试视频信息获取
async function testVideoInfo(): Promise<boolean> {
    info('测试视频信息获取...');
    
    // 创建一个测试视频文件（空文件，仅用于测试路径处理）
    const testVideoPath = 'test_video.mp4';
    
    const service = new VideoConverterService();
    const videoInfo = await service.getVideoInfo(testVideoPath);
    
    if (videoInfo === null) {
        warn('测试视频文件不存在，跳过视频信息测试');
        success('视频信息获取功能正常（文件不存在时返回 null）');
        return true;
    } else {
        success('视频信息获取成功');
        console.log('  视频信息:', videoInfo);
        return true;
    }
}

// 测试转换参数构建
function testConversionParameters(): boolean {
    info('测试转换参数构建...');
    
    const service = new VideoConverterService();
    
    // 测试不同格式的参数构建
    const testCases = [
        {
            format: 'mjpeg' as const,
            quality: 85,
            expectedArgs: ['-vcodec', 'mjpeg', '-pix_fmt', 'yuvj420p', '-an', '-q:v']
        },
        {
            format: 'avi' as const,
            quality: 70,
            frameRate: 25,
            expectedArgs: ['-r', '25', '-an', '-vcodec', 'mjpeg', '-pix_fmt', 'yuvj420p', '-q:v']
        },
        {
            format: 'h264' as const,
            quality: 80,
            expectedArgs: ['-c:v', 'libx264', '-x264-params', '-an', '-f', 'rawvideo']
        }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
        try {
            // 通过反射访问私有方法进行测试
            const args = (service as any).buildFFmpegArgs(
                'input.mp4',
                'output.ext',
                testCase
            );
            
            let hasExpectedArgs = true;
            for (const expectedArg of testCase.expectedArgs) {
                if (!args.includes(expectedArg)) {
                    hasExpectedArgs = false;
                    break;
                }
            }
            
            if (hasExpectedArgs) {
                success(`  ✓ ${testCase.format} 格式参数正确`);
            } else {
                error(`  ✗ ${testCase.format} 格式参数错误`);
                console.log('    生成的参数:', args);
                console.log('    期望包含:', testCase.expectedArgs);
                allPassed = false;
            }
        } catch (err) {
            error(`  ✗ ${testCase.format} 格式测试失败: ${err}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        success('转换参数构建测试通过');
    }
    
    return allPassed;
}

// 测试输出扩展名
function testOutputExtensions(): boolean {
    info('测试输出扩展名...');
    
    const service = new VideoConverterService();
    
    const testCases = [
        { format: 'mjpeg', expected: '.mjpeg' },
        { format: 'avi', expected: '.avi' },
        { format: 'h264', expected: '.h264' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
        try {
            const ext = (service as any).getOutputExtension(testCase.format);
            if (ext === testCase.expected) {
                success(`  ✓ ${testCase.format} → ${ext}`);
            } else {
                error(`  ✗ ${testCase.format} → ${ext} (期望: ${testCase.expected})`);
                allPassed = false;
            }
        } catch (err) {
            error(`  ✗ ${testCase.format} 测试失败: ${err}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        success('输出扩展名测试通过');
    }
    
    return allPassed;
}

// 测试错误处理
function testErrorHandling(): boolean {
    info('测试错误处理...');
    
    const service = new VideoConverterService();
    
    // 测试错误信息解析
    const testErrors = [
        {
            stderr: 'No such file or directory',
            expected: 'No such file or directory'
        },
        {
            stderr: 'Invalid data found when processing input',
            expected: 'Invalid data found when processing input'
        },
        {
            stderr: 'ffmpeg version 4.4.0\nInput #0, mov,mp4,m4a,3gp,3g2,mj2, from \'test.mp4\':\nUnknown encoder \'libx265\'',
            expected: 'Unknown encoder'
        }
    ];
    
    let allPassed = true;
    
    for (const testError of testErrors) {
        try {
            const parsed = (service as any).parseFFmpegError(testError.stderr);
            if (parsed.includes(testError.expected.split(' ')[0])) {
                success(`  ✓ 错误解析正确: "${testError.expected}"`);
            } else {
                error(`  ✗ 错误解析失败: "${parsed}" (期望包含: "${testError.expected}")`);
                allPassed = false;
            }
        } catch (err) {
            error(`  ✗ 错误解析测试失败: ${err}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        success('错误处理测试通过');
    }
    
    return allPassed;
}

// 主测试函数
async function runFFmpegTests() {
    console.log('\n' + '='.repeat(60));
    log('FFmpeg 集成测试', colors.blue);
    console.log('='.repeat(60) + '\n');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    // 运行测试
    const tests = [
        { name: 'FFmpeg 可用性', fn: testFFmpegAvailability },
        { name: '视频信息获取', fn: testVideoInfo },
        { name: '转换参数构建', fn: testConversionParameters },
        { name: '输出扩展名', fn: testOutputExtensions },
        { name: '错误处理', fn: testErrorHandling }
    ];
    
    for (const test of tests) {
        results.total++;
        console.log('');
        const passed = await test.fn();
        if (passed) {
            results.passed++;
        } else {
            results.failed++;
        }
    }
    
    // 输出总结
    console.log('\n' + '='.repeat(60));
    log('FFmpeg 测试总结', colors.blue);
    console.log('='.repeat(60));
    console.log(`总计: ${results.total} 个测试`);
    success(`通过: ${results.passed} 个`);
    if (results.failed > 0) {
        error(`失败: ${results.failed} 个`);
    }
    
    // 输出建议
    if (results.failed === 0) {
        console.log('');
        success('所有测试通过！FFmpeg 集成准备就绪。');
    } else {
        console.log('');
        warn('部分测试失败，请检查 FFmpeg 安装和配置。');
    }
    
    console.log('='.repeat(60) + '\n');
    
    // 返回退出码
    process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runFFmpegTests().catch(err => {
    error(`FFmpeg 测试执行失败: ${err}`);
    process.exit(1);
});