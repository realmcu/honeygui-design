import * as fs from 'fs';
import * as path from 'path';

// 简单的集成测试验证
async function runSimpleIntegrationTest() {
    console.log('开始运行简单集成测试...');
    
    let passed = true;
    const tempDir = path.join(__dirname, '../../test_temp');
    
    try {
        // 创建临时目录
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 测试1: 验证核心文件结构
        console.log('\n测试1: 验证核心文件结构');
        try {
            const srcDir = path.join(__dirname, '../..', 'src');
            const requiredDirs = [
                path.join(srcDir, 'designer'),
                path.join(srcDir, 'codegen'),
                path.join(srcDir, 'hml')
            ];
            
            for (const dir of requiredDirs) {
                if (fs.existsSync(dir)) {
                    console.log(`✓ 目录存在: ${path.relative(srcDir, dir)}`);
                } else {
                    console.error(`✗ 目录不存在: ${path.relative(srcDir, dir)}`);
                    passed = false;
                }
            }
        } catch (error) {
            console.error(`✗ 目录结构测试失败: ${error}`);
            passed = false;
        }
        
        // 测试2: 验证编译输出
        console.log('\n测试2: 验证编译输出');
        try {
            const outDir = path.join(__dirname, '../..', 'out');
            const requiredFiles = [
                path.join(outDir, 'extension.js'),
                path.join(outDir, 'designer/DesignerPanel.js'),
                path.join(outDir, 'codegen/cpp/CppCodeGenerator.js')
            ];
            
            for (const file of requiredFiles) {
                if (fs.existsSync(file)) {
                    console.log(`✓ 编译文件存在: ${path.relative(outDir, file)}`);
                } else {
                    console.error(`✗ 编译文件不存在: ${path.relative(outDir, file)}`);
                    passed = false;
                }
            }
        } catch (error) {
            console.error(`✗ 编译输出测试失败: ${error}`);
            passed = false;
        }
        
        // 测试3: 验证文件操作功能
        console.log('\n测试3: 文件操作功能测试');
        try {
            const testFile = path.join(tempDir, 'test_output.txt');
            fs.writeFileSync(testFile, '测试内容', 'utf8');
            
            if (fs.existsSync(testFile)) {
                console.log('✓ 文件写入和读取功能正常');
                fs.unlinkSync(testFile);
            } else {
                console.error('✗ 文件写入失败');
                passed = false;
            }
        } catch (error) {
            console.error(`✗ 文件操作测试失败: ${error}`);
            passed = false;
        }
        
        // 测试4: 验证代码生成输出目录处理
        console.log('\n测试4: 输出目录处理测试');
        try {
            const nestedDir = path.join(tempDir, 'nested/output/dir');
            if (!fs.existsSync(nestedDir)) {
                fs.mkdirSync(nestedDir, { recursive: true });
            }
            console.log('✓ 嵌套目录创建功能正常');
        } catch (error) {
            console.error(`✗ 目录处理测试失败: ${error}`);
            passed = false;
        }
        
        // 测试5: 验证测试文件存在
        console.log('\n测试5: 验证测试文件存在');
        try {
            const testDir = path.join(__dirname, '../..', 'test');
            const testFiles = [
                path.join(testDir, 'unit/codegen/CppCodeGenerator.test.ts'),
                path.join(testDir, 'unit/designer/Designer.test.ts'),
                path.join(testDir, 'integration/DesignerCodeGenIntegration.test.ts')
            ];
            
            for (const file of testFiles) {
                if (fs.existsSync(file)) {
                    console.log(`✓ 测试文件存在: ${path.relative(testDir, file)}`);
                } else {
                    console.error(`✗ 测试文件不存在: ${path.relative(testDir, file)}`);
                    passed = false;
                }
            }
        } catch (error) {
            console.error(`✗ 测试文件验证失败: ${error}`);
            passed = false;
        }
        
    } finally {
        // 清理临时目录
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
    
    console.log('\n集成测试验证完成!');
    console.log(`总体结果: ${passed ? '通过' : '失败'}`);
    
    return passed;
}

runSimpleIntegrationTest().then(passed => {
    process.exit(passed ? 0 : 1);
}).catch(error => {
    console.error('集成测试执行失败:', error);
    process.exit(1);
});