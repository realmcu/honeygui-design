import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { HmlController, Component } from '../../../src/hml';

describe('HmlController', () => {
    let controller: HmlController;
    let testFilePath: string;
    
    beforeEach(() => {
        controller = new HmlController();
        testFilePath = path.join(__dirname, 'test.hml');
        
        // 清理测试文件
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });
    
    afterEach(() => {
        // 清理测试文件
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });
    
    describe('基本功能测试', () => {
        it('应该正确创建控制器实例', () => {
            assert.ok(controller instanceof HmlController);
        });
        
        it('应该能够添加组件', () => {
            const component = new Component('button', {
                id: 'test-btn',
                text: 'Test Button',
                x: 100,
                y: 100,
                width: 120,
                height: 40
            });
            
            controller.addComponent(component);
            const components = controller.getComponents();
            
            assert.strictEqual(components.length, 1);
            assert.strictEqual(components[0].id, 'test-btn');
        });
        
        it('应该能够删除组件', () => {
            const component = new Component('button', {
                id: 'test-btn',
                text: 'Test Button',
                x: 100,
                y: 100,
                width: 120,
                height: 40
            });
            
            controller.addComponent(component);
            controller.removeComponent('test-btn');
            const components = controller.getComponents();
            
            assert.strictEqual(components.length, 0);
        });
        
        it('应该能够更新组件属性', () => {
            const component = new Component('button', {
                id: 'test-btn',
                text: 'Test Button',
                x: 100,
                y: 100,
                width: 120,
                height: 40
            });
            
            controller.addComponent(component);
            controller.updateComponent('test-btn', { text: 'Updated Button', x: 150 });
            
            const updatedComponent = controller.getComponentById('test-btn');
            assert.strictEqual(updatedComponent?.properties.text, 'Updated Button');
            assert.strictEqual(updatedComponent?.properties.x, 150);
        });
    });
    
    describe('HML导入/导出测试', () => {
        it('应该能够正确导出为HML字符串', () => {
            const component = new Component('button', {
                id: 'test-btn',
                text: 'Test Button',
                x: 100,
                y: 100,
                width: 120,
                height: 40
            });
            
            controller.addComponent(component);
            const hmlContent = controller.exportToHml();
            
            assert.ok(hmlContent.includes('<button'));
            assert.ok(hmlContent.includes('id="test-btn"'));
            assert.ok(hmlContent.includes('text="Test Button"'));
        });
        
        it('应该能够从HML字符串导入', () => {
            const hmlContent = `
                <hml>
                    <button id="import-btn" text="Imported Button" x="200" y="200" width="150" height="50"/>
                    <panel id="import-panel" x="50" y="50" width="300" height="200"/>
                </hml>
            `;
            
            controller.importFromHml(hmlContent);
            const components = controller.getComponents();
            
            assert.strictEqual(components.length, 2);
            assert.strictEqual(components[0].type, 'button');
            assert.strictEqual(components[1].type, 'panel');
        });
        
        it('应该能够处理无效的HML', () => {
            const invalidHmlContent = '<hml><button id="test"'; // 不完整的HML
            
            assert.throws(() => {
                controller.importFromHml(invalidHmlContent);
            });
        });
    });
    
    describe('文件操作测试', () => {
        it('应该能够保存到文件', async () => {
            const component = new Component('button', {
                id: 'save-btn',
                text: 'Save Button',
                x: 100,
                y: 100,
                width: 120,
                height: 40
            });
            
            controller.addComponent(component);
            await controller.saveToFile(testFilePath);
            
            assert.ok(fs.existsSync(testFilePath));
            const fileContent = fs.readFileSync(testFilePath, 'utf8');
            assert.ok(fileContent.includes('id="save-btn"'));
        });
        
        it('应该能够从文件加载', async () => {
            const hmlContent = `
                <hml>
                    <button id="load-btn" text="Load Button" x="300" y="300" width="100" height="30"/>
                </hml>
            `;
            
            fs.writeFileSync(testFilePath, hmlContent, 'utf8');
            await controller.loadFromFile(testFilePath);
            
            const components = controller.getComponents();
            assert.strictEqual(components.length, 1);
            assert.strictEqual(components[0].id, 'load-btn');
        });
        
        it('应该能够处理不存在的文件', async () => {
            const nonExistentPath = path.join(__dirname, 'non-existent.hml');
            
            await assert.rejects(async () => {
                await controller.loadFromFile(nonExistentPath);
            });
        });
    });
    
    describe('复杂场景测试', () => {
        it('应该能够处理嵌套组件', () => {
            const panel = new Component('panel', {
                id: 'parent-panel',
                x: 50,
                y: 50,
                width: 300,
                height: 200
            });
            
            const button = new Component('button', {
                id: 'child-button',
                text: 'Child Button',
                x: 20,
                y: 20,
                width: 100,
                height: 30
            });
            
            controller.addComponent(panel);
            controller.addComponent(button);
            
            const components = controller.getComponents();
            assert.strictEqual(components.length, 2);
            
            const hmlContent = controller.exportToHml();
            assert.ok(hmlContent.includes('<panel'));
            assert.ok(hmlContent.includes('<button'));
        });
        
        it('应该能够处理重复的ID', () => {
            const component1 = new Component('button', {
                id: 'duplicate-id',
                text: 'Button 1',
                x: 100,
                y: 100,
                width: 100,
                height: 30
            });
            
            const component2 = new Component('button', {
                id: 'duplicate-id',
                text: 'Button 2',
                x: 200,
                y: 200,
                width: 100,
                height: 30
            });
            
            controller.addComponent(component1);
            controller.addComponent(component2);
            
            const components = controller.getComponents();
            // 应该只保留最后添加的组件
            assert.strictEqual(components.length, 1);
            assert.strictEqual(components[0].properties.text, 'Button 2');
        });
    });
});