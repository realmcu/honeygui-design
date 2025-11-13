import * as assert from 'assert';
import { Designer } from '../../../src/designer/Designer';
import { HmlModel } from '../../../src/model/HmlModel';

describe('Designer', () => {
  let designer: Designer;
  
  beforeEach(() => {
    // 创建Designer实例进行测试
    designer = new Designer();
  });

  it('应该正确初始化设计器', () => {
    assert.ok(designer, '设计器实例应被正确创建');
    // 验证设计器的默认状态
    assert.strictEqual(designer.getGridSize(), 8, '默认网格大小应为8');
    assert.strictEqual(designer.isSnapToGridEnabled(), true, '默认应启用网格对齐');
  });

  it('应该能够添加组件到设计器', () => {
    const component = {
      id: 'button1',
      type: 'button',
      properties: { text: '测试按钮' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    };
    
    designer.addComponent(component);
    const components = designer.getComponents();
    
    assert.strictEqual(components.length, 1, '组件应被正确添加');
    assert.strictEqual(components[0].id, 'button1', '组件ID应匹配');
  });

  it('应该能够移除组件', () => {
    // 先添加一个组件
    const component = {
      id: 'button1',
      type: 'button',
      properties: { text: '测试按钮' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    };
    designer.addComponent(component);
    
    // 移除组件
    designer.removeComponent('button1');
    const components = designer.getComponents();
    
    assert.strictEqual(components.length, 0, '组件应被正确移除');
  });

  it('应该能够更新组件属性', () => {
    // 添加组件
    const component = {
      id: 'button1',
      type: 'button',
      properties: { text: '原始按钮' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    };
    designer.addComponent(component);
    
    // 更新属性
    designer.updateComponentProperties('button1', { text: '更新后的按钮' });
    const updatedComponent = designer.getComponentById('button1');
    
    assert.ok(updatedComponent, '应找到更新后的组件');
    assert.strictEqual(updatedComponent!.properties.text, '更新后的按钮', '组件属性应被正确更新');
  });

  it('应该能够更新组件位置', () => {
    // 添加组件
    const component = {
      id: 'button1',
      type: 'button',
      properties: { text: '测试按钮' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    };
    designer.addComponent(component);
    
    // 更新位置
    designer.updateComponentPosition('button1', 50, 60);
    const updatedComponent = designer.getComponentById('button1');
    
    assert.ok(updatedComponent, '应找到更新后的组件');
    assert.strictEqual(updatedComponent!.x, 50, 'X坐标应被正确更新');
    assert.strictEqual(updatedComponent!.y, 60, 'Y坐标应被正确更新');
  });

  it('应该能够更新组件大小', () => {
    // 添加组件
    const component = {
      id: 'button1',
      type: 'type: 'button',
      properties: { text: '测试按钮' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    };
    designer.addComponent(component);
    
    // 更新大小
    designer.updateComponentSize('button1', 150, 60);
    const updatedComponent = designer.getComponentById('button1');
    
    assert.ok(updatedComponent, '应找到更新后的组件');
    assert.strictEqual(updatedComponent!.width, 150, '宽度应被正确更新');
    assert.strictEqual(updatedComponent!.height, 60, '高度应被正确更新');
  });

  it('应该能够根据网格对齐组件', () => {
    // 设置网格大小
    designer.setGridSize(10);
    
    // 计算对齐后的坐标
    const alignedX = designer.snapToGrid(12); // 应为10
    const alignedY = designer.snapToGrid(23); // 应为20
    
    assert.strictEqual(alignedX, 10, 'X坐标应正确对齐到网格');
    assert.strictEqual(alignedY, 20, 'Y坐标应正确对齐到网格');
  });

  it('应该能够导出HML模型', () => {
    // 添加一些组件
    designer.addComponent({
      id: 'button1',
      type: 'button',
      properties: { text: '按钮1' },
      x: 10,
      y: 10,
      width: 100,
      height: 40
    });
    
    designer.addComponent({
      id: 'input1',
      type: 'input',
      properties: { placeholder: '输入框' },
      x: 10,
      y: 60,
      width: 200,
      height: 30
    });
    
    // 导出HML模型
    const model = designer.exportToHmlModel();
    
    assert.ok(model, '应成功导出HML模型');
    assert.strictEqual(model.components.length, 2, 'HML模型应包含所有组件');
  });

  it('应该能够从HML模型导入', () => {
    const model: HmlModel = {
      page: {
        id: 'TestPage',
        width: 360,
        height: 640
      },
      components: [
        {
          id: 'button1',
          type: 'button',
          properties: { text: '导入的按钮' },
          x: 20,
          y: 20,
          width: 120,
          height: 40,
          children: []
        }
      ]
    };
    
    // 从模型导入
    designer.importFromHmlModel(model);
    const components = designer.getComponents();
    
    assert.strictEqual(components.length, 1, '应成功导入组件');
    assert.strictEqual(components[0].type, 'button', '组件类型应匹配');
    assert.strictEqual(components[0].properties.text, '导入的按钮', '组件属性应匹配');
  });
});
