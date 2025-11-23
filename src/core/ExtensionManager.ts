import * as vscode from 'vscode';
import { logger } from '../utils/Logger';
import { CommandManager } from './CommandManager';
import { HmlEditorProvider } from '../hml/HmlEditorProvider';
import * as path from 'path';
import * as fs from 'fs';

/**
 * HoneyGUI扩展管理器
 * 负责扩展的初始化、配置和生命周期管理
 */
export class ExtensionManager {
    private commandManager: CommandManager;
    private hmlEditorProvider: HmlEditorProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.commandManager = new CommandManager(context);
        this.hmlEditorProvider = new HmlEditorProvider(context);
    }

    /**
     * 初始化扩展
     */
    async initialize(): Promise<void> {
        try {
            logger.info('HoneyGUI扩展初始化开始...');

            // 注册命令
            this.commandManager.registerCommands();

            // 注册预览相关命令
            const previewServiceModule = await import('../preview/PreviewService');
            const PreviewService = previewServiceModule.PreviewService;
            const previewService = new PreviewService(this.context);
            previewService.registerCommands();

            // 注册HML编辑器提供者
            this.registerHmlEditorProvider();

            // 注册文件关联
            this.registerFileAssociations();

            // 注册视图提供者
            this.registerViewProviders();

            // 检查环境
            await this.checkEnvironment();

            logger.info('HoneyGUI扩展初始化完成');
            
            // 显示欢迎信息（仅在首次激活时）
            this.showWelcomeMessage();

        } catch (error) {
            logger.error(`扩展初始化失败: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * 注册HML编辑器提供者
     */
    private registerHmlEditorProvider(): void {
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'honeygui.hmlEditor',  // 修正为与package.json一致的viewType
            this.hmlEditorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );

        this.disposables.push(providerRegistration);
        this.context.subscriptions.push(providerRegistration);
        logger.info('HML编辑器提供者注册完成，viewType: honeygui.hmlEditor');
    }

    /**
     * 注册文件关联
     */
    private registerFileAssociations(): void {
        // HML文件的语言支持已在package.json中配置
        logger.info('文件关联注册完成');
    }

    /**
     * 检查环境
     */
    private async checkEnvironment(): Promise<void> {
        try {
            // 检查工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                logger.warn('没有打开的工作区');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            logger.info(`工作区根目录: ${workspaceRoot}`);

            // 检查项目配置
            const projectConfigPath = path.join(workspaceRoot, 'project.json');
            if (fs.existsSync(projectConfigPath)) {
                const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
                logger.info(`检测到项目配置: ${config.name || '未命名项目'}`);
            } else {
                logger.info('未检测到项目配置文件');
            }

        } catch (error) {
            logger.warn(`环境检查失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 注册视图提供者
     */
    private registerViewProviders(): void {
        // 注册欢迎视图提供者
        const welcomeProvider = new WelcomeViewDataProvider();
        const welcomeRegistration = vscode.window.registerTreeDataProvider('honeygui.welcome', welcomeProvider);
        this.disposables.push(welcomeRegistration);
        this.context.subscriptions.push(welcomeRegistration);

        // 注册快速操作视图提供者
        const quickProvider = new QuickViewDataProvider();
        const quickRegistration = vscode.window.registerTreeDataProvider('honeygui.quick', quickProvider);
        this.disposables.push(quickRegistration);
        this.context.subscriptions.push(quickRegistration);

        logger.info('视图提供者注册完成');
    }

    /**
     * 显示欢迎信息（仅首次激活时显示）
     */
    private showWelcomeMessage(): void {
        // 使用globalState持久化存储，防止重复显示
        const hasShownWelcome = this.context.globalState.get<boolean>('honeygui.welcomeMessageShown', false);
        
        if (hasShownWelcome) {
            return;
        }

        // 标记为已显示
        this.context.globalState.update('honeygui.welcomeMessageShown', true);
        
        vscode.window.showInformationMessage(
            'HoneyGUI设计器已启动！使用 Ctrl+Shift+P 搜索 "HoneyGUI" 开始创建项目。',
            '创建项目',
            '查看文档'
        ).then(selection => {
            switch (selection) {
                case '创建项目':
                    vscode.commands.executeCommand('honeygui.newProject');
                    break;
                case '查看文档':
                    vscode.env.openExternal(vscode.Uri.parse('https://gitee.com/realmcu/honeygui-design'));
                    break;
            }
        });
    }

    /**
     * 清理资源
     */
    dispose(): void {
        logger.info('HoneyGUI扩展正在清理资源...');
        
        this.commandManager.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        
        logger.info('HoneyGUI扩展已清理完成');
    }
}

/**
 * 欢迎视图数据提供者
 */
class WelcomeViewDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        // 返回欢迎视图的数据项
        const welcomeItems: vscode.TreeItem[] = [];
        
        const newHmlItem = new vscode.TreeItem('新建HML文件', vscode.TreeItemCollapsibleState.None);
        newHmlItem.command = { command: 'honeygui.createNewHmlInWorkspace', title: '新建HML文件' };
        newHmlItem.iconPath = new vscode.ThemeIcon('file-add');
        welcomeItems.push(newHmlItem);
        
        const newProjectItem = new vscode.TreeItem('新建项目', vscode.TreeItemCollapsibleState.None);
        newProjectItem.command = { command: 'honeygui.createProject', title: '新建项目' };
        newProjectItem.iconPath = new vscode.ThemeIcon('add');
        welcomeItems.push(newProjectItem);
        
        const openProjectItem = new vscode.TreeItem('打开项目', vscode.TreeItemCollapsibleState.None);
        openProjectItem.command = { command: 'honeygui.openProject', title: '打开项目' };
        openProjectItem.iconPath = new vscode.ThemeIcon('folder-opened');
        welcomeItems.push(openProjectItem);
        
        const importProjectItem = new vscode.TreeItem('导入项目', vscode.TreeItemCollapsibleState.None);
        importProjectItem.command = { command: 'honeygui.importProject', title: '导入项目' };
        importProjectItem.iconPath = new vscode.ThemeIcon('cloud-download');
        welcomeItems.push(importProjectItem);
        
        return welcomeItems;
    }
}

/**
 * 快速操作视图数据提供者
 */
class QuickViewDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        // 返回快速视图的数据项
        const quickItems: vscode.TreeItem[] = [];
        
        const startProjectItem = new vscode.TreeItem('启动项目', vscode.TreeItemCollapsibleState.None);
        startProjectItem.command = { command: 'honeygui.startProject', title: '启动项目' };
        startProjectItem.iconPath = new vscode.ThemeIcon('play');
        quickItems.push(startProjectItem);
        
        const stopProjectItem = new vscode.TreeItem('停止项目', vscode.TreeItemCollapsibleState.None);
        stopProjectItem.command = { command: 'honeygui.stopProject', title: '停止项目' };
        stopProjectItem.iconPath = new vscode.ThemeIcon('stop');
        quickItems.push(stopProjectItem);
        
        const restartProjectItem = new vscode.TreeItem('重启项目', vscode.TreeItemCollapsibleState.None);
        restartProjectItem.command = { command: 'honeygui.restartProject', title: '重启项目' };
        restartProjectItem.iconPath = new vscode.ThemeIcon('refresh');
        quickItems.push(restartProjectItem);
        
        return quickItems;
    }
}
