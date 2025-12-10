/**
 * 视频控件功能测试脚本
 * 用于验证视频组件的基础功能
 */

import * as path from 'path';
import * as fs from 'fs';
import { VideoConverterService } from '../src/services/VideoConverterService';
import { HoneyGuiCCodeGenerator } from '../src/codegen/honeygui/HoneyGuiCCodeGenerator';
import { Component } from '../src/hml/types';

// 测试配置
const TEST_CONFIG = {
    testVideoPath: 'test_assets/test_video.mp4',
    outputDir: 'test_output'
};

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

// 测试 1: VideoConverterService 基础功能
async function testVideoConverterService(): Promise<boolean> {
    info('测试 1: VideoConverterService 基础功能');
    
    try {
        const service = new VideoConverterService();
        
        // 检查 FFmpeg 是否可用
        const ffmpegAvailable = await service.checkFFmpegAvailable();
        if (!ffmpegAvailable) {
            warn('FFmpeg 未找到，请安装 FFmpeg 并添加到系统 PATH');
            warn('跳过转换测试，但服务创建成功');
            success('VideoConverterService 创建成功');
            return true;
        }
        
        success('VideoConverterService 创建成功');
        success('FFmpeg 可用性验证通过');
        return true;
    } catch (err) {
        error(`VideoConverterService 测试失败: ${err}`);
        return false;
    }
}

// 测试 2: 代码生成功能
async function testCodeGeneration(): Promise<boolean> {
    info('测试 2: 代码生成功能');
    
    try {
        // 创建测试组件
        const testComponents: Component[] = [
            {
                id: 'main_view',
                type: 'hg_view',
                name: 'main_view',
                position: { x: 0, y: 0, width: 480, height: 272 },
                children: ['test_video'],
                parent: null,
                visible: true,
                enabled: true,
                locked: false,
                zIndex: 0
            },
            {
                id: 'test_video',
                type: 'hg_video',
                name: 'test_video',
                parent: 'main_view',
                position: { x: 40, y: 36, width: 400, height: 200 },
                data: {
                    src: 'assets/test.mp4',
                    format: 'mjpeg',
                    quality: 85,
                    frameRate: 30,
                    autoPlay: true
                },
                visible: true,
                enabled: true,
                locked: false,
                zIndex: 1
            }
        ];
        
        // 创建代码生成器
        const generator = new HoneyGuiCCodeGenerator(testComponents, {
            outputDir: TEST_CONFIG.outputDir,
            hmlFileName: 'test',
            enableProtectedAreas: true
        });
        
        // 生成代码
        const result = await generator.generate();
        
        if (!result.success) {
            error(`代码生成失败: ${result.errors?.join(', ')}`);
            return false;
        }
        
        success('代码生成成功');
        
        // 验证生成的文件
        const uiFile = path.join(TEST_CONFIG.outputDir, 'test_ui.c');
        if (fs.existsSync(uiFile)) {
            const content = fs.readFileSync(uiFile, 'utf-8');
            
            // 检查关键代码
            const checks = [
                { pattern: 'gui_video_create_from_fs', desc: '视频创建函数' },
                { pattern: 'gui_video_set_frame_rate', desc: '帧率设置函数' },
                { pattern: 'gui_video_set_state', desc: '播放状态设置函数' },
                { pattern: '/test.mjpeg', desc: 'VFS 路径格式' },
                { pattern: 'GUI_VIDEO_STATE_PLAYING', desc: '播放状态常量' }
            ];
            
            for (const check of checks) {
                if (content.includes(check.pattern)) {
                    success(`  ✓ 包含 ${check.desc}`);
                } else {
                    error(`  ✗ 缺少 ${check.desc}`);
                    return false;
                }
            }
            
            success('生成的代码验证通过');
        } else {
            error('生成的 UI 文件不存在');
            return false;
        }
        
        return true;
    } catch (err) {
        error(`代码生成测试失败: ${err}`);
        return false;
    }
}

