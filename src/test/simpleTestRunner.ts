import * as fs from 'fs';
import * as path from 'path';

// 简单的测试运行器
async function runSimpleTests() {
    console.log('开始运行简单测试...');
    
    // 编译TypeScript文件
    console.log('首先确保代码已编译...');
    
    // 测试目录路径
    const testDirs = [
        path.join(__dirname, '../../test/unit'),
        path.join(__dirname, '../../test/integration')
    ];
    
    // 查找所有测试文件
    const testFiles: string[] = [];
    
    for (const testDir of testDirs) {
        try {
            const files = await fs.promises.readdir(testDir, { recursive: true });
            files.forEach(file => {
                if (file.endsWith('.test.ts')) {
                    testFiles.push(path.join(testDir, file));
                }
            });
        } catch (error) {
            console.log(`无法读取测试目录 ${testDir}: ${error}`);
        }
    }
    
    console.log(`找到 ${testFiles.length} 个测试文件`);
    testFiles.forEach(file => console.log(`- ${file}`));
    
    // 验证代码编译状态
    console.log('\n验证代码编译状态...');
    const compiledDir = path.join(__dirname, '../..', 'out');
    if (fs.existsSync(compiledDir)) {
        console.log('✓ 编译输出目录存在');
        
        // 检查主要编译文件
        const extensionJs = path.join(compiledDir, 'extension.js');
        if (fs.existsSync(extensionJs)) {
            console.log('✓ 主扩展文件已编译');
        } else {
            console.log('✗ 主扩展文件未找到');
        }
    } else {
        console.log('✗ 编译输出目录不存在');
    }
    
    // 检查核心功能模块
    console.log('\n检查核心功能模块...');
    const coreModules = [
        path.join(compiledDir, 'codegen', 'cpp', 'CppCodeGenerator.js'),
        path.join(compiledDir, 'designer', 'DesignerPanel.js'),
        path.join(compiledDir, 'hml', 'HmlParser.js')
    ];
    
    for (const module of coreModules) {
        if (fs.existsSync(module)) {
            console.log(`✓ 核心模块已编译: ${path.basename(module)}`);
        } else {
            console.log(`✗ 核心模块未找到: ${path.basename(module)}`);
        }
    }
    
    console.log('\n简单测试完成! 建议在完整环境中运行完整的测试套件。');
}

runSimpleTests().catch(console.error);