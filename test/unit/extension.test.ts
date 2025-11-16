import * as assert from 'assert';

// 创建简单的模拟对象
const mockWindow = {
  registerTreeDataProvider: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn()
};

const mockWorkspace = {
  onDidOpenTextDocument: jest.fn().mockReturnValue({
    dispose: jest.fn()
  }),
  findFiles: jest.fn().mockResolvedValue([]),
  // 简单的workspaceFolders实现
  workspaceFolders: undefined
};

const mockCommands = {
  registerCommand: jest.fn().mockReturnValue({
    dispose: jest.fn()
  }),
  executeCommand: jest.fn().mockResolvedValue(true)
};

const mockUri = {
  file: jest.fn().mockReturnValue({
    path: '',
    fsPath: '',
    toString: jest.fn().mockReturnValue(''),
    with: jest.fn().mockReturnThis()
  })
};

// 全局模拟vscode模块
jest.mock('vscode', () => ({
  window: mockWindow,
  workspace: mockWorkspace,
  commands: mockCommands,
  Uri: mockUri,
  ExtensionContext: jest.fn(),
  TreeDataProvider: jest.fn(),
  __esModule: true
}));

// 导入被测试模块
let activate: any;
let deactivate: any;
let vscode: any;

// 在测试前导入
const importModules = () => {
  jest.resetModules();
  vscode = require('vscode');
  const extensionModule = require('../../src/extension');
  activate = extensionModule.activate;
  deactivate = extensionModule.deactivate;
};

importModules();

describe('Extension Test', () => {
  let context: any;
  let timeoutCallback: any;

  beforeEach(() => {
    // 清除所有mock的调用历史
    jest.clearAllMocks();
    
    // 重新导入模块以获取干净的状态
    importModules();
    
    // 模拟ExtensionContext
    context = {
      subscriptions: [],
      extensionPath: '',
      storagePath: '',
      logPath: '',
      globalStoragePath: '',
      workspaceState: { 
        get: jest.fn(), 
        update: jest.fn() 
      },
      globalState: { 
        get: jest.fn(), 
        update: jest.fn() 
      },
    };

    // 保存setTimeout的回调以便手动触发
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      timeoutCallback = callback;
      return 0 as any;
    });
    
    // 重置workspaceFolders
    vscode.workspace.workspaceFolders = undefined;
  });

  afterEach(() => {
    // 恢复原始的setTimeout
    jest.restoreAllMocks();
  });

  it('应该激活扩展并注册所有组件', async () => {
    await activate(context);

    // 验证所有组件都被注册
    assert.strictEqual(mockWindow.registerTreeDataProvider.mock.calls.length, 2);
    assert.strictEqual(mockWindow.showInformationMessage.mock.calls[0]?.[0], 'HoneyGUI扩展已激活');
    assert.strictEqual(context.subscriptions.length > 0, true);
  });

  it('应该处理最近项目列表', async () => {
    // 模拟最近项目存储
    context.globalState.get.mockReturnValue(['/test/project1', '/test/project2']);

    await activate(context);

    // 验证最近项目被正确处理
    assert.strictEqual(context.globalState.get.mock.calls.length > 0, true);
  });

  it('应该处理没有工作区文件夹的情况', async () => {
    // 已经设置为undefined
    await activate(context);

    // 验证扩展仍然可以激活
    assert.strictEqual(mockWindow.registerTreeDataProvider.mock.calls.length, 2);
  });

  it('应该处理待激活项目', async () => {
    // 模拟待激活项目
    context.globalState.get.mockReturnValueOnce(undefined) // 最近项目
      .mockReturnValueOnce('/test/pending-project'); // 待激活项目

    await activate(context);

    // 执行setTimeout回调
    if (typeof timeoutCallback === 'function') {
      timeoutCallback();
    }

    // 验证待激活项目被处理
    assert.strictEqual(context.globalState.get.mock.calls.length > 1, true);
  });

  it('应该监听文件打开事件', async () => {
    await activate(context);

    // 验证文件打开事件被监听
    assert.strictEqual(mockWorkspace.onDidOpenTextDocument.mock.calls.length, 1);
  });

  it('应该正确停用扩展', async () => {
    await deactivate();

    // 验证停用消息被显示
    assert.strictEqual(mockWindow.showInformationMessage.mock.calls[0]?.[0], 'HoneyGUI扩展已停用');
  });

  it('应该处理错误情况', async () => {
    // 模拟一个会抛出错误的API调用
    mockWindow.registerTreeDataProvider.mockImplementation(() => {
      throw new Error('测试错误');
    });

    try {
      await activate(context);
    } catch (error) {
      // 忽略错误，因为我们只关心错误处理是否发生
    }

    // 验证错误被处理
    assert.strictEqual(mockWindow.showErrorMessage.mock.calls.length > 0, true);
  });
});