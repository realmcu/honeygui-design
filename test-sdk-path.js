#!/usr/bin/env node

/**
 * 快速测试 SDK 路径检测逻辑
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 测试 SDK 路径检测\n');

// 模拟测试脚本中的 SDK 路径检测逻辑
let sdkPath = process.env.HONEYGUI_SDK_PATH;

console.log('1. 检查环境变量 HONEYGUI_SDK_PATH:');
if (sdkPath) {
    console.log(`   ✓ 找到: ${sdkPath}`);
} else {
    console.log('   ✗ 未设置');
}

if (!sdkPath) {
    console.log('\n2. 检查默认路径:');
    const defaultPaths = process.platform === 'win32' 
        ? ['C:\\HoneyGUI-SDK', path.join(process.env.USERPROFILE || 'C:\\', '.HoneyGUI-SDK')]
        : [path.join(process.env.HOME || '~', '.HoneyGUI-SDK'), '/opt/HoneyGUI-SDK'];
    
    console.log('   尝试的路径:');
    for (const defaultPath of defaultPaths) {
        const exists = fs.existsSync(defaultPath);
        console.log(`   ${exists ? '✓' : '✗'} ${defaultPath}`);
        if (exists && !sdkPath) {
            sdkPath = defaultPath;
        }
    }
}

console.log('\n3. 最终结果:');
if (sdkPath) {
    console.log(`   SDK 路径: ${sdkPath}`);
    
    if (fs.existsSync(sdkPath)) {
        console.log('   ✓ 目录存在');
        
        // 检查后处理脚本
        console.log('\n4. 检查后处理脚本:');
        const possibleScriptPaths = [
            path.join(sdkPath, 'tool', 'video-convert-tool', 'video_converter.py'),
            path.join(sdkPath, 'tool', 'video_converter.py'),
            path.join(sdkPath, 'tools', 'video_converter.py'),
            path.join(sdkPath, 'video_converter.py')
        ];

        let scriptFound = false;
        for (const scriptPath of possibleScriptPaths) {
            const exists = fs.existsSync(scriptPath);
            console.log(`   ${exists ? '✓' : '✗'} ${scriptPath}`);
            if (exists && !scriptFound) {
                scriptFound = true;
                console.log(`   → 将使用此脚本`);
            }
        }

        if (!scriptFound) {
            console.log('\n   ⚠ 未找到后处理脚本');
            console.log('   → 转换时将跳过 SDK 后处理');
        }
    } else {
        console.log('   ✗ 目录不存在');
    }
} else {
    console.log('   ✗ 未配置 SDK 路径');
    console.log('\n💡 配置方法:');
    console.log('   Windows CMD: set HONEYGUI_SDK_PATH=C:\\path\\to\\SDK');
    console.log('   Windows PowerShell: $env:HONEYGUI_SDK_PATH="C:\\path\\to\\SDK"');
    console.log('   Linux/macOS: export HONEYGUI_SDK_PATH=/path/to/SDK');
    console.log('\n   或者将 SDK 放在默认路径:');
    if (process.platform === 'win32') {
        console.log('   - C:\\HoneyGUI-SDK');
        console.log(`   - ${path.join(process.env.USERPROFILE || 'C:\\', '.HoneyGUI-SDK')}`);
    } else {
        console.log(`   - ${path.join(process.env.HOME || '~', '.HoneyGUI-SDK')}`);
        console.log('   - /opt/HoneyGUI-SDK');
    }
}

console.log('\n✅ 检测完成');