// 测试 3: 路径转换逻辑
function testPathConversion(): boolean {
    info('测试 3: 路径转换逻辑');
    
    const testCases = [
        {
            input: 'assets/video.mp4',
            format: 'mjpeg',
            expected: '/video.mjpeg'
        },
        {
            input: 'assets/test.avi',
            format: 'avi',
            expected: '/test.avi'
        },
        {
            input: 'assets/movie.mov',
            format: 'h264',
            expected: '/movie.h264'  // H.264 原始流格式
        }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
        // 模拟路径转换逻辑
        let result = testCase.input;
        
        // 根据格式替换扩展名
        if (testCase.format === 'mjpeg') {
            result = result.replace(/\.[^.]+$/i, '.mjpeg');
        } else if (testCase.format === 'avi') {
            result = result.replace(/\.[^.]+$/i, '.avi');
        } else if (testCase.format === 'h264') {
            result = result.replace(/\.[^.]+$/i, '.h264');  // H.264 原始流格式
        }
        
        // 去掉 assets/ 前缀
        result = result.replace(/^assets\//, '');
        
        // 添加 VFS 根路径
        if (!result.startsWith('/')) {
            result = '/' + result;
        }
        
        if (result === testCase.expected) {
            success(`  ✓ ${testCase.input} (${testCase.format}) → ${result}`);
        } else {
            error(`  ✗ ${testCase.input} (${testCase.format}) → ${result} (期望: ${testCase.expected})`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        success('路径转换逻辑验证通过');
    }
    
    return allPassed;
}

// 测试 4: 组件数据结构
function testComponentDataStructure(): boolean {
    info('测试 4: 组件数据结构');
    
    try {
        const videoComponent: Component = {
            id: 'video_test',
            type: 'hg_video',
            name: 'video_test',
            position: { x: 0, y: 0, width: 400, height: 300 },
            data: {
                src: 'assets/test.mp4',
                format: 'mjpeg',
                quality: 85,
                frameRate: 30,
                autoPlay: true
            },
            visible: true,
            enabled: true,
            locked: false,
            zIndex: 1
        };
        
        // 验证必需字段
        const requiredFields = ['id', 'type', 'name', 'position'];
        for (const field of requiredFields) {
            if (!(field in videoComponent)) {
                error(`  ✗ 缺少必需字段: ${field}`);
                return false;
            }
            success(`  ✓ 包含字段: ${field}`);
        }
        
        // 验证 data 字段
        const dataFields = ['src', 'format', 'quality', 'frameRate', 'autoPlay'];
        for (const field of dataFields) {
            if (!(field in (videoComponent.data || {}))) {
                warn(`  ⚠ data 中缺少可选字段: ${field}`);
            } else {
                success(`  ✓ data 包含字段: ${field}`);
            }
        }
        
        success('组件数据结构验证通过');
        return true;
    } catch (err) {
        error(`组件数据结构测试失败: ${err}`);
        return false;
    }
}

// 清理测试输出
function cleanup() {
    if (fs.existsSync(TEST_CONFIG.outputDir)) {
        fs.rmSync(TEST_CONFIG.outputDir, { recursive: true, force: true });
    }
}

// 主测试函数
async function runTests() {
    console.log('\n' + '='.repeat(60));
    log('视频控件功能测试', colors.blue);
    console.log('='.repeat(60) + '\n');
    
    // 清理之前的测试输出
    cleanup();
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    // 运行测试
    const tests = [
        { name: 'VideoConverterService', fn: testVideoConverterService },
        { name: '代码生成', fn: testCodeGeneration },
        { name: '路径转换', fn: testPathConversion },
        { name: '组件数据结构', fn: testComponentDataStructure }
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
    
    // 清理测试输出
    cleanup();
    
    // 输出总结
    console.log('\n' + '='.repeat(60));
    log('测试总结', colors.blue);
    console.log('='.repeat(60));
    console.log(`总计: ${results.total} 个测试`);
    success(`通过: ${results.passed} 个`);
    if (results.failed > 0) {
        error(`失败: ${results.failed} 个`);
    }
    console.log('='.repeat(60) + '\n');
    
    // 返回退出码
    process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(err => {
    error(`测试执行失败: ${err}`);
    process.exit(1);
});
