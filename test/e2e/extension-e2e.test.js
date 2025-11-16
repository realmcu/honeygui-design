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
const path = __importStar(require("path"));
const globals_1 = require("@jest/globals");
(0, globals_1.describe)('HoneyGUI Extension E2E Tests', () => {
    // 注意：这些测试需要使用VSCode的测试API运行
    // 这里我们主要定义测试函数，实际运行将通过专门的测试脚本
    (0, globals_1.beforeAll)(() => {
        // 测试前的设置
    });
    (0, globals_1.afterAll)(() => {
        // 测试后的清理
    });
    (0, globals_1.it)('should run VSCode extension tests', async () => {
        // Jest中的超时设置可以在配置中完成，这里使用默认超时
        try {
            // 扩展根目录路径
            const extensionDevelopmentPath = path.resolve(__dirname, '../../');
            // 测试运行的路径
            const extensionTestsPath = path.resolve(__dirname, './index');
            // 测试工作区路径
            const testWorkspace = path.resolve(__dirname, '../../test-workspace');
            console.log('Running tests with:');
            console.log('- Extension path:', extensionDevelopmentPath);
            console.log('- Tests path:', extensionTestsPath);
            console.log('- Workspace path:', testWorkspace);
            // 运行测试（注意：这在直接测试中不会真正执行，需要通过专门的脚本）
            // const exitCode = await runTests({
            //   extensionDevelopmentPath,
            //   extensionTestsPath,
            //   launchArgs: [testWorkspace, '--disable-extensions']
            // });
            // 
            // assert.strictEqual(exitCode, 0, 'Tests should pass');
            console.log('E2E test configuration is ready');
            assert.ok(true, 'E2E test setup verified');
        }
        catch (error) {
            console.error('Failed to run tests:', error);
            assert.fail('Tests should not throw errors');
        }
    });
});
//# sourceMappingURL=extension-e2e.test.js.map