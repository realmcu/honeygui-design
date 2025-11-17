import * as assert from 'assert';
import * as path from 'path';

// 模拟fs模块
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
  __esModule: true
}));

const fs = require('fs');
import { CppCodeGenerator, CCppCodeGenerator } from '../../../src/codegen/cpp/CppCodeGenerator';
import { CodeGeneratorOptions } from '../../../src/codegen/CodeGenerator';

// Mock Component class for testing
class MockComponent {
  id: string;
  type: string;
  properties: Record<string, any>;
  children: MockComponent[];
  
  constructor(type: string, properties: Record<string, any> = {}) {
    this.id = properties.id || Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.properties = properties;
    this.children = [];
  }
  
  addChild(child: MockComponent): void {
    this.children.push(child);
  }
  
  removeChild(child: MockComponent): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }
}

// Mock DesignerModel for testing
class MockDesignerModel {
  components: { [key: string]: any } = {};
  
  constructor() {
    // 设置一个默认的主窗口组件
    this.components['mainWindow'] = {
      id: 'mainWindow',
      type: 'window',
      properties: {
        width: 800,
        height: 600,
        title: 'Test Window'
      },
      children: []
    };
  }
  
  getComponent(id: string) {
    return this.components[id];
  }
  
  setComponents(components: any[]) {
    this.components['mainWindow'].children = components;
  }
}

describe('CppCodeGenerator测试', () => {
    let cppGenerator: CppCodeGenerator;
    let cGenerator: CCppCodeGenerator;
    let testOutputDir: string;

    beforeEach(() => {
        // 清除所有模拟的调用历史
        jest.clearAllMocks();
        
        // 创建临时输出目录
        testOutputDir = path.join(__dirname, '..', '..', '..', 'output');
        
        // 创建模型和生成器
        const model = new MockDesignerModel();
        const baseOptions: CodeGeneratorOptions = {
            outputDir: testOutputDir,
            projectName: 'test-project',
            enableProtectedAreas: true,
            generateDebugInfo: false
        };
        
        // 使用as any来绕过类型检查
        cppGenerator = new CppCodeGenerator(model as any, baseOptions);
        cGenerator = new CCppCodeGenerator(model as any, baseOptions);
    })

    describe('基本功能测试', () => {
        it('应该能够生成C++主窗口代码', () => {
            // 创建按钮组件
            const button1 = new MockComponent('button', { text: 'Button 1', id: 'btn1' });
            const button2 = new MockComponent('button', { text: 'Button 2', id: 'btn2' });
            
            // 设置组件到模型
            (cppGenerator as any).model.setComponents([button1, button2]);
            
            // 临时替换fs方法避免实际文件操作
            const originalWriteFileSync = fs.writeFileSync;
            const originalMkdirSync = fs.mkdirSync;
            let writeCalled = false;
            
            try {
                (fs as any).writeFileSync = () => { writeCalled = true; };
                (fs as any).mkdirSync = () => {};
                
                // 生成代码
                const result = cppGenerator.generate();
                
                // 验证结果
                assert.ok(result, '代码生成结果不应为null');
                assert.ok(writeCalled, '应该调用了writeFileSync');
            } finally {
                // 恢复原始方法
                (fs as any).writeFileSync = originalWriteFileSync;
                (fs as any).mkdirSync = originalMkdirSync;
            }
        });

        it('应该能够生成C应用程序代码', () => {
            // 临时替换fs方法避免实际文件操作
            const originalWriteFileSync = fs.writeFileSync;
            const originalMkdirSync = fs.mkdirSync;
            let writeCalled = false;
            
            try {
                (fs as any).writeFileSync = () => { writeCalled = true; };
                (fs as any).mkdirSync = () => {};
                
                // 生成代码
                const cResult = cGenerator.generate();
                
                assert.ok(cResult, 'C代码生成结果不应为null');
                assert.ok(writeCalled, '应该调用了writeFileSync');
            } finally {
                // 恢复原始方法
                (fs as any).writeFileSync = originalWriteFileSync;
                (fs as any).mkdirSync = originalMkdirSync;
            }
        });
    });

    describe('代码保护区测试', () => {
        it('应该能够保留代码保护区内容', () => {
            // 临时替换fs方法避免实际文件操作
            const originalReadFileSync = fs.readFileSync;
            const originalWriteFileSync = fs.writeFileSync;
            let writeCalled = false;
            let readCalled = false;
            
            try {
                (fs as any).readFileSync = () => {
                    readCalled = true;
                    return `// 初始内容
// [START PROTECTED AREA]
// 保护区代码
// [END PROTECTED AREA]`;
                };
                (fs as any).writeFileSync = () => { writeCalled = true; };
                
                // 模拟生成代码
                cppGenerator.generate();
                
                assert.ok(writeCalled, '应该调用了writeFileSync');
                assert.ok(readCalled, '应该调用了readFileSync');
            } finally {
                // 恢复原始方法
                (fs as any).readFileSync = originalReadFileSync;
                (fs as any).writeFileSync = originalWriteFileSync;
            }
        });
    });

    describe('选项配置测试', () => {
        it('应该根据选项控制调试信息生成', () => {
            // 临时替换fs方法避免实际文件操作
            const originalWriteFileSync = fs.writeFileSync;
            let writeCalled = false;
            
            try {
                (fs as any).writeFileSync = () => { writeCalled = true; };
                
                // 验证设置了选项
                (cppGenerator as any).options.generateDebugInfo = true;
                cppGenerator.generate();
                
                assert.ok(writeCalled, '应该调用了writeFileSync');
            } finally {
                // 恢复原始方法
                (fs as any).writeFileSync = originalWriteFileSync;
            }
        });
    });
    
    describe('错误处理测试', () => {
        it('应该正确处理无效的项目配置', () => {
            // 创建无效的模型
            const invalidModel = new MockDesignerModel();
            invalidModel.components = {}; // 清空所有组件

            // 创建选项
            const options: CodeGeneratorOptions = {
                outputDir: testOutputDir,
                projectName: 'test-project',
                enableProtectedAreas: true,
                generateDebugInfo: true
            };

            // 生成代码并验证异常被抛出
            try {
                const invalidGenerator = new CppCodeGenerator(invalidModel as any, options);
                invalidGenerator.generate();
                assert.fail('应该抛出异常但没有抛出');
            } catch (error) {
                assert.strictEqual(error instanceof Error, true);
            }
        });
        
        it('应该正确处理文件写入失败的情况', () => {
            // 模拟文件写入失败
            const originalWriteFileSync = fs.writeFileSync;
            
            try {
                (fs as any).writeFileSync = () => {
                    throw new Error('File write failed');
                };
                
                // 生成代码并验证异常被抛出
                try {
                    cppGenerator.generate();
                    assert.fail('应该抛出异常但没有抛出');
                } catch (error) {
                    const err = error as Error;
                    assert.strictEqual(err instanceof Error, true);
                    assert.strictEqual(err.message, 'File write failed');
                }
            } finally {
                // 恢复原始方法
                (fs as any).writeFileSync = originalWriteFileSync;
            }
        });
    });
});
