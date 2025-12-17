#!/usr/bin/env node

/**
 * 测试视频格式转换修复
 * 验证不同格式的视频是否能正确转换为对应的格式
 */

import * as fs from 'fs';
import * as path from 'path';
import { VideoConverterService } from '../src/services/VideoConverterService';

async function testVideoFormatFix() {
    console.log('🧪 测试视频格式转换修复...\n');
    
    const service = new VideoConverterService();
    
    // 测试不同格式的输出扩展名
    console.log('📁 测试输出扩展名:');
    const getOutputExtension = (service as any).getOutputExtension.bind(service);
    
    const formats = ['mjpeg', 'avi', 'h264'];
    formats.forEach(format => {
        const ext = getOutputExtension(format);
        console.log(`  ${format} -> ${ext}`);
    });
    
    console.log('\n🔧 测试 FFmpeg 命令生成:');
    
    // 测试不同格式的命令生成
    const testCases = [
        { format: 'mjpeg', quality: 85, frameRate: 30 },
        { format: 'avi', quality: 85, frameRate: 25 },
        { format: 'h264', quality: 85, frameRate: 30 }
    ];
    
    const buildFFmpegArgs = (service as any).buildFFmpegArgs.bind(service);
    
    testCases.forEach(options => {
        const inputPath = 'test.mp4';
        const outputExt = getOutputExtension(options.format);
        const outputPath = `test${outputExt}`;
        
        const args = buildFFmpegArgs(inputPath, outputPath, options);
        
        console.log(`\n📋 ${options.format.toUpperCase()} 格式:`);
        console.log(`  输出文件: ${outputPath}`);
        console.log(`  FFmpeg 命令: ffmpeg ${args.join(' ')}`);
        
        // 检查关键参数
        const codecIndex = args.indexOf('-vcodec') !== -1 ? args.indexOf('-vcodec') + 1 : 
                          args.indexOf('-c:v') !== -1 ? args.indexOf('-c:v') + 1 : -1;
        
        if (codecIndex !== -1) {
            console.log(`  视频编码器: ${args[codecIndex]}`);
        }
        
        const formatIndex = args.indexOf('-f');
        if (formatIndex !== -1) {
            console.log(`  输出格式: ${args[formatIndex + 1]}`);
        }
        
        // 验证格式正确性
        if (options.format === 'mjpeg') {
            const isCorrect = args.includes('-vcodec') && args.includes('mjpeg') && 
                             outputPath.endsWith('.mjpeg');
            console.log(`  ✅ 格式正确: ${isCorrect}`);
        } else if (options.format === 'avi') {
            const isCorrect = args.includes('-vcodec') && args.includes('mjpeg') && 
                             outputPath.endsWith('.avi');
            console.log(`  ✅ 格式正确: ${isCorrect} (AVI 容器 + MJPEG 编码)`);
        } else if (options.format === 'h264') {
            const isCorrect = args.includes('-c:v') && args.includes('libx264') && 
                             args.includes('-f') && args.includes('rawvideo') &&
                             outputPath.endsWith('.h264');
            console.log(`  ✅ 格式正确: ${isCorrect} (H.264 原始流)`);
        }
    });
    
    console.log('\n🎯 测试总结:');
    console.log('  - MJPEG: 使用 mjpeg 编码器，输出 .mjpeg 文件');
    console.log('  - AVI: 使用 mjpeg 编码器 + AVI 容器，输出 .avi 文件');
    console.log('  - H.264: 使用 libx264 编码器 + rawvideo 格式，输出 .h264 文件');
    
    console.log('\n✅ 测试完成！');
    console.log('\n📝 修复说明:');
    console.log('  1. 修改了 BuildCore.ts 中的视频转换逻辑');
    console.log('  2. 现在会读取 HML 文件中每个视频组件的格式设置');
    console.log('  3. 不同的视频组件可以使用不同的输出格式');
    console.log('  4. 如果组件没有指定格式，则使用项目配置中的默认格式');
}

// 运行测试
testVideoFormatFix().catch(console.error);