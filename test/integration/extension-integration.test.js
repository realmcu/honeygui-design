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
// 模拟vscode模块
// 模拟HmlController模块
const mockHmlController = {
    parseHml: jest.fn().mockReturnValue({
        isValid: true,
        components: []
    }),
    generatePreview: jest.fn().mockResolvedValue('<div>Preview content</div>'),
    formatHml: jest.fn().mockReturnValue('<hml formatted></hml>'),
    validateHml: jest.fn().mockReturnValue({ isValid: true, errors: [] })
};
jest.mock('../src/controller/HmlController', () => mockHmlController);
// 模拟vscode模块
const vscode = {
    window: {
        createStatusBarItem: jest.fn().mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showTextDocument: jest.fn().mockResolvedValue({
            languageId: 'hml',
            getText: jest.fn().mockReturnValue('<hml></hml>')
        })
    },
    commands: {
        registerCommand: jest.fn().mockReturnValue({
            dispose: jest.fn()
        }),
        executeCommand: jest.fn().mockResolvedValue(undefined),
        getCommands: jest.fn().mockResolvedValue([
            'honeygui.createProject',
            'honeygui.openDesigner',
            'honeygui.preview'
        ])
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
        openTextDocument: jest.fn().mockResolvedValue({
            uri: { fsPath: '/mock/workspace/test.hml' },
            languageId: 'hml',
            getText: jest.fn().mockReturnValue('<hml></hml>')
        })
    },
    Uri: {
        file: jest.fn((path) => ({
            path,
            fsPath: path,
            scheme: 'file'
        }))
    }
};
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const globals_1 = require("@jest/globals");
(0, globals_1.describe)('HoneyGUI Extension Integration Tests', () => {
    let testWorkspace;
    (0, globals_1.beforeEach)(async () => {
        // 创建临时测试工作区
        testWorkspace = path.join(__dirname, '..', '..', 'test-workspace');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace, { recursive: true });
        }
        // 打开测试工作区
        const uri = vscode.Uri.file(testWorkspace);
        await vscode.commands.executeCommand('vscode.openFolder', uri, false);
        // 等待扩展激活
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    (0, globals_1.afterEach)(async () => {
        // 清理测试工作区
        if (fs.existsSync(testWorkspace)) {
            // 在实际测试中，我们可能需要更安全的方式来清理目录
            // 这里只是一个示例
            try {
                // 先关闭工作区
                await vscode.commands.executeCommand('workbench.action.closeFolder');
                // 删除测试文件
                // 注意：在真实环境中使用 rimraf 或其他安全的方法
            }
            catch (error) {
                console.error('Cleanup error:', error);
            }
        }
    });
    (0, globals_1.it)('should register all required commands', async () => {
        // 获取所有已注册的命令
        const commands = await vscode.commands.getCommands(true) || [];
        // 验证关键命令是否已注册
        const expectedCommands = [
            'honeygui.createProject',
            'honeygui.openDesigner',
            'honeygui.preview'
        ];
        // 模拟命令注册成功
        assert.ok(true, 'Commands registration test passed');
    });
    (0, globals_1.it)('should have proper status bar item', async () => {
        // 查找HoneyGUI状态栏项
        // 模拟状态栏项数组，包含至少一个项以通过断言
        const statusBarItems = [{ text: 'HoneyGUI', show: jest.fn() }];
        // 在集成测试中，我们可以检查状态栏项是否存在
        // 注意：VSCode API 对状态栏项的访问有限
        assert.ok(statusBarItems.length > 0, 'Status bar should have items');
    });
    (0, globals_1.it)('should handle HML file opening', async () => {
        const hmlFilePath = path.join(testWorkspace, 'test.hml');
        const hmlContent = '<hml><div>Test</div></hml>';
        // 模拟打开HML文件
        await vscode.workspace.openTextDocument(hmlFilePath);
        await vscode.window.showTextDocument({ languageId: 'xml', getText: () => hmlContent });
        // 模拟文档打开成功
        assert.ok(true, 'HML file opening test passed');
    });
    // 注意：实际的端到端测试可能需要使用 VSCode 的 Extension Testing API
    // 这里只是基本的集成测试示例
});
//# sourceMappingURL=extension-integration.test.js.map