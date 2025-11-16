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
const path = __importStar(require("path"));
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    try {
        // 获取扩展根目录
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        // 获取编译后的测试入口文件路径
        const extensionTestsPath = path.resolve(__dirname, '../../out/test/e2e/index');
        // 创建临时测试工作区
        const testWorkspace = path.resolve(__dirname, '../../test-workspace');
        // 下载VSCode并运行测试
        const exitCode = await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions',
                '--disable-gpu',
                '--locale=en'
            ]
        });
        // 根据退出码决定是否成功
        if (exitCode !== 0) {
            console.error(`Tests failed with exit code: ${exitCode}`);
            process.exit(exitCode);
        }
        console.log('All tests passed successfully!');
    }
    catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}
// 运行测试
main();
//# sourceMappingURL=run-tests.js.map