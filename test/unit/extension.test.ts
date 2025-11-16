import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn().mockReturnValue({
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn()
    }),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    activeTextEditor: null,
    onDidChangeVisibleTextEditors: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  },
  workspace: {
    onDidOpenTextDocument: jest.fn().mockReturnValue({
      dispose: jest.fn()
    }),
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidChange: jest.fn().mockReturnValue({
        dispose: jest.fn()
      }),
      dispose: jest.fn()
    }),
    workspaceFolders: [],
    findFiles: jest.fn()
  },
  commands: {
    registerCommand: jest.fn().mockReturnValue({
      dispose: jest.fn()
    }),
    executeCommand: jest.fn()
  },
  StatusBarAlignment: {
    Left: 0
  },
  ProgressLocation: {
    Notification: 0
  },
  WebviewViewResolveContext: {},
  CancellationToken: {},
  TreeItem: jest.fn().mockImplementation((label, collapsibleState) => ({
    label,
    collapsibleState,
    command: null
  })),
  TreeItemCollapsibleState: {
    None: 0
  }
}));

// Mock other dependencies
jest.mock('../../src/designer/DesignerPanel', () => ({
  DesignerPanel: {
    createOrShow: jest.fn()
  }
}));

jest.mock('../../src/preview/PreviewService', () => ({
  PreviewService: jest.fn().mockImplementation(() => ({
    registerCommands: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('../../src/designer/CreateProjectPanel');

describe('Extension API', () => {
  let mockContext: any;
  
  beforeEach(() => {
    // 清除所有模拟的调用历史
    jest.clearAllMocks();
    
    // 创建模拟的上下文对象
    mockContext = {
      extensionUri: { fsPath: '/mock/path' },
      subscriptions: [],
      globalState: {
        get: jest.fn().mockReturnValue(undefined),
        update: jest.fn()
      }
    };
    
    // 添加push方法到subscriptions数组
    mockContext.subscriptions.push = jest.fn((item) => {
      if (Array.isArray(mockContext.subscriptions)) {
        mockContext.subscriptions.push = Array.prototype.push;
        mockContext.subscriptions.push(item);
      }
    });
  });
  
  describe('activate function', () => {
    it('should activate the extension and register all components', async () => {
      // Act
      await activate(mockContext);
      
      // Assert
      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledTimes(2);
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledTimes(2);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('HoneyGUI扩展已激活');
      
      // 验证订阅了至少一个命令
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
    
    it('should handle recent projects functionality', () => {
      // 设置全局状态返回一些最近项目
      mockContext.globalState.get = jest.fn().mockReturnValue(['/project1', '/project2']);
      
      // Act
      activate(mockContext);
      
      // 验证获取了最近项目
      expect(mockContext.globalState.get).toHaveBeenCalledWith('honeygui.recentProjects');
    });
    
    it('should handle pending project activation when available', async () => {
      // 设置待激活项目
      const pendingProject = {
        projectPath: '/mock/project',
        projectName: 'Test Project',
        timestamp: Date.now() - 60000 // 1分钟前创建，在5分钟超时内
      };
      mockContext.globalState.get = jest.fn().mockImplementation((key) => {
        if (key === 'pendingProjectActivation') return pendingProject;
        return undefined;
      });
      
      // 设置工作区文件夹
      (vscode.workspace.workspaceFolders as jest.Mock) = [
        { uri: { fsPath: '/mock/project' } }
      ];
      
      // 设置查找文件结果
      (vscode.workspace.findFiles as jest.Mock) = jest.fn().mockResolvedValue([
        { fsPath: '/mock/project/main.hml' }
      ]);
      
      // Act
      await activate(mockContext);
      
      // 给setTimeout一些时间执行
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 验证调用了项目激活相关功能
      expect(vscode.workspace.findFiles).toHaveBeenCalled();
    });
    
    it('should handle HML file opening events', () => {
      // Act
      activate(mockContext);
      
      // 验证注册了文件打开事件监听器
      expect(vscode.workspace.onDidOpenTextDocument).toHaveBeenCalled();
    });
  });
  
  describe('deactivate function', () => {
    it('should deactivate the extension properly', () => {
      // Act
      deactivate();
      
      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('HoneyGUI扩展已停用');
    });
  });
  
  describe('Error handling', () => {
    it('should handle errors gracefully during activation', async () => {
      // 模拟在激活过程中抛出错误
      const errorMock = new Error('Activation error');
      (vscode.window.registerWebviewViewProvider as jest.Mock) = jest.fn().mockImplementation(() => {
        throw errorMock;
      });
      
      // Act & Assert
      await expect(activate(mockContext)).rejects.toThrow('Activation error');
    });
  });
});
