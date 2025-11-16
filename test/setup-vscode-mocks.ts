// VSCode API模拟设置文件
// 用于在测试环境中模拟VSCode扩展API

// 创建模拟的VSCode对象
const vscodeMock = {
  window: {
    showInformationMessage: jest.fn().mockResolvedValue('OK'),
    showErrorMessage: jest.fn().mockResolvedValue('OK'),
    createWebviewPanel: jest.fn().mockReturnValue({
      reveal: jest.fn(),
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn().mockReturnValue({
          dispose: jest.fn()
        }),
        postMessage: jest.fn().mockResolvedValue(true)
      },
      dispose: jest.fn()
    })
  },
  commands: {
    registerCommand: jest.fn().mockReturnValue({
      dispose: jest.fn()
    }),
    executeCommand: jest.fn()
  },
  workspace: {
    workspaceFolders: [{
      uri: { fsPath: '/mock/workspace' },
      name: 'mock-workspace'
    }],
    onDidChangeConfiguration: jest.fn().mockReturnValue({
      dispose: jest.fn()
    }),
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(null)
    })
  },
  Uri: {
    file: jest.fn((path: string) => ({ path, fsPath: path, scheme: 'file' })),
    parse: jest.fn()
  },
  ViewColumn: { One: 1, Two: 2, Three: 3, Active: -1 },
  ExtensionContext: {
    subscriptions: [],
    extensionUri: { fsPath: '/mock/extension' },
    storageUri: { fsPath: '/mock/storage' },
    globalStorageUri: { fsPath: '/mock/global-storage' },
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn()
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn()
    },
    asAbsolutePath: jest.fn((relativePath: string) => `/mock/extension/${relativePath}`)
  }
};

// 将模拟对象添加到全局对象
Object.defineProperty(global, 'vscode', {
  value: vscodeMock,
  writable: true
});

// 导出模拟对象以供测试中使用
export const mockVSCode = vscodeMock;

// 模拟Node.js的fs/path等模块
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    readdir: jest.fn().mockResolvedValue([])
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('')
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  })
}));

// 设置测试环境
beforeAll(() => {
  // 可以在这里添加全局测试设置
});

afterAll(() => {
  // 清理全局模拟
  jest.clearAllMocks();
});

beforeEach(() => {
  // 每个测试前重置模拟状态
  jest.resetAllMocks();
});

// 添加常用的测试辅助函数
global.testHelpers = {
  mockVsCodeCommand: (commandId: string, mockImplementation: any) => {
    const mockCommand = jest.fn().mockImplementation(mockImplementation);
    vscodeMock.commands.registerCommand.mockImplementation((id, callback) => {
      if (id === commandId) {
        return {
          callback: mockImplementation,
          dispose: jest.fn()
        };
      }
      return {
        dispose: jest.fn()
      };
    });
    return mockCommand;
  }
};
