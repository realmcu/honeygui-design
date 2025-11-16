import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { describe, it, beforeEach, afterEach } from '@jest/globals';

describe('HoneyGUI Extension Integration Tests', () => {
  let testWorkspace: string;
  
  beforeEach(async () => {
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
  
  afterEach(async () => {
    // 清理测试工作区
    if (fs.existsSync(testWorkspace)) {
      // 在实际测试中，我们可能需要更安全的方式来清理目录
      // 这里只是一个示例
      try {
        // 先关闭工作区
        await vscode.commands.executeCommand('workbench.action.closeFolder');
        // 删除测试文件
        // 注意：在真实环境中使用 rimraf 或其他安全的方法
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  });
  
  it('should register all required commands', async () => {
    // 获取所有已注册的命令
    const commands = await vscode.commands.getCommands(true);
    
    // 验证关键命令是否已注册
    const expectedCommands = [
      'honeygui.openWelcome',
      'honeygui.createProject',
      'honeygui.openDesigner',
      'honeygui.previewHml'
    ];
    
    expectedCommands.forEach(command => {
      assert.ok(commands.includes(command), `Command ${command} should be registered`);
    });
  });
  
  it('should have proper status bar item', async () => {
    // 查找HoneyGUI状态栏项
    const statusBarItems = vscode.window.statusBarItems;
    
    // 在集成测试中，我们可以检查状态栏项是否存在
    // 注意：VSCode API 对状态栏项的访问有限
    assert.ok(statusBarItems.length > 0, 'Status bar should have items');
  });
  
  it('should handle HML file opening', async () => {
    // 创建临时HML文件
    const hmlContent = `<hml page id="test" width="800" height="600">
  <container id="root" layout="column">
    <text id="title" value="Test HML"/>
  </container>
</hml>`;
    
    const hmlFilePath = path.join(testWorkspace, 'test.hml');
    fs.writeFileSync(hmlFilePath, hmlContent, 'utf8');
    
    // 打开HML文件
    const document = await vscode.workspace.openTextDocument(hmlFilePath);
    await vscode.window.showTextDocument(document);
    
    // 验证文档是否正确打开
    assert.strictEqual(document.languageId, 'xml', 'HML file should be opened as XML');
    assert.strictEqual(document.getText(), hmlContent, 'Document content should match');
  });
  
  // 注意：实际的端到端测试可能需要使用 VSCode 的 Extension Testing API
  // 这里只是基本的集成测试示例
});
