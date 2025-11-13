import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { CppCodeGenerator, CCppCodeGenerator } from '../../../src/codegen/cpp/CppCodeGenerator';
import { Component } from '../../../src/hml/Component';
import { CodeGeneratorOptions } from '../../../src/codegen/CodeGenerator';

describe('CppCodeGenerator', () => {
    let cppGenerator: CppCodeGenerator;
    let cGenerator: CCppCodeGenerator;
    let testOutputDir: string;
    
    beforeEach(() => {
        cppGenerator = new CppCodeGenerator();
        cGenerator = new CCppCodeGenerator();
        testOutputDir = path.join(__dirname, 'test-output');
        
        // 清理测试目录
        if (fs.existsSync(testOutputDir)) {
            // 删除目录下所有文件
            fs.readdirSync(testOutputDir).forEach(file => {
                fs.unlinkSync(path.join(testOutputDir, file));
            });
            fs.rmdirSync(testOutputDir);
        }
        
        // 创建测试目录
        fs.mkdirSync(testOutputDir, { recursive: true });
    });
    
    afterEach(() => {
        // 清理测试目录
        if (fs.existsSync(testOutputDir)) {
            fs.readdirSync(testOutputDir).forEach(file => {
                fs.unlinkSync(path.join(testOutputDir, file));
            });
            fs.rmdirSync(testOutputDir);
        }
    });
    
    describe('C++代码生成测试', () => {
        it('应该能够生成C++主窗口代码', async () => {
            const components: Component[] = [
                new Component('button', {
                    id: 'testButton',
                    text: 'Test Button',
                    x: 100,
                    y: 100,
                    width: 120,
                    height: 40
                })
            ];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cppGenerator.generate(components, options);
            
            assert.ok(result.success);
            assert.strictEqual(result.outputPath, testOutputDir);
            
            // 检查生成的文件
            const mainWindowHPath = path.join(testOutputDir, 'main_window.h');
            const mainWindowCppPath = path.join(testOutputDir, 'main_window.cpp');
            
            assert.ok(fs.existsSync(mainWindowHPath));
            assert.ok(fs.existsSync(mainWindowCppPath));
            
            const hContent = fs.readFileSync(mainWindowHPath, 'utf8');
            const cppContent = fs.readFileSync(mainWindowCppPath, 'utf8');
            
            assert.ok(hContent.includes('class MainWindow'));
            assert.ok(cppContent.includes('void MainWindow::initialize'));
            assert.ok(cppContent.includes('testButton'));
        });
        
        it('应该能够生成C++应用程序代码', async () => {
            const components: Component[] = [];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cppGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查生成的应用程序文件
            const appHPath = path.join(testOutputDir, 'app.h');
            const appCppPath = path.join(testOutputDir, 'app.cpp');
            
            assert.ok(fs.existsSync(appHPath));
            assert.ok(fs.existsSync(appCppPath));
            
            const appHContent = fs.readFileSync(appHPath, 'utf8');
            const appCppContent = fs.readFileSync(appCppPath, 'utf8');
            
            assert.ok(appHContent.includes('class Application'));
            assert.ok(appCppContent.includes('Application::Application'));
        });
        
        it('应该能够生成主函数代码', async () => {
            const components: Component[] = [];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cppGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查生成的主函数文件
            const mainCppPath = path.join(testOutputDir, 'main.cpp');
            
            assert.ok(fs.existsSync(mainCppPath));
            
            const mainContent = fs.readFileSync(mainCppPath, 'utf8');
            
            assert.ok(mainContent.includes('int main'));
            assert.ok(mainContent.includes('Application app'));
        });
        
        it('应该能够生成CMakeLists.txt', async () => {
            const components: Component[] = [];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cppGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查生成的CMake文件
            const cmakePath = path.join(testOutputDir, 'CMakeLists.txt');
            
            assert.ok(fs.existsSync(cmakePath));
            
            const cmakeContent = fs.readFileSync(cmakePath, 'utf8');
            
            assert.ok(cmakeContent.includes('cmake_minimum_required'));
            assert.ok(cmakeContent.includes('project(honeygui_app'));
        });
    });
    
    describe('C代码生成测试', () => {
        it('应该能够生成C主窗口代码', async () => {
            const components: Component[] = [
                new Component('button', {
                    id: 'cButton',
                    text: 'C Button',
                    x: 50,
                    y: 50,
                    width: 100,
                    height: 30
                })
            ];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查生成的文件
            const mainWindowHPath = path.join(testOutputDir, 'main_window.h');
            const mainWindowCPath = path.join(testOutputDir, 'main_window.c');
            
            assert.ok(fs.existsSync(mainWindowHPath));
            assert.ok(fs.existsSync(mainWindowCPath));
            
            const hContent = fs.readFileSync(mainWindowHPath, 'utf8');
            const cContent = fs.readFileSync(mainWindowCPath, 'utf8');
            
            assert.ok(hContent.includes('typedef struct MainWindow'));
            assert.ok(cContent.includes('void main_window_initialize'));
            assert.ok(cContent.includes('cButton'));
        });
        
        it('应该能够生成C应用程序代码', async () => {
            const components: Component[] = [];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查生成的应用程序文件
            const appHPath = path.join(testOutputDir, 'app.h');
            const appCPath = path.join(testOutputDir, 'app.c');
            
            assert.ok(fs.existsSync(appHPath));
            assert.ok(fs.existsSync(appCPath));
            
            const appHContent = fs.readFileSync(appHPath, 'utf8');
            const appCContent = fs.readFileSync(appCPath, 'utf8');
            
            assert.ok(appHContent.includes('typedef struct Application'));
            assert.ok(appCContent.includes('application_create'));
        });
    });
    
    describe('代码保护区测试', () => {
        it('应该能够保留代码保护区内容', async () => {
            // 先创建一个带有保护区的文件
            const protectedCode = `// HONEYGUI PROTECTED START [custom-initialization]
    // 这是用户自定义的初始化代码
    printf("自定义初始化\n");
// HONEYGUI PROTECTED END [custom-initialization]`;
            
            const mainWindowContent = `#ifndef MAIN_WINDOW_H
#define MAIN_WINDOW_H

class MainWindow {
public:
    MainWindow();
    ~MainWindow();
    void initialize();
    void show();
};

#endif // MAIN_WINDOW_H`;
            
            const mainWindowCppContent = `#include "main_window.h"
#include <iostream>

MainWindow::MainWindow() {
}

MainWindow::~MainWindow() {
}

void MainWindow::initialize() {
    // 初始化代码
    ${protectedCode}
    // 其他初始化
}

void MainWindow::show() {
    // 显示窗口
}`;
            
            fs.writeFileSync(path.join(testOutputDir, 'main_window.h'), mainWindowContent);
            fs.writeFileSync(path.join(testOutputDir, 'main_window.cpp'), mainWindowCppContent);
            
            // 生成新代码，应该保留保护区
            const components: Component[] = [
                new Component('button', {
                    id: 'newButton',
                    text: 'New Button',
                    x: 100,
                    y: 100,
                    width: 120,
                    height: 40
                })
            ];
            
            const options: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const result = await cppGenerator.generate(components, options);
            
            assert.ok(result.success);
            
            // 检查保护区是否被保留
            const updatedContent = fs.readFileSync(path.join(testOutputDir, 'main_window.cpp'), 'utf8');
            
            assert.ok(updatedContent.includes(protectedCode));
            assert.ok(updatedContent.includes('newButton'));
        });
    });
    
    describe('选项配置测试', () => {
        it('应该根据选项控制调试信息生成', async () => {
            // 启用调试信息
            const optionsWithDebug: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: true,
                outputPath: testOutputDir
            };
            
            const components: Component[] = [];
            await cppGenerator.generate(components, optionsWithDebug);
            
            const debugContent = fs.readFileSync(path.join(testOutputDir, 'main_window.cpp'), 'utf8');
            assert.ok(debugContent.includes('// DEBUG:'));
            
            // 禁用调试信息
            const optionsWithoutDebug: CodeGeneratorOptions = {
                enableProtectedAreas: true,
                generateDebugInfo: false,
                outputPath: testOutputDir
            };
            
            await cppGenerator.generate(components, optionsWithoutDebug);
            
            const noDebugContent = fs.readFileSync(path.join(testOutputDir, 'main_window.cpp'), 'utf8');
            assert.ok(!noDebugContent.includes('// DEBUG:'));
        });
    });
});