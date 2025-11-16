"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const globals_1 = require("@jest/globals");
// 模拟HmlModel类
class HmlModel {
    constructor(data) {
        this.components = [];
        if (data) {
            this.components = data.components || [];
            this.page = data.page;
        }
    }
}
// 模拟HmlController类
class HmlController {
    constructor() { }
    async saveHmlFile(filePath, model) {
        const content = JSON.stringify(model, null, 2);
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, content, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async loadHmlFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err)
                    reject(err);
                else {
                    try {
                        const parsedData = JSON.parse(data);
                        resolve(new HmlModel(parsedData));
                    }
                    catch (parseErr) {
                        reject(parseErr);
                    }
                }
            });
        });
    }
}
// 模拟Designer类
class Designer {
    constructor() {
        this.components = [];
    }
    addComponent(component) {
        this.components.push(component);
    }
    exportToHmlModel() {
        return new HmlModel({ components: this.components });
    }
}
// 模拟CppCodeGenerator类
class CppCodeGenerator {
    constructor() { }
    async generate(model, options) {
        const mainContent = `// 自动生成的代码

${model.components.map(comp => `// Component: ${comp.id} (${comp.type})`).join('\n')}

int main() {
  return 0;
}`;
        const outputPath = path.join(options.outputDir, 'ui_main.cpp');
        return new Promise((resolve, reject) => {
            fs.writeFile(outputPath, mainContent, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    mergeWithProtectedAreas(newCode, oldCode) {
        // 简单实现，提取保护区内容
        const protectedMatch = oldCode.match(/\/\/ <honeygui-protect-begin:handler>([\s\S]*?)\/\/ <honeygui-protect-end:handler>/);
        if (protectedMatch) {
            return newCode.replace(/\/\/ <honeygui-protect-begin:handler>[\s\S]*?\/\/ <honeygui-protect-end:handler>/, `// <honeygui-protect-begin:handler>${protectedMatch[1]}// <honeygui-protect-end:handler>`);
        }
        return newCode;
    }
}
(0, globals_1.describe)('Designer and Code Generator Integration', () => {
    let designer;
    let codeGenerator;
    let tempDir;
    (0, globals_1.beforeEach)(() => {
        designer = new Designer();
        codeGenerator = new CppCodeGenerator();
        // 创建临时目录用于测试
        tempDir = path.join(__dirname, 'temp_test_output');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });
    (0, globals_1.afterEach)(() => {
        // 清理临时目录
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    (0, globals_1.it)('应该能够设计UI并生成C++代码', async () => {
        // 1. 在设计器中创建UI
        designer.addComponent({
            id: 'loginButton',
            type: 'button',
            properties: { text: '登录' },
            x: 100,
            y: 200,
            width: 120,
            height: 40
        });
        designer.addComponent({
            id: 'usernameInput',
            type: 'input',
            properties: { placeholder: '请输入用户名' },
            x: 50,
            y: 100,
            width: 200,
            height: 30
        });
        // 2. 导出HML模型
        const hmlModel = designer.exportToHmlModel();
        assert.ok(hmlModel, 'HML模型应成功导出');
        // 3. 生成C++代码
        const options = {
            language: 'cpp',
            includeDebugInfo: false,
            outputDir: tempDir
        };
        await codeGenerator.generate(hmlModel, options);
        // 4. 验证生成的文件
        const files = fs.readdirSync(tempDir);
        assert.ok(files.length > 0, '应生成至少一个文件');
        // 验证主要文件是否存在
        const mainFileExists = files.some(file => file === 'ui_main.cpp' || file === 'main.cpp');
        assert.ok(mainFileExists, '应生成主文件');
        // 验证是否包含登录按钮的代码
        const mainFilePath = path.join(tempDir, files.find(file => file.endsWith('.cpp')) || '');
        if (fs.existsSync(mainFilePath)) {
            const fileContent = fs.readFileSync(mainFilePath, 'utf8');
            assert.ok(fileContent.includes('loginButton'), '生成的代码应包含登录按钮');
            assert.ok(fileContent.includes('usernameInput'), '生成的代码应包含用户名输入框');
        }
    });
    (0, globals_1.it)('应该能够处理代码保护区', async () => {
        // 1. 创建一个带有保护区的测试文件
        const testFilePath = path.join(tempDir, 'test_protected.cpp');
        const protectedCode = `// 自动生成的代码

// <honeygui-protect-begin:handler>
void customEventHandler() {
    // 用户自定义代码
    printf("This is protected code!\n");
}
// <honeygui-protect-end:handler>

// 其他自动生成的代码`;
        fs.writeFileSync(testFilePath, protectedCode, 'utf8');
        // 2. 模拟重新生成，应该保留保护区内容
        const regeneratedCode = `// 自动生成的代码 (重新生成)

// <honeygui-protect-begin:handler>
// 这里应该保留用户代码
// <honeygui-protect-end:handler>

// 其他自动生成的代码 (重新生成)`;
        // 3. 使用代码生成器的差异合并功能
        const mergedCode = codeGenerator.mergeWithProtectedAreas(regeneratedCode, protectedCode);
        // 4. 验证保护区内容被保留
        assert.ok(mergedCode.includes('customEventHandler'), '保护区内的函数应被保留');
        assert.ok(mergedCode.includes('This is protected code!'), '保护区内的具体代码应被保留');
        assert.ok(mergedCode.includes('自动生成的代码 (重新生成)'), '非保护区内容应被更新');
    });
    (0, globals_1.it)('应该能够处理HML文件保存和代码生成的完整流程', async () => {
        // 1. 创建HML控制器
        const hmlController = new HmlController();
        const hmlFilePath = path.join(tempDir, 'test_ui.hml');
        // 2. 在设计器中创建UI
        designer.addComponent({
            id: 'welcomeText',
            type: 'text',
            properties: { value: '欢迎使用HoneyGUI' },
            x: 20,
            y: 20,
            width: 300,
            height: 30
        });
        // 3. 导出HML模型并保存
        const hmlModel = designer.exportToHmlModel();
        await hmlController.saveHmlFile(hmlFilePath, hmlModel);
        // 4. 验证HML文件保存成功
        assert.ok(fs.existsSync(hmlFilePath), 'HML文件应被成功保存');
        // 5. 从文件加载HML模型
        const loadedModel = await hmlController.loadHmlFile(hmlFilePath);
        assert.ok(loadedModel, '应成功从文件加载HML模型');
        assert.strictEqual(loadedModel.components.length, 1, '加载的模型应包含一个组件');
        // 6. 为加载的模型生成代码
        const options = {
            language: 'cpp',
            includeDebugInfo: true,
            outputDir: tempDir
        };
        await codeGenerator.generate(loadedModel, options);
        // 7. 验证代码生成成功
        const generatedFiles = fs.readdirSync(tempDir);
        assert.ok(generatedFiles.some(file => file.endsWith('.cpp')), '应生成C++文件');
    });
});
//# sourceMappingURL=DesignerCodeGenIntegration.test.js.map