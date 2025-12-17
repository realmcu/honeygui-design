#!/usr/bin/env node

/**
 * 调试视频格式转换脚本
 * 用于验证不同格式的 FFmpeg 命令生成
 */

import { VideoConverterService, VideoConvertOptions } from '../src/services/VideoConverterService';

async function debugVideoFormats() {
    console.log('🔍 调试视频格式转换...\n');
    
    const service = new VideoConverterService();
    
    // 测试不同格式的命令生成
    const testCases: Array<{ name: string; options: VideoConvertOptions }> = [
        {
            name: 'MJPEG 格式',
            options: { format: 'mjpeg', quality: 85, frameRate: 30 }
        },
        {
            name: 'AVI 格式',
            options: { format: 'avi', quality: 85, frameRate: 25 }
        },
        {
            name: 'H.264 格式',
            options: { format: 'h264', quality: 85, frameRate: 30 }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}:`);
        
        // 使用反射获取私有方法（仅用于调试）
        const buildFFmpegArgs = (service as any).buildFFmpegArgs.bind(service);
        const getOutputExtension = (service as any).getOutputExtension.bind(service);
        
        const inputPath = 'test_input.mp4';
        const outputExt = getOutputExtension(testCase.options.format);
        const outputPath = `test_output${outputExt}`;
        
        console.log(`  输出扩展名: ${outputExt}`);
        
        const args = buildFFmpegArgs(inputPath, outputPath, testCase.options);
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
        
        console.log('');
    }
    
    // 测试实际的文件扩展名生成
    console.log('📁 文件扩展名测试:');
    const formats = ['mjpeg', 'avi', 'h264'];
    for (const format of formats) {
        const getOutputExtension = (service as any).getOutputExtension.bind(service);
        const ext = getOutputExtension(format);
        console.log(`  ${format} -> ${ext}`);
    }
    
    console.log('\n✅ 调试完成');
}

// 运行调试
debugVideoFormats().catch(console.error);