/**
 * HoneyGUI代码生成器使用示例
 */

import { generateHoneyGuiCode, Component } from './index';

// 示例：创建一个简单的GUI设计
const exampleComponents: Component[] = [
  {
    id: 'mainView',
    type: 'hg_view',
    name: '主视图',
    position: { x: 0, y: 0, width: 480, height: 272 },
    parent: null,
    children: ['titleLabel', 'startButton'],
    style: { backgroundColor: '#000000' },
    visible: true
  },
  {
    id: 'titleLabel',
    type: 'hg_label',
    name: '标题标签',
    position: { x: 100, y: 50, width: 280, height: 40 },
    parent: 'mainView',
    data: { text: 'Welcome to HoneyGUI', fontSize: 24 },
    style: { color: '#FFFFFF' },
    visible: true
  },
  {
    id: 'startButton',
    type: 'hg_button',
    name: '启动按钮',
    position: { x: 150, y: 120, width: 180, height: 60 },
    parent: 'mainView',
    data: { text: 'Start' },
    style: { backgroundColor: '#007ACC' },
    events: { onClick: 'on_start_button_click' },
    visible: true
  }
];

// 生成代码
async function runExample() {
  const result = await generateHoneyGuiCode(exampleComponents, {
    outputDir: './output',
    projectName: 'MyHoneyGuiApp',
    enableProtectedAreas: true
  });

  if (result.success) {
    console.log('代码生成成功！');
    console.log('生成的文件：');
    result.files.forEach(file => console.log(`  - ${file}`));
  } else {
    console.error('代码生成失败：');
    result.errors?.forEach(err => console.error(`  - ${err}`));
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runExample().catch(console.error);
}

export { exampleComponents, runExample };
