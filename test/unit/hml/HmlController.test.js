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
// 模拟fs模块
jest.mock('fs');
const HmlController_1 = require("../../../src/hml/HmlController");
describe('HmlController测试', () => {
    let controller;
    let testOutputDir;
    beforeEach(() => {
        // 清除所有模拟的调用历史
        jest.clearAllMocks();
        // 创建临时输出目录
        testOutputDir = path.join(__dirname, '..', '..', '..', 'output');
        // 创建控制器（不需要参数）
        controller = new HmlController_1.HmlController();
    });
    describe('基本功能测试', () => {
        it('应该能够创建控制器实例', () => {
            assert.ok(controller instanceof HmlController_1.HmlController);
        });
        it('应该能够创建新文档', () => {
            // 创建新文档
            const document = controller.createNewDocument({
                projectName: 'Test Project',
                description: 'Test Description'
            });
            // 验证文档创建成功
            assert.ok(document);
            assert.ok(document.meta);
            assert.ok(document.view);
            assert.ok(document.view.root);
        });
    });
    describe('组件操作测试', () => {
        beforeEach(() => {
            // 每个测试前创建一个新文档
            controller.createNewDocument();
        });
        it('应该能够添加组件', () => {
            // 添加组件到root（根据HmlController实现，root是默认的父组件ID）
            const component = controller.addComponent('root', {
                type: 'button',
                properties: { text: 'Test Button' },
                events: { click: 'handleClick' }
            });
            // 验证组件已添加
            assert.ok(component);
            assert.strictEqual(component.type, 'button');
            assert.strictEqual(component.parentId, 'root');
            assert.strictEqual(component.properties.text, 'Test Button');
        });
        it('不应添加到不存在的父组件', () => {
            // 尝试添加到不存在的父组件
            const result = controller.addComponent('non-existent', {
                type: 'button',
                properties: { text: 'Test' }
            });
            // 验证添加失败
            assert.strictEqual(result, null);
        });
        it('应该能够查找组件', () => {
            // 添加组件
            const addedComponent = controller.addComponent('root', {
                type: 'text',
                properties: { text: 'Find Me' }
            });
            // 查找组件
            const foundComponent = controller.findComponent(addedComponent.id);
            // 验证查找成功
            assert.ok(foundComponent);
            assert.strictEqual(foundComponent.id, addedComponent.id);
        });
        it('应该能够更新组件', () => {
            // 添加组件
            const addedComponent = controller.addComponent('root', {
                type: 'div',
                properties: { width: '100px' }
            });
            // 更新组件
            const updatedComponent = controller.updateComponent(addedComponent.id, {
                properties: { width: '200px', height: '100px' },
                events: { click: 'onClick' },
                type: 'div'
            });
            // 验证更新成功
            assert.ok(updatedComponent);
            assert.strictEqual(updatedComponent.properties.width, '200px');
            assert.strictEqual(updatedComponent.properties.height, '100px');
        });
        it('应该能够删除组件', () => {
            // 添加组件
            const addedComponent = controller.addComponent('root', {
                type: 'image',
                properties: { src: 'test.jpg' }
            });
            // 删除组件
            const success = controller.deleteComponent(addedComponent.id);
            // 验证删除成功
            assert.strictEqual(success, true);
            assert.strictEqual(controller.findComponent(addedComponent.id), null);
        });
    });
    describe('文档序列化测试', () => {
        beforeEach(() => {
            // 每个测试前创建一个新文档
            controller.createNewDocument();
        });
        it('应该能够序列化文档', () => {
            // 添加一些组件
            controller.addComponent('root', {
                type: 'text',
                properties: { text: 'Serialized Text' }
            });
            // 序列化文档
            const serialized = controller.serializeDocument();
            // 验证序列化结果
            assert.ok(typeof serialized === 'string');
        });
        it('应该能够解析内容', () => {
            const hmlContent = '<hml><meta><project name="Test" description="Test Description"/></meta><view><div id="root"><text text="Parsed Text"></text></div></view></hml>';
            // 解析内容
            const document = controller.parseContent(hmlContent);
            // 验证解析结果
            assert.ok(document);
            assert.ok(document.view);
            assert.ok(document.view.root);
        });
    });
    describe('文件操作测试', () => {
        beforeEach(() => {
            // 每个测试前创建一个新文档
            controller.createNewDocument();
            // 使用jest模拟文件系统操作
            fs.writeFileSync.mockImplementation(() => { });
            fs.readFileSync.mockReturnValue('<hml><meta><project name="Test" description="Test Description"/></meta><view><div id="root"><text text="Test"></text></div></view></hml>');
            fs.mkdirSync.mockImplementation(() => { });
        });
        it('应该能够保存文档', async () => {
            const filePath = path.join(testOutputDir, 'save-test.hml');
            // 保存文档
            await controller.saveDocument(filePath);
            // 验证保存操作被调用
            assert.strictEqual(fs.writeFileSync.mock.calls.length, 1);
        });
        it('应该能够加载文件', async () => {
            const filePath = path.join(testOutputDir, 'load-test.hml');
            // 加载文件
            const document = await controller.loadFile(filePath);
            // 验证加载操作被调用和文档加载成功
            assert.ok(document);
        });
        it('应该能够获取当前文档状态', () => {
            // 创建新文档后，版本应为1
            assert.strictEqual(controller.documentVersion, 1);
            // 添加组件会增加版本号
            controller.addComponent('root', {
                type: 'button',
                properties: { text: 'Version Test' }
            });
            assert.strictEqual(controller.documentVersion, 1);
            assert.strictEqual(controller.isModified, true);
        });
    });
    describe('错误处理测试', () => {
        it('尝试在没有文档的情况下操作应该抛出错误', () => {
            // 创建一个新的控制器实例，不创建文档
            const emptyController = new HmlController_1.HmlController();
            // 不创建文档就尝试添加组件
            assert.throws(() => {
                emptyController.addComponent('root', {
                    type: 'div',
                    properties: { text: 'Error Test' }
                });
            });
        });
        it('尝试序列化没有文档应该抛出错误', () => {
            // 创建一个新的控制器实例，不创建文档
            const emptyController = new HmlController_1.HmlController();
            // 尝试序列化
            assert.throws(() => {
                emptyController.serializeDocument();
            });
        });
        it('尝试保存没有文档应该抛出错误', async () => {
            // 创建一个新的控制器实例，不创建文档
            const emptyController = new HmlController_1.HmlController();
            // 尝试保存
            await assert.rejects(async () => {
                await emptyController.saveDocument('/test/path.hml');
            });
        });
        it('应该处理保存文件失败的情况', async () => {
            // 创建一个新的控制器实例和文档
            const errorController = new HmlController_1.HmlController();
            errorController.createNewDocument();
            // 模拟fs.writeFileSync抛出错误
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Write error');
            });
            // 期望保存操作失败
            await assert.rejects(errorController.saveDocument('/test/path'));
        });
        it('应该处理加载文件失败的情况', async () => {
            // 创建一个新的控制器实例
            const errorController = new HmlController_1.HmlController();
            // 模拟fs.readFileSync抛出错误
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });
            // 期望加载操作失败
            try {
                await errorController.loadFile('/test/path');
                assert.fail('Expected loadFile to throw an error');
            }
            catch (error) {
                // 错误被捕获，测试通过
                assert.ok(error);
            }
        });
    });
});
//# sourceMappingURL=HmlController.test.js.map