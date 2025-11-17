import * as vscode from 'vscode';
import { DesignerPanel } from './designer/DesignerPanel';
import { PreviewService } from './preview/PreviewService';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CreateProjectPanel } from './designer/CreateProjectPanel';

// 日志记录器
class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Design');
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    private shouldLog(level: string): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('DEBUG', message);
            this.outputChannel.appendLine(formatted);
            console.log(formatted);
        }
    }

    info(message: string): void {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('INFO', message);
            this.outputChannel.appendLine(formatted);
            console.log(formatted);
        }
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('WARN', message);
            this.outputChannel.appendLine(formatted);
            console.warn(formatted);
        }
    }

    error(message: string, error?: unknown): void {
        if (this.shouldLog('error')) {
            let errorMessage = message;
            if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
                if (error.stack) {
                    errorMessage += `\n${error.stack}`;
                }
            } else if (error) {
                errorMessage += `: ${String(error)}`;
            }

            const formatted = this.formatMessage('ERROR', errorMessage);
            this.outputChannel.appendLine(formatted);
            console.error(formatted);
        }
    }

    setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
        this.logLevel = level;
        this.info(`日志级别已设置为: ${level}`);
    }

    show(): void {
        this.outputChannel.show();
    }

    clear(): void {
        this.outputChannel.clear();
    }

    append(message: string): void {
        this.outputChannel.append(message);
    }

    appendLine(message: string): void {
        this.outputChannel.appendLine(message);
    }

    /**
     * 将当前日志内容复制到剪贴板
     */
    public async copyToClipboard(): Promise<void> {
        try {
            const content = this['outputChannel'] ? this['outputChannel']['value'] || '' : '';
            await vscode.env.clipboard.writeText(content);
            vscode.window.showInformationMessage('HoneyGUI 日志已复制到剪贴板');
        } catch (error) {
            this.error('复制日志到剪贴板失败', error);
            vscode.window.showErrorMessage('复制日志失败: ' + (error as Error).message);
        }
    }

    /**
     * 导出日志到文件
     */
    public async exportToFile(filePath?: string): Promise<void> {
        const content = this['outputChannel'] ? this['outputChannel']['value'] || '' : '';

        if (!filePath) {
            const defaultPath = `honeygui-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultPath),
                filters: {
                    'Text Files': ['txt'],
                    'Log Files': ['log'],
                    'All Files': ['*']
                },
                title: '导出 HoneyGUI 日志'
            });

            if (!uri) {
                return;
            }

            filePath = uri.fsPath;
        }

        try {
            fs.writeFileSync(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`日志已导出到: ${filePath}`);
        } catch (error) {
            this.error('导出日志失败', error);
            vscode.window.showErrorMessage('导出日志失败: ' + (error as Error).message);
        }
    }
}

// 全局日志实例
export const logger = new Logger();

// 全局状态变量
let isLoading = false;
let statusBarItem: vscode.StatusBarItem;

// 更新状态栏状态
function updateStatus(message: string, isBusy: boolean = false): void {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.show();
    }

    statusBarItem.text = `$(honeygui-icon) ${message}`;
    statusBarItem.tooltip = `HoneyGUI: ${message}`;

    if (isBusy) {
        statusBarItem.text = `$(sync~spin) ${statusBarItem.text}`;
    }

    statusBarItem.show();

    logger.debug(`状态更新: ${message} (isBusy: ${isBusy})`);

    // 5秒后自动清除非忙碌状态的消息
    if (!isBusy) {
        setTimeout(() => {
            if (statusBarItem && !isLoading) {
                statusBarItem.hide();
            }
        }, 5000);
    }
}

// 统一错误处理函数
function handleError(error: unknown, operation: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`HoneyGUI ${operation} failed`, error);

    // 更新状态
    isLoading = false;
    updateStatus(`Error: ${operation}`, false);

    // 显示错误消息
    vscode.window.showErrorMessage(`HoneyGUI: Failed to ${operation.toLowerCase()}. ${errorMessage}`);
}

// 最近项目管理相关常量
const RECENT_PROJECTS_KEY = 'honeygui.recentProjects';
const MAX_RECENT_PROJECTS = 10;

// 保存最近项目到扩展上下文
function saveRecentProject(projectPath: string, context: vscode.ExtensionContext): void {
    const recentProjects = getRecentProjects(context);
    
    // 移除已存在的相同路径
    const filteredProjects = recentProjects.filter(p => p !== projectPath);
    
    // 添加到列表开头
    filteredProjects.unshift(projectPath);
    
    // 限制最大数量
    const trimmedProjects = filteredProjects.slice(0, MAX_RECENT_PROJECTS);
    
    // 保存到上下文
    context.globalState.update(RECENT_PROJECTS_KEY, trimmedProjects);
}

// 获取最近项目列表
function getRecentProjects(context: vscode.ExtensionContext): string[] {
    const projects = context.globalState.get<string[]>(RECENT_PROJECTS_KEY);
    return projects || [];
}

// 从最近项目列表中移除
function removeRecentProject(projectPath: string, context: vscode.ExtensionContext): void {
    const recentProjects = getRecentProjects(context);
    const filteredProjects = recentProjects.filter(p => p !== projectPath);
    context.globalState.update(RECENT_PROJECTS_KEY, filteredProjects);
}
// 简化的TemplateManager类，用于通过编译
class TemplateManager {
    constructor(private context: vscode.ExtensionContext) {}
    async loadTemplates(): Promise<void> {}
}

// Webview视图提供者类
class HoneyguiWelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'honeygui.welcome';

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        // 在resolveWebviewView方法中设置webview选项
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        webviewView.webview.html = this._getWelcomeHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.command) {
                case 'openProject':
                    vscode.commands.executeCommand('honeygui.openProject');
                    break;
                case 'openRecent':
                    vscode.commands.executeCommand('honeygui.openRecent');
                    break;
                case 'createProject':
                    vscode.commands.executeCommand('honeygui.showCreateProjectForm');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('honeygui.openSettings');
                    break;
            }
        });
    }

    private _getWelcomeHtml(webview: vscode.Webview): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HoneyGUI Welcome</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
            padding: 16px;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
        }
        .container {
            width: 100%;
        }
        .welcome-header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-sash-border);
        }
        .welcome-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: var(--vscode-foreground);
        }
        .welcome-subtitle {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin: 0;
        }
        .button-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .action-button {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background-color: transparent;
            border: 1px solid var(--vscode-contrastBorder);
            border-radius: 4px;
            color: var(--vscode-foreground);
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 14px;
        }
        .action-button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .button-icon {
            width: 20px;
            height: 20px;
            margin-right: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .button-text {
            flex: 1;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="welcome-header">
            <h2 class="welcome-title">Welcome to HoneyGUI</h2>
            <p class="welcome-subtitle">Create, edit and preview your embedded UI designs</p>
        </div>
        <div class="button-container">
            <button class="action-button" id="openProject">
                <div class="button-icon">📂</div>
                <div class="button-text">Open Project</div>
            </button>
            <button class="action-button" id="openRecent">
                <div class="button-icon">🕒</div>
                <div class="button-text">Open Recent</div>
            </button>
            <button class="action-button" id="createProject">
                <div class="button-icon">➕</div>
                <div class="button-text">Create Project</div>
            </button>
            <button class="action-button" id="openSettings">
                <div class="button-icon">⚙️</div>
                <div class="button-text">Settings</div>
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('openProject').addEventListener('click', () => {
            vscode.postMessage({ command: 'openProject' });
        });
        
        document.getElementById('openRecent').addEventListener('click', () => {
            vscode.postMessage({ command: 'openRecent' });
        });
        
        document.getElementById('createProject').addEventListener('click', () => {
            vscode.postMessage({ command: 'createProject' });
        });
        
        document.getElementById('openSettings').addEventListener('click', () => {
            vscode.postMessage({ command: 'openSettings' });
        });
    </script>
</body>
</html>
        `;
    }
}

class HoneyguiQuickViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'honeygui.quick';

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        // 在resolveWebviewView方法中设置webview选项
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        webviewView.webview.html = this._getQuickHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.command) {
                case 'startProject':
                    vscode.commands.executeCommand('honeygui.startProject');
                    break;
                case 'stopProject':
                    vscode.commands.executeCommand('honeygui.stopProject');
                    break;
                case 'restartProject':
                    vscode.commands.executeCommand('honeygui.restartProject');
                    break;
            }
        });
    }

    private _getQuickHtml(webview: vscode.Webview): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HoneyGUI Quick Controls</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
            padding: 16px;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
        }
        .container {
            width: 100%;
        }
        .controls-header {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-sash-border);
        }
        .controls-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
            color: var(--vscode-foreground);
        }
        .controls-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .control-button {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 12px 8px;
            background-color: transparent;
            border: 1px solid var(--vscode-contrastBorder);
            border-radius: 4px;
            color: var(--vscode-foreground);
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 12px;
            min-height: 60px;
        }
        .control-button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .control-icon {
            font-size: 20px;
            margin-bottom: 6px;
        }
        .control-text {
            text-align: center;
        }
        .start-button:hover {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .stop-button:hover {
            background-color: #d73a49;
            color: white;
        }
        .restart-button:hover {
            background-color: #0366d6;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="controls-header">
            <h3 class="controls-title">Quick Controls</h3>
        </div>
        <div class="controls-grid">
            <button class="control-button start-button" id="startProject">
                <div class="control-icon">▶️</div>
                <div class="control-text">Start</div>
            </button>
            <button class="control-button stop-button" id="stopProject">
                <div class="control-icon">■</div>
                <div class="control-text">Stop</div>
            </button>
            <button class="control-button restart-button" id="restartProject">
                <div class="control-icon">↻</div>
                <div class="control-text">Restart</div>
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('startProject').addEventListener('click', () => {
            vscode.postMessage({ command: 'startProject' });
        });
        
        document.getElementById('stopProject').addEventListener('click', () => {
            vscode.postMessage({ command: 'stopProject' });
        });
        
        document.getElementById('restartProject').addEventListener('click', () => {
            vscode.postMessage({ command: 'restartProject' });
        });
    </script>
</body>
</html>
        `;
    }
}

/**
 * 扩展激活时执行的函数
 */
// Honeygui设计器扩展激活函数
export function activate(context: vscode.ExtensionContext) {
    logger.info('HoneyGUI Visual Designer 扩展已激活');

    // 立即注册视图提供者 - 放在所有其他逻辑之前
    const welcomeProvider = new HoneyguiWelcomeViewProvider(context);
    const quickProvider = new HoneyguiQuickViewProvider(context);

    // 立即执行注册，不等待或其他操作
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HoneyguiWelcomeViewProvider.viewType,
            welcomeProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HoneyguiQuickViewProvider.viewType,
            quickProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
    
    // 注册数据提供者以解决"没有注册数据提供者"的错误
    class WelcomeViewDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
            return element;
        }

        getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
            // 返回欢迎视图的数据项
            const welcomeItems: vscode.TreeItem[] = [];
            
            const newProjectItem = new vscode.TreeItem('新建项目', vscode.TreeItemCollapsibleState.None);
            newProjectItem.command = { command: 'honeygui.createProject', title: '新建项目' };
            welcomeItems.push(newProjectItem);
            
            const openProjectItem = new vscode.TreeItem('打开项目', vscode.TreeItemCollapsibleState.None);
            openProjectItem.command = { command: 'honeygui.openProject', title: '打开项目' };
            welcomeItems.push(openProjectItem);
            
            const importProjectItem = new vscode.TreeItem('导入项目', vscode.TreeItemCollapsibleState.None);
            importProjectItem.command = { command: 'honeygui.importProject', title: '导入项目' };
            welcomeItems.push(importProjectItem);
            
            return welcomeItems;
        }
    }

    class QuickViewDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
            return element;
        }

        getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
            // 返回快速视图的数据项
            const quickItems: vscode.TreeItem[] = [];
            
            const startProjectItem = new vscode.TreeItem('启动项目', vscode.TreeItemCollapsibleState.None);
            startProjectItem.command = { command: 'honeygui.startProject', title: '启动项目' };
            quickItems.push(startProjectItem);
            
            const stopProjectItem = new vscode.TreeItem('停止项目', vscode.TreeItemCollapsibleState.None);
            stopProjectItem.command = { command: 'honeygui.stopProject', title: '停止项目' };
            quickItems.push(stopProjectItem);
            
            const restartProjectItem = new vscode.TreeItem('重启项目', vscode.TreeItemCollapsibleState.None);
            restartProjectItem.command = { command: 'honeygui.restartProject', title: '重启项目' };
            quickItems.push(restartProjectItem);
            
            return quickItems;
        }
    }

    // 注册数据提供者
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('honeygui.welcome', new WelcomeViewDataProvider()),
        vscode.window.registerTreeDataProvider('honeygui.quick', new QuickViewDataProvider())
    );

    logger.info('HoneyGUI: 视图提供者已注册');

    // 创建预览服务实例
    const previewService = new PreviewService(context);
    // 注册预览相关命令
    previewService.registerCommands();

    // 初始化模板管理器
    const templateManager = new TemplateManager(context);
    templateManager.loadTemplates().catch(err => logger.error('模板加载失败', err));

    // 尝试激活视图容器以确保视图可见
    setTimeout(() => {
        vscode.commands.executeCommand('workbench.view.extension.honeygui-explorer').then(
            () => logger.info('HoneyGUI: 视图容器激活成功'),
            (err) => logger.warn(`HoneyGUI: 视图容器可能尚未准备好 ${err}`)
        );
    }, 100);

    // 注册命令
    context.subscriptions.push(
        // 切换视图命令
        vscode.commands.registerCommand('honeygui.switchView', async (viewId?: string) => {
            try {
                // 如果没有传入viewId，让用户选择
                const targetViewId = viewId || await vscode.window.showQuickPick(
                    ['welcome', 'quick'],
                    { placeHolder: 'Select view to switch to' }
                );
                
                if (targetViewId) {
                    // 显示视图容器
                    await vscode.commands.executeCommand('workbench.view.extension.honeygui-explorer');
                    
                    // 聚焦到特定视图
                    if (targetViewId === 'welcome') {
                        await vscode.commands.executeCommand('honeygui.views.welcome.focus');
                    } else if (targetViewId === 'quick') {
                        await vscode.commands.executeCommand('honeygui.views.quick.focus');
                    }
                    
                    // 记录视图切换事件
                    console.log(`Successfully switched to view: ${targetViewId}`);
                }
            } catch (error) {
                console.error(`Error switching view: ${error instanceof Error ? error.message : 'Unknown error'}`);
                vscode.window.showWarningMessage(`Could not switch views.`);
            }
        }),
        
        // 打开项目命令
        vscode.commands.registerCommand('honeygui.openProject', async () => {
            try {
                const options: vscode.OpenDialogOptions = {
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Open Project',
                    title: 'Select HoneyGUI Project Folder'
                };

                const result = await vscode.window.showOpenDialog(options);
                if (result && result.length > 0) {
                    const projectPath = result[0].fsPath;

                    // 验证是否为有效的HoneyGUI项目
                    // 检查标准1：是否存在 project.json（推荐的标准项目结构）
                    const hasProjectJson = fs.existsSync(path.join(projectPath, 'project.json'));

                    // 检查标准2：是否存在 ui/ 目录，且目录中有 .hml 文件（兼容性支持）
                    const uiPath = path.join(projectPath, 'ui');
                    let hasHmlFiles = false;
                    if (fs.existsSync(uiPath) && fs.statSync(uiPath).isDirectory()) {
                        const files = fs.readdirSync(uiPath);
                        hasHmlFiles = files.some(file => file.endsWith('.hml'));
                    }

                    // 如果满足任一条件，则认为是有效的HoneyGUI项目
                    if (hasProjectJson || hasHmlFiles) {
                        // 打开文件夹
                        await vscode.commands.executeCommand('vscode.openFolder', result[0], false);
                        vscode.window.showInformationMessage(`Project opened successfully: ${path.basename(projectPath)}`);

                        // 保存到最近项目列表
                        saveRecentProject(projectPath, context);
                    } else {
                        // 不满足任一条件，显示错误信息，说明两种验证方式
                        if (!fs.existsSync(uiPath)) {
                            vscode.window.showErrorMessage('Selected folder is not a valid HoneyGUI project: missing ui/ directory');
                        } else {
                            vscode.window.showErrorMessage('Selected folder is not a valid HoneyGUI project: missing .hml files in ui/ directory');
                        }
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // 打开最近项目命令
        vscode.commands.registerCommand('honeygui.openRecent', async () => {
            try {
                const recentProjects = getRecentProjects(context);
                
                if (recentProjects.length === 0) {
                    vscode.window.showInformationMessage('No recent projects found');
                    return;
                }
                
                const projectNames = recentProjects.map(project => ({
                    label: path.basename(project),
                    description: project,
                    value: project
                }));
                
                const selected = await vscode.window.showQuickPick(projectNames, {
                    placeHolder: 'Select a recent project'
                });
                
                if (selected) {
                    // 检查项目是否仍然存在
                    if (fs.existsSync(path.join(selected.value, 'project.json'))) {
                        const uri = vscode.Uri.file(selected.value);
                        await vscode.commands.executeCommand('vscode.openFolder', uri, false);
                        vscode.window.showInformationMessage(`Project opened successfully: ${selected.label}`);
                    } else {
                        vscode.window.showErrorMessage('Selected project no longer exists');
                        // 从最近项目列表中移除不存在的项目
                        removeRecentProject(selected.value, context);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open recent project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // 显示创建项目表单命令
        vscode.commands.registerCommand('honeygui.showCreateProjectForm', () => {
            CreateProjectPanel.createOrShow(context);
        }),
        
        // 打开设置命令
        vscode.commands.registerCommand('honeygui.openSettings', async () => {
            try {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'honeygui');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // 启动项目命令
        vscode.commands.registerCommand('honeygui.startProject', async () => {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('No open workspace');
                    return;
                }
                
                // 检查是否有正在运行的预览服务
                if (previewService.getStatus().isRunning) {
                    vscode.window.showInformationMessage('Project is already running');
                    return;
                }
                
                // 启动预览服务
                await previewService.startPreview();
                vscode.window.showInformationMessage('Project started successfully');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // 停止项目命令
        vscode.commands.registerCommand('honeygui.stopProject', async () => {
            try {
                if (previewService.getStatus().isRunning) {
                    await previewService.stopPreview();
                    vscode.window.showInformationMessage('Project stopped successfully');
                } else {
                    vscode.window.showInformationMessage('No running project to stop');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // 重启项目命令
        vscode.commands.registerCommand('honeygui.restartProject', async () => {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('No open workspace');
                    return;
                }
                
                vscode.window.showInformationMessage('Restarting project...');
                
                // 停止当前服务
                if (previewService.getStatus().isRunning) {
                    await previewService.stopPreview();
                }
                
                // 启动新服务
                await previewService.startPreview();
                vscode.window.showInformationMessage('Project restarted successfully');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        // 打开设计器命令
        vscode.commands.registerCommand('honeygui.openDesigner', async () => {
            try {
                // 检查当前是否有打开的HML文件
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'xml' && editor.document.fileName.endsWith('.hml')) {
                    DesignerPanel.createOrShow(context, editor.document.fileName);
                } else {
                    // 询问用户是否要打开文件或创建新文件
                    const action = await vscode.window.showQuickPick(
                        ['创建新设计', '打开现有设计'],
                        { placeHolder: '请选择操作' }
                    );

                    if (action === '创建新设计') {
                        // 创建新设计
                        await vscode.commands.executeCommand('honeygui.newProject');
                    } else if (action === '打开现有设计') {
                        // 打开现有设计
                        await vscode.commands.executeCommand('honeygui.importProject');
                    } else {
                        // 如果用户取消，只打开空设计器
                        DesignerPanel.createOrShow(context);
                    }
                }
            } catch (error) {
                console.error('打开设计器失败:', error);
                vscode.window.showErrorMessage(`打开设计器失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),

        // 新建项目命令 - 使用 CreateProjectPanel 提供完整的项目创建向导
        // 与侧边栏的创建项目功能保持一致
        vscode.commands.registerCommand('honeygui.newProject', () => {
            CreateProjectPanel.createOrShow(context);
        }),

        // 导入现有项目命令
        vscode.commands.registerCommand('honeygui.importProject', async () => {
            try {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: '打开',
                    filters: {
                        'HML 文件': ['hml'],
                        '所有文件': ['*']
                    }
                };

                const fileUri = await vscode.window.showOpenDialog(options);

                if (fileUri && fileUri.length > 0) {
                    // 检查文件是否存在
                    if (fs.existsSync(fileUri[0].fsPath)) {
                        // 打开设计器并加载选择的文件
                        DesignerPanel.createOrShow(context, fileUri[0].fsPath);
                        vscode.window.showInformationMessage(`项目已打开: ${path.basename(fileUri[0].fsPath)}`);
                    } else {
                        vscode.window.showErrorMessage(`文件不存在: ${fileUri[0].fsPath}`);
                    }
                }
            } catch (error) {
                console.error('导入项目失败:', error);
                vscode.window.showErrorMessage(`导入项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),
        
        // 创建项目命令 - 调用CreateProjectPanel显示项目创建配置界面
        vscode.commands.registerCommand('honeygui.createProject', () => {
            CreateProjectPanel.createOrShow(context);
        }),

        // 生成代码命令
        vscode.commands.registerCommand('honeygui.generateCode', () => {
            vscode.window.showInformationMessage('代码生成功能开发中...');
        }),

        // 预览命令
        vscode.commands.registerCommand('honeygui.previewDesign', () => {
            // 通过预览服务打开预览
            previewService.openPreview();
        }),

        // 保存设计命令
        vscode.commands.registerCommand('honeygui.saveDesign', () => {
            vscode.window.showInformationMessage('保存功能已集成到设计器中');
        }),

        // 导出设计命令
        vscode.commands.registerCommand('honeygui.exportDesign', () => {
            vscode.window.showInformationMessage('导出功能开发中...');
        }),

        // 资源管理器命令
        vscode.commands.registerCommand('honeygui.openResourceManager', () => {
            vscode.window.showInformationMessage('HoneyGUI: 资源管理器功能即将实现');
        }),

        // 打开文档命令
        vscode.commands.registerCommand('honeygui.openDocs', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://gitee.com/realmcu/HoneyGUI'));
        }),

        // XML转HML迁移命令
        vscode.commands.registerCommand('honeygui.migrateXmlToHml', () => {
            vscode.window.showInformationMessage('HoneyGUI: XML转HML迁移功能即将实现');
        }),

        // 日志相关命令
        // 显示日志输出通道
        vscode.commands.registerCommand('honeygui.showLogs', () => {
            logger.show();
            vscode.window.showInformationMessage('HoneyGUI 日志已显示');
        }),

        // 清空日志
        vscode.commands.registerCommand('honeygui.clearLogs', () => {
            logger.clear();
            vscode.window.showInformationMessage('HoneyGUI 日志已清空');
        }),

        // 复制日志到剪贴板
        vscode.commands.registerCommand('honeygui.copyLogs', async () => {
            try {
                await logger.copyToClipboard();
            } catch (error) {
                vscode.window.showErrorMessage('复制日志失败');
            }
        }),

        // 导出日志到文件
        vscode.commands.registerCommand('honeygui.exportLogs', async () => {
            try {
                await logger.exportToFile();
            } catch (error) {
                vscode.window.showErrorMessage('导出日志失败');
            }
        }),

        // 设置日志级别
        vscode.commands.registerCommand('honeygui.setLogLevel', async () => {
            const levels = [
                { label: 'Debug (最详细)', value: 'debug' as const },
                { label: 'Info (推荐)', value: 'info' as const },
                { label: 'Warning', value: 'warn' as const },
                { label: 'Error (仅错误)', value: 'error' as const }
            ];

            const selected = await vscode.window.showQuickPick(
                levels.map(l => l.label),
                { placeHolder: '选择日志级别' }
            );

            if (selected) {
                const level = levels.find(l => l.label === selected)?.value || 'info';
                logger.setLogLevel(level);
                vscode.window.showInformationMessage(`日志级别已设置为: ${selected}`);
            }
        }),

        // 扩展信息
        vscode.commands.registerCommand('honeygui.showExtensionInfo', () => {
            const info = {
                'Extension': 'HoneyGUI Visual Designer',
                'Version': context.extension.packageJSON.version || '未知',
                'Path': context.extensionPath,
                'Runtime': process.version,
                'Platform': process.platform
            };

            const infoText = Object.entries(info)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');

            logger.info('扩展信息:\n' + infoText);
            vscode.window.showInformationMessage(
                `HoneyGUI v${info.Version}`,
                '查看日志',
                '确定'
            ).then(selection => {
                if (selection === '查看日志') {
                    logger.show();
                }
            });
        })
    );
    
    // 监听HML文件的打开事件
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.fileName.endsWith('.hml')) {
                // 提示用户是否要在设计器中打开
                vscode.window.showInformationMessage(
                    `检测到HML文件，是否在设计器中打开？`,
                    '是',
                    '否'
                ).then((selection) => {
                    if (selection === '是') {
                        DesignerPanel.createOrShow(context, document.fileName);
                    }
                });
            }
        })
    );

    // 监听文件系统变化，以便在文件被外部修改时通知用户
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.hml');
    context.subscriptions.push(
        watcher.onDidChange(uri => {
            vscode.window.showInformationMessage(`文件已被修改: ${uri.fsPath}`);
        })
    );

    // 监听VSCode启动事件，以便在编辑器启动时进行一些初始化工作
    vscode.window.onDidChangeVisibleTextEditors(() => {
        // 检查当前活动的编辑器是否打开了.hml文件
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath.endsWith('.hml')) {
            // 自动在设计器中打开HML文件，而不是以文本方式显示
            DesignerPanel.createOrShow(context, activeEditor.document.uri.fsPath);
        }
    });
    
    // 在扩展激活时立即检查活动编辑器中的.hml文件
    const currentActiveEditor = vscode.window.activeTextEditor;
    if (currentActiveEditor && currentActiveEditor.document.uri.fsPath.endsWith('.hml')) {
        // 自动在设计器中打开HML文件
        DesignerPanel.createOrShow(context, currentActiveEditor.document.uri.fsPath);
    }
    
    // 当扩展被激活时的通知
    vscode.window.showInformationMessage('HoneyGUI扩展已激活');
    
    // 添加预览服务到清理列表
    context.subscriptions.push({
        dispose: () => {
            previewService.dispose();
        }
    });

    /**
     * 检查并处理待激活的项目
     * 当通过 CreateProjectPanel 创建项目后，项目信息会被保存到 globalState
     * 扩展重新加载后，需要自动激活该项目
     */
    async function checkAndActivatePendingProject() {
        try {
            // 从全局存储获取待激活的项目信息
            const pendingActivation = context.globalState.get<any>('pendingProjectActivation');

            if (pendingActivation && pendingActivation.projectPath) {
                console.log('检测到待激活项目:', pendingActivation.projectName);

                // 检查是否超时（5分钟内）
                const now = Date.now();
                const timestamp = pendingActivation.timestamp || 0;
                const timeElapsed = now - timestamp;
                const MAX_ELAPSED_TIME = 5 * 60 * 1000; // 5分钟

                if (timeElapsed > MAX_ELAPSED_TIME) {
                    console.log('待激活项目已超时，清除记录');
                    await context.globalState.update('pendingProjectActivation', undefined);
                    return;
                }

                // 检查当前工作区是否是待激活的项目
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const currentWorkspace = workspaceFolders[0].uri.fsPath;
                    const pendingProjectPath = pendingActivation.projectPath;

                    // 检查是否是同一个项目
                    if (currentWorkspace === pendingProjectPath) {
                        console.log('工作区匹配，开始自动激活项目');

                        // 显示激活进度
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `正在激活项目: ${pendingActivation.projectName}`,
                            cancellable: false
                        }, async (progress) => {
                            try {
                                progress.report({ increment: 0, message: '查找HML文件...' });

                                // 尝试查找HML文件
                                const hmlFiles = await vscode.workspace.findFiles('**/*.hml', '**/node_modules/**', 1);

                                if (hmlFiles.length > 0) {
                                    const hmlFile = hmlFiles[0];
                                    const hmlFilePath = hmlFile.fsPath;

                                    progress.report({ increment: 30, message: '加载HML文件...' });

                                    // 先打开文件
                                    await vscode.commands.executeCommand('vscode.open', hmlFile);

                                    progress.report({ increment: 60, message: '打开设计器...' });

                                    // 在设计器中打开
                                    DesignerPanel.createOrShow(context, hmlFilePath);

                                    progress.report({ increment: 90, message: '启动预览服务...' });

                                    // 启动预览服务
                                    await vscode.commands.executeCommand('honeygui.startProject');

                                    progress.report({ increment: 100, message: '项目激活完成！' });

                                    // 显示成功消息
                                    vscode.window.showInformationMessage(`项目 '${pendingActivation.projectName}' 已成功激活！`);

                                    console.log('项目激活完成:', pendingActivation.projectName);
                                } else {
                                    console.warn('未找到HML文件，无法激活项目');
                                    vscode.window.showWarningMessage('未找到HML文件，项目激活不完整');
                                }

                                // 激活完成后清除待激活标记
                                await context.globalState.update('pendingProjectActivation', undefined);

                            } catch (error) {
                                console.error('项目激活失败:', error);
                                const errorMessage = error instanceof Error ? error.message : '未知错误';
                                vscode.window.showErrorMessage(`项目激活失败: ${errorMessage}`);

                                // 即使失败也清除标记，避免重复尝试
                                await context.globalState.update('pendingProjectActivation', undefined);
                            }
                        });
                    } else {
                        console.log('工作区不匹配，当前:', currentWorkspace, '待激活:', pendingProjectPath);
                    }
                } else {
                    console.log('没有工作区文件夹');
                }
            } else {
                console.log('没有待激活的项目');
            }
        } catch (error) {
            console.error('检查待激活项目时出错:', error);
            // 出错时清除标记，避免阻塞
            await context.globalState.update('pendingProjectActivation', undefined);
        }
    }

    // 延迟一小段时间后检查待激活项目
    // 给VSCode一些时间来完成工作区初始化
    setTimeout(() => {
        checkAndActivatePendingProject();
    }, 1000);
}

// 导出停用函数
function deactivate() {
    console.log('HoneyGUI Visual Designer 已停用');
    // 有机会清理工作可以在这里进行
    // DesignerPanel会自动处理清理
    vscode.window.showInformationMessage('HoneyGUI扩展已停用');
}

// 导出扩展函数
export { deactivate };