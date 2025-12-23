import * as vscode from 'vscode';
import { logger } from '../utils/Logger';
import { DesignerPanel } from '../designer/DesignerPanel';
import { DesignerPanelFactory } from '../designer/DesignerPanelFactory';
import { CreateProjectPanel } from '../designer/CreateProjectPanel';
import { ToolsPanel } from '../tools/ToolsPanel';
import * as path from 'path';
import * as fs from 'fs';
import { CollaborationService } from './CollaborationService';
import { StatusBarManager } from '../ui/StatusBarManager';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * HoneyGUI命令管理器
 * 统一管理所有VS Code命令
 */
export class CommandManager {
    private disposables: vscode.Disposable[] = [];
    private statusBarManager: StatusBarManager;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarManager = StatusBarManager.getInstance(context);
    }

    /**
     * 注册所有命令
     */
    registerCommands(): void {
        // 注册协同相关命令
        this.registerCollaborationCommands();

        // 新建项目
        this.registerCommand('honeygui.newProject', async () => {
            try {
                logger.info('执行命令: honeygui.newProject');
                await CreateProjectPanel.createOrShow(this.context);
            } catch (error) {
                logger.error(`新建项目失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`新建项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 资源转换工具
        this.registerCommand('honeygui.tools', async () => {
            try {
                logger.info('执行命令: honeygui.tools');
                ToolsPanel.createOrShow(this.context.extensionUri);
            } catch (error) {
                logger.error(`打开资源转换工具失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`打开资源转换工具失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 打开欢迎页面
        this.registerCommand('honeygui.welcome', async () => {
            try {
                logger.info('执行命令: honeygui.welcome');
                const panel = vscode.window.createWebviewPanel(
                    'honeyguiWelcome',
                    'HoneyGUI 欢迎',
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                panel.webview.html = this.getWelcomeHtml();
            } catch (error) {
                logger.error(`打开欢迎页面失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`打开欢迎页面失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 显示日志
        this.registerCommand('honeygui.showLogs', () => {
            logger.show();
        });

        // 清理缓存
        this.registerCommand('honeygui.clearCache', async () => {
            try {
                logger.info('执行命令: honeygui.clearCache');
                
                // 清理项目缓存
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const workspaceRoot = workspaceFolders[0].uri.fsPath;
                    const cacheDir = path.join(workspaceRoot, '.honeygui', 'cache');
                    
                    if (fs.existsSync(cacheDir)) {
                        fs.rmSync(cacheDir, { recursive: true, force: true });
                        logger.info(`清理缓存目录: ${cacheDir}`);
                    }
                }

                logger.clearCache();
                vscode.window.showInformationMessage('缓存已清理');
            } catch (error) {
                logger.error(`清理缓存失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`清理缓存失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 在文本编辑器中打开HML文件
        this.registerCommand('honeygui.openInTextEditor', async (uri: vscode.Uri) => {
            try {
                logger.info(`执行命令: honeygui.openInTextEditor, URI: ${uri.fsPath}`);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });
            } catch (error) {
                logger.error(`文本编辑器打开失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`文本编辑器打开失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 在设计器中打开HML文件
        this.registerCommand('honeygui.openInDesigner', async (uri: vscode.Uri) => {
            try {
                logger.info(`执行命令: honeygui.openInDesigner, URI: ${uri?.fsPath}`);
                
                // 验证URI参数
                if (!uri) {
                    logger.error('设计器打开失败: URI参数为空');
                    vscode.window.showErrorMessage('设计器打开失败: 未提供文件路径');
                    return;
                }
                
                // 验证文件存在且为HML文件
                if (!fs.existsSync(uri.fsPath)) {
                    logger.error(`设计器打开失败: 文件不存在 - ${uri.fsPath}`);
                    vscode.window.showErrorMessage(`设计器打开失败: 文件不存在 - ${path.basename(uri.fsPath)}`);
                    return;
                }
                
                if (!uri.fsPath.endsWith('.hml')) {
                    logger.error(`设计器打开失败: 不是HML文件 - ${uri.fsPath}`);
                    vscode.window.showErrorMessage('设计器打开失败: 请选择HML文件');
                    return;
                }
                
                logger.info(`正在使用vscode.openWith打开文件: ${uri.fsPath}`);
                logger.info(`自定义编辑器类型: honeygui.hmlEditor`);
                
                // 先关闭当前活动的编辑器
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.uri.fsPath === uri.fsPath) {
                    logger.info('关闭当前活动的文本编辑器');
                    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                }
                
                // 使用 VS Code 的 custom 打开方式
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    uri,
                    'honeygui.hmlEditor'
                );
                
                logger.info(`设计器打开成功: ${uri.fsPath}`);
            } catch (error) {
                logger.error(`设计器打开失败: ${error instanceof Error ? error.message : String(error)}`);
                logger.error(`错误堆栈: ${error instanceof Error ? error.stack : '无堆栈信息'}`);
                vscode.window.showErrorMessage(`设计器打开失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 兼容 package.json 的命令: honeygui.openDesigner（无参时打开当前活动HML）
        this.registerCommand('honeygui.openDesigner', async () => {
            try {
                logger.info('执行命令: honeygui.openDesigner');
                const active = vscode.window.activeTextEditor;
                if (!active || !active.document.fileName.endsWith('.hml')) {
                    vscode.window.showWarningMessage('请在文本编辑器中打开一个HML文件后再执行该命令');
                    return;
                }
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    active.document.uri,
                    'honeygui.hmlEditor'
                );
            } catch (error) {
                logger.error(`打开设计器失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`打开设计器失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 代码生成命令（从当前设计器面板触发）
        this.registerCommand('honeygui.codegen', async () => {
            try {
                logger.info('执行命令: honeygui.codegen');
                const panel = (DesignerPanel as any).currentPanel as DesignerPanel | undefined;
                if (!panel) {
                    vscode.window.showWarningMessage('请先打开HoneyGUI设计器');
                    return;
                }
                // 读取用户配置中的语言选项
                const config = vscode.workspace.getConfiguration('honeygui.codegen');
                const language = (config.get<string>('language', 'cpp') as 'cpp' | 'c');
                await (panel as any).generateCode(language);
            } catch (error) {
                logger.error(`代码生成失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`代码生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 切换视图
        this.registerCommand('honeygui.switchView', async () => {
            try {
                logger.info('执行命令: honeygui.switchView');
                vscode.window.showInformationMessage('视图切换功能开发中...');
            } catch (error) {
                logger.error(`视图切换失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`视图切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 创建新的设计稿
        this.registerCommand('honeygui.createNewHmlInWorkspace', async () => {
            try {
                logger.info('执行命令: honeygui.createNewHmlInWorkspace');
                
                // 获取工作区文件夹
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage('请先打开一个工作区');
                    return;
                }
                
                // 使用第一个工作区的ui目录
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const uiDir = path.join(workspaceRoot, 'ui');
                
                // 确保ui目录存在
                if (!fs.existsSync(uiDir)) {
                    fs.mkdirSync(uiDir, { recursive: true });
                }
                
                // 输入设计稿名称
                const designName = await vscode.window.showInputBox({
                    prompt: '请输入设计稿名称',
                    placeHolder: 'untitled',
                    value: 'untitled',
                    validateInput: (value) => {
                        if (!value.trim()) return '设计稿名称不能为空';
                        if (!/^[a-zA-Z0-9_-]+$/.test(value)) return '设计稿名称只能包含字母、数字、下划线和连字符';
                        const targetDir = path.join(uiDir, value);
                        if (fs.existsSync(targetDir)) return '设计稿目录已存在';
                        return null;
                    }
                });
                
                if (designName) {
                    // 创建设计稿目录
                    const designDir = path.join(uiDir, designName);
                    fs.mkdirSync(designDir, { recursive: true });
                    
                    // 读取项目配置获取分辨率
                    const projectConfig = ProjectUtils.loadProjectConfig(workspaceRoot);
                    const { width, height } = ProjectUtils.parseResolution(projectConfig.resolution);
                    
                    // 创建HML文件
                    const hmlFilePath = path.join(designDir, `${designName}.hml`);
                    const viewName = `${designName}View`;
                    const defaultContent = `<?xml version="1.0" encoding="UTF-8"?>
<hml version="1.0">
    <view id="main" width="${width}" height="${height}" background-color="#f0f0f0">
        <hg_view id="${viewName}" x="0" y="0" width="${width}" height="${height}" name="${viewName}" backgroundColor="#000000">
            <!-- 在这里添加您的组件 -->
        </hg_view>
    </view>
</hml>`;
                    
                    fs.writeFileSync(hmlFilePath, defaultContent, 'utf8');
                    
                    // 在设计器中打开新创建的文件
                    await vscode.commands.executeCommand('honeygui.openInDesigner', vscode.Uri.file(hmlFilePath));
                    
                    vscode.window.showInformationMessage(`设计稿已创建: ${designName}`);
                }
            } catch (error) {
                logger.error(`创建设计稿失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`创建设计稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 打开项目
        this.registerCommand('honeygui.openProject', async () => {
            try {
                logger.info('执行命令: honeygui.openProject');
                const options: vscode.OpenDialogOptions = {
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: '选择项目文件夹'
                };
                
                const folderUri = await vscode.window.showOpenDialog(options);
                if (folderUri && folderUri.length > 0) {
                    logger.info(`打开项目文件夹: ${folderUri[0].fsPath}`);
                    await vscode.commands.executeCommand('vscode.openFolder', folderUri[0]);
                }
            } catch (error) {
                logger.error(`打开项目失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`打开项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 启动项目
        this.registerCommand('honeygui.startProject', async () => {
            try {
                logger.info('执行命令: honeygui.startProject');
                vscode.window.showInformationMessage('项目启动功能开发中...');
            } catch (error) {
                logger.error(`启动项目失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`启动项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 停止项目
        this.registerCommand('honeygui.stopProject', async () => {
            try {
                logger.info('执行命令: honeygui.stopProject');
                vscode.window.showInformationMessage('项目停止功能开发中...');
            } catch (error) {
                logger.error(`停止项目失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`停止项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 重启项目
        this.registerCommand('honeygui.restartProject', async () => {
            try {
                logger.info('执行命令: honeygui.restartProject');
                vscode.window.showInformationMessage('项目重启功能开发中...');
            } catch (error) {
                logger.error(`重启项目失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`重启项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        // 切换编辑器模式（备用方案）
        this.registerCommand('honeygui.toggleEditor', async () => {
            try {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('请先打开一个文件');
                    return;
                }
                
                const currentUri = activeEditor.document.uri;
                if (!currentUri.fsPath.endsWith('.hml')) {
                    vscode.window.showWarningMessage('只能在HML文件上切换编辑器模式');
                    return;
                }
                
                logger.info(`执行命令: honeygui.toggleEditor, URI: ${currentUri.fsPath}`);
                
                // 关闭当前编辑器
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                
                // 延迟一下确保编辑器已关闭
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 使用自定义编辑器打开
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    currentUri,
                    'honeygui.hmlEditor'
                );
                
                logger.info(`编辑器切换成功: ${currentUri.fsPath}`);
            } catch (error) {
                logger.error(`编辑器切换失败: ${error instanceof Error ? error.message : String(error)}`);
                vscode.window.showErrorMessage(`编辑器切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });

        logger.info('命令注册完成');
    }

    private registerCollaborationCommands(): void {
        // 开启协同（作为主机）
        this.registerCommand('honeygui.collaboration.startHost', async () => {
            try {
                const service = CollaborationService.getInstance();
                if (service.isConnected) {
                    vscode.window.showWarningMessage('当前已处于协同模式，请先停止');
                    return;
                }

                const portInput = await vscode.window.showInputBox({
                    prompt: '请输入监听端口 (默认: 3000)',
                    value: '3000',
                    validateInput: (value) => {
                        const port = parseInt(value);
                        return (!isNaN(port) && port > 1024 && port < 65535) ? null : '请输入有效的端口号 (1024-65535)';
                    }
                });

                if (!portInput) return;

                const address = await service.startHost(parseInt(portInput));
                vscode.window.showInformationMessage(`协同服务已启动，请邀请他人连接: ${address}`);
                
                // 复制地址到剪贴板
                await vscode.env.clipboard.writeText(address);
                vscode.window.setStatusBarMessage('协同地址已复制到剪贴板', 3000);

                this.statusBarManager.updateCollaborationStatus('Host', address);
            } catch (error) {
                logger.error(`启动协同失败: ${error}`);
                vscode.window.showErrorMessage(`启动协同失败: ${error}`);
            }
        });

        // 加入协同（作为访客）
        this.registerCommand('honeygui.collaboration.joinSession', async () => {
            try {
                const service = CollaborationService.getInstance();
                if (service.isConnected) {
                    vscode.window.showWarningMessage('当前已处于协同模式，请先停止');
                    return;
                }

                const addressInput = await vscode.window.showInputBox({
                    prompt: '请输入主机地址 (IP:Port)',
                    placeHolder: '192.168.1.x:3000',
                    validateInput: (value) => {
                        const parts = value.split(':');
                        if (parts.length !== 2) return '格式错误，请输入 IP:Port';
                        const port = parseInt(parts[1]);
                        if (isNaN(port) || port < 1 || port > 65535) return '端口无效 (1-65535)';
                        return null;
                    }
                });

                if (!addressInput) return;

                await service.joinSession(addressInput);
                vscode.window.showInformationMessage(`成功加入协同: ${addressInput}`);
                this.statusBarManager.updateCollaborationStatus('Guest', addressInput);

                // 自动打开设计器
                DesignerPanelFactory.createOrShow(this.context);
            } catch (error) {
                logger.error(`加入协同失败: ${error}`);
                vscode.window.showErrorMessage(`加入协同失败: ${error}`);
            }
        });

        // 停止协同
        this.registerCommand('honeygui.collaboration.stop', async () => {
            const service = CollaborationService.getInstance();
            if (service.isConnected) {
                service.stop();
                vscode.window.showInformationMessage('已停止协同会话');
                this.statusBarManager.updateCollaborationStatus('None');
            }
        });
    }

    /**
     * 注册单个命令的辅助方法
     */
    private registerCommand(commandId: string, callback: (...args: any[]) => any): void {
        const disposable = vscode.commands.registerCommand(commandId, callback);
        this.disposables.push(disposable);
        this.context.subscriptions.push(disposable);
    }

    /**
     * 获取欢迎页面HTML
     */
    private getWelcomeHtml(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HoneyGUI 欢迎</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .feature {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        .feature h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin: 5px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .code {
            background-color: var(--vscode-textPreformat-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍯 HoneyGUI 设计器</h1>
        <p>欢迎使用 HoneyGUI - 专为嵌入式GUI开发设计的可视化设计工具</p>
        
        <div class="feature">
            <h3>🎨 可视化设计</h3>
            <p>拖拽式界面设计，实时预览，让GUI开发变得简单直观</p>
        </div>
        
        <div class="feature">
            <h3>📱 专为嵌入式优化</h3>
            <p>针对HoneyGUI框架优化，生成高效的C++代码</p>
        </div>
        
        <div class="feature">
            <h3>⚡ 快速开始</h3>
            <p>使用命令面板 <span class="code">Ctrl+Shift+P</span> 搜索 <span class="code">HoneyGUI</span> 开始创建项目</p>
        </div>
        
        <div class="feature">
            <h3>📖 文档与支持</h3>
            <p>查看文档了解更多功能和使用技巧</p>
        </div>
        
        <button class="button" onclick="vscode.postMessage({command: 'createProject'})">创建新项目</button>
        <button class="button" onclick="vscode.postMessage({command: 'openDocumentation'})">查看文档</button>
    </div>
</body>
</html>`;
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}
