import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CreateProjectPanel } from '../../src/designer/CreateProjectPanel';

// 模拟fs模块
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// 模拟path模块
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('CreateProjectPanel', () => {
  let mockContext: any;
  let mockPanel: any;
  let mockWebview: any;
  let mockGlobalState: any;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 模拟全局状态
    mockGlobalState = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    
    // 模拟上下文
    mockContext = {
      extensionPath: '/mock/extension/path',
      subscriptions: [],
      globalState: mockGlobalState,
    };
    
    // 模拟Webview
    mockWebview = {
      asWebviewUri: jest.fn(uri => uri),
      postMessage: jest.fn().mockResolvedValue(true),
      onDidReceiveMessage: jest.fn(),
    };
    
    // 模拟面板
    mockPanel = {
      webview: mockWebview,
      onDidDispose: {
        then: jest.fn().mockReturnValue({
          dispose: jest.fn()
        })
      },
      dispose: jest.fn(),
    };
    
    // 模拟vscode.window
    vscode.window.createWebviewPanel = jest.fn().mockReturnValue(mockPanel);
    vscode.window.showOpenDialog = jest.fn().mockResolvedValue([{ fsPath: '/mock/project/path' }]);
    vscode.window.showInformationMessage = jest.fn();
    
    // 模拟vscode.commands
    vscode.commands.executeCommand = jest.fn().mockResolvedValue(undefined);
  });
  
  describe('createOrShow', () => {
    it('should create a new panel if no panel exists', () => {
      // 确保没有当前面板
      (CreateProjectPanel as any).currentPanel = undefined;
      
      // 调用方法
      CreateProjectPanel.createOrShow(mockContext);
      
      // 验证面板创建
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'createProject',
        'Create New Project',
        vscode.ViewColumn.One,
        expect.any(Object)
      );
      
      // 验证当前面板已设置
      expect((CreateProjectPanel as any).currentPanel).toBeDefined();
    });
    
    it('should reveal existing panel if panel already exists', () => {
      // 创建模拟面板
      const existingPanel = {
        reveal: jest.fn()
      };
      
      // 设置当前面板
      (CreateProjectPanel as any).currentPanel = existingPanel;
      
      // 调用方法
      CreateProjectPanel.createOrShow(mockContext);
      
      // 验证没有创建新面板
      expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
      
      // 验证面板已显示
      expect(existingPanel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
    });
  });
  
  describe('_selectProjectFolder', () => {
    it('should handle folder selection successfully', async () => {
      // 创建面板实例
      const panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 调用私有方法（通过访问私有属性）
      await (panel as any)._selectProjectFolder();
      
      // 验证showOpenDialog调用
      expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select project location'
      });
      
      // 验证postMessage调用
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'folderSelected',
        folderPath: '/mock/project/path'
      });
    });
    
    it('should handle folder selection cancellation', async () => {
      // 创建面板实例
      const panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 模拟取消选择
      vscode.window.showOpenDialog = jest.fn().mockResolvedValue(undefined);
      
      // 调用私有方法
      await (panel as any)._selectProjectFolder();
      
      // 验证没有发送消息
      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
    
    it('should handle folder selection errors', async () => {
      // 创建面板实例
      const panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 模拟错误
      const errorMessage = 'Selection error';
      vscode.window.showOpenDialog = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      // 调用私有方法
      await (panel as any)._selectProjectFolder();
      
      // 验证错误消息发送
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        text: 'Failed to select folder'
      });
    });
  });
  
  describe('_createProject', () => {
    let panel: any;
    
    beforeEach(() => {
      // 创建面板实例
      panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 模拟fs.existsSync返回false（项目路径不存在）
      (fs.existsSync as jest.Mock).mockReturnValue(false);
    });
    
    it('should create project with valid config', async () => {
      const projectConfig = {
        projectName: 'TestProject',
        saveLocation: '/mock/save/location',
        appId: 'com.example.testproject',
        resolution: '800X600',
        minSdk: 'API 4: Persim Wear V2.0.0',
        pixelMode: 'ARGB8888'
      };
      
      // 调用私有方法
      await panel._createProject(projectConfig);
      
      // 验证信息消息
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Creating project: TestProject...'
      );
      
      // 验证全局状态更新
      expect(mockGlobalState.update).toHaveBeenCalledWith(
        'pendingProjectActivation',
        expect.objectContaining({
          projectPath: '/mock/save/location/TestProject',
          projectName: 'TestProject'
        })
      );
      
      // 验证打开文件夹
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openFolder',
        expect.any(Object),
        false
      );
    });
    
    it('should validate required fields', async () => {
      const invalidConfig = {
        projectName: '', // 空项目名
        saveLocation: '/mock/save/location',
        appId: 'com.example.testproject'
      };
      
      // 调用私有方法
      await panel._createProject(invalidConfig);
      
      // 验证错误消息
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        text: 'All required fields must be filled'
      });
    });
    
    it('should handle existing project path', async () => {
      // 模拟fs.existsSync返回true（项目路径已存在）
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const projectConfig = {
        projectName: 'ExistingProject',
        saveLocation: '/mock/save/location',
        appId: 'com.example.existingproject'
      };
      
      // 调用私有方法
      await panel._createProject(projectConfig);
      
      // 验证错误消息
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        text: expect.stringContaining('Project directory already exists')
      });
    });
    
    it('should handle project creation errors', async () => {
      const projectConfig = {
        projectName: 'TestProject',
        saveLocation: '/mock/save/location',
        appId: 'com.example.testproject',
        resolution: '800X600',
        minSdk: 'API 4: Persim Wear V2.0.0',
        pixelMode: 'ARGB8888'
      };
      
      // 模拟错误
      const errorMessage = 'Creation error';
      panel._createProjectStructure = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      // 调用私有方法
      await panel._createProject(projectConfig);
      
      // 验证错误消息
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        text: expect.stringContaining(errorMessage)
      });
    });
  });
  
  describe('_createProjectStructure', () => {
    let panel: any;
    
    beforeEach(() => {
      // 创建面板实例
      panel = CreateProjectPanel.createOrShow(mockContext);
    });
    
    it('should create project directories and files', async () => {
      const projectPath = '/mock/project/path';
      const projectName = 'TestProject';
      const appId = 'com.example.testproject';
      const resolution = '800X600';
      const minSdk = 'API 4: Persim Wear V2.0.0';
      const pixelMode = 'ARGB8888';
      
      // 调用私有方法
      await panel._createProjectStructure(
        projectPath,
        projectName,
        appId,
        resolution,
        minSdk,
        pixelMode
      );
      
      // 验证目录创建
      expect(fs.mkdirSync).toHaveBeenCalledWith(projectPath, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/project/path/ui', { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/project/path/src', { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/project/path/assets', { recursive: true });
      
      // 验证文件创建
      expect(fs.writeFileSync).toHaveBeenCalledTimes(4); // hml, cpp, readme, project.json
    });
  });
  
  describe('dispose', () => {
    it('should clean up resources properly', () => {
      // 创建面板实例
      const panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 添加一些可释放资源
      const mockDisposable = { dispose: jest.fn() };
      (panel as any)._disposables = [mockDisposable];
      
      // 调用dispose
      panel.dispose();
      
      // 验证当前面板已清除
      expect((CreateProjectPanel as any).currentPanel).toBeUndefined();
      
      // 验证面板已释放
      expect(mockPanel.dispose).toHaveBeenCalled();
      
      // 验证资源已释放
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });
  });
  
  describe('_getNonce', () => {
    it('should generate a nonce with correct length', () => {
      // 创建面板实例
      const panel = CreateProjectPanel.createOrShow(mockContext);
      
      // 调用私有方法（使用类型断言绕过TypeScript检查）
      const nonce = (panel as any)._getNonce();
      
      // 验证nonce长度
      expect(nonce).toHaveLength(32);
      
      // 验证nonce仅包含预期字符
      expect(/^[A-Za-z0-9]+$/.test(nonce)).toBe(true);
    });
  });
});
