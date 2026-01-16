import * as vscode from 'vscode';
import { logger } from '../utils/Logger';
import { CommandManager } from './CommandManager';
import { HmlEditorProvider } from '../hml/HmlEditorProvider';
import { EnvironmentViewProvider } from '../ui/EnvironmentViewProvider';
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
        logger.info('HoneyGUI扩展初始化开始...');

        // 优先注册命令（确保基本功能可用）
        try {
            this.commandManager.registerCommands();
        } catch (error) {
            logger.error(`命令注册失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 注册视图提供者（确保侧边栏视图可用）
        try {
            this.registerViewProviders();
        } catch (error) {
            logger.error(`视图提供者注册失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            // 注册预览服务
            const previewServiceModule = await import('../preview/PreviewService');
            const PreviewService = previewServiceModule.PreviewService;
            const previewService = new PreviewService(this.context);
            previewService.registerCommands();
            this.disposables.push(previewService);

            // 注册编译仿真服务
            const simulationServiceModule = await import('../simulation/SimulationService');
            const SimulationService = simulationServiceModule.SimulationService;
            const simulationService = new SimulationService(this.context);
            simulationService.registerCommands();
            this.disposables.push(simulationService);

            // 注册 UART 下载服务
            const uartServiceModule = await import('../services/UartDownloadService');
            const UartDownloadService = uartServiceModule.UartDownloadService;
            const uartService = new UartDownloadService(this.context);
            uartService.registerCommands();
            this.disposables.push(uartService);

            // 注册HML编辑器提供者
            this.registerHmlEditorProvider();

            // 注册文件关联
            this.registerFileAssociations();

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
        // 注册环境检查视图
        const envProvider = new EnvironmentViewProvider();
        const envRegistration = vscode.window.registerTreeDataProvider('honeygui.environment', envProvider);
        this.disposables.push(envRegistration);
        this.context.subscriptions.push(envRegistration);

        // 注册刷新命令
        const refreshCommand = vscode.commands.registerCommand('honeygui.environment.refresh', () => {
            envProvider.refresh();
        });
        this.disposables.push(refreshCommand);
        this.context.subscriptions.push(refreshCommand);

        // 注册显示安装指引命令
        const guideCommand = vscode.commands.registerCommand('honeygui.environment.showGuide', (toolId: string) => {
            EnvironmentViewProvider.showInstallGuide(toolId);
        });
        this.disposables.push(guideCommand);
        this.context.subscriptions.push(guideCommand);

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
 * 快速操作视图数据提供者
 */
class QuickViewDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        // 返回快速视图的数据项
        const quickItems: vscode.TreeItem[] = [];
        
        const startProjectItem = new vscode.TreeItem(vscode.l10n.t('Start Project'), vscode.TreeItemCollapsibleState.None);
        startProjectItem.command = { command: 'honeygui.startProject', title: vscode.l10n.t('Start Project') };
        startProjectItem.iconPath = new vscode.ThemeIcon('play');
        quickItems.push(startProjectItem);
        
        const stopProjectItem = new vscode.TreeItem(vscode.l10n.t('Stop Project'), vscode.TreeItemCollapsibleState.None);
        stopProjectItem.command = { command: 'honeygui.stopProject', title: vscode.l10n.t('Stop Project') };
        stopProjectItem.iconPath = new vscode.ThemeIcon('stop');
        quickItems.push(stopProjectItem);
        
        const restartProjectItem = new vscode.TreeItem(vscode.l10n.t('Restart Project'), vscode.TreeItemCollapsibleState.None);
        restartProjectItem.command = { command: 'honeygui.restartProject', title: vscode.l10n.t('Restart Project') };
        restartProjectItem.iconPath = new vscode.ThemeIcon('refresh');
        quickItems.push(restartProjectItem);
        
        return quickItems;
    }
}
