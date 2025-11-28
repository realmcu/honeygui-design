import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TemplateManager } from '../template/TemplateManager';
import { HmlTemplateManager } from '../hml/HmlTemplateManager';
import { WebviewUtils } from '../common/WebviewUtils';
import { logger } from '../utils/Logger';

/**
 * 项目创建面板管理类
 */
export class CreateProjectPanel {
    public static currentPanel: CreateProjectPanel | undefined;
    public static readonly viewType = 'honeyguiCreateProject';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private readonly _templateManager: TemplateManager;

    /**
     * 创建或获取现有的项目创建面板
     */
    public static createOrShow(context: vscode.ExtensionContext): CreateProjectPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已有面板，则显示并返回
        if (CreateProjectPanel.currentPanel) {
            CreateProjectPanel.currentPanel._panel.reveal(column);
            return CreateProjectPanel.currentPanel;
        }

        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            CreateProjectPanel.viewType,
            'Create application',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'designer'),
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'designer')
                ]
            }
        );

        CreateProjectPanel.currentPanel = new CreateProjectPanel(panel, context);
        return CreateProjectPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;
        this._templateManager = new TemplateManager(context);

        // 设置Webview内容
        this._update();

        // 处理面板关闭事件
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 处理面板可见性变化
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // 处理来自Webview的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'selectFolder':
                        await this._selectProjectFolder();
                        break;
                    case 'selectSdkPath':
                        await this._selectSdkPath();
                        break;
                    case 'createProject':
                        await this._createProject(message.config);
                        break;
                    case 'notify':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * 更新Webview内容
     */
    private _update(): void {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    /**
     * 获取Webview的HTML内容
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this._getNonce();
        const homeDir = require('os').homedir();
        
        // 读取 HTML 模板
        const templatePath = path.join(this._extensionUri.fsPath, 'src', 'designer', 'templates', 'createProject.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // 替换模板变量
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{homeDir\}\}/g, homeDir);
        
        return html;
    }
        

    /**
     * 生成随机nonce值
     */
    // 使用WebviewUtils中的方法替代原有的_getNonce
    private _getNonce(): string {
        return WebviewUtils.generateNonce();
    }

    /**
     * 选择项目文件夹
     */
    private async _selectProjectFolder(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select project location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'folderSelected',
                    folderPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择文件夹失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select folder');
        }
    }
    
    /**
     * 选择 HoneyGUI SDK 路径
     */
    private async _selectSdkPath(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select HoneyGUI SDK location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'sdkPathSelected',
                    sdkPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择 SDK 路径失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select SDK path');
        }
    }

    /**
     * 创建项目
     */
    private async _createProject(config: any): Promise<void> {
        try {
            const { projectName, saveLocation, appId, resolution, minSdk, pixelMode, honeyguiSdkPath } = config;

            // 记录日志用于调试
            logger.info(`[CreateProjectPanel] Creating project: projectName=${projectName}, saveLocation=${saveLocation}, appId=${appId}, sdkPath=${honeyguiSdkPath}`);

            // 设置默认 SDK 路径
            const sdkPath = honeyguiSdkPath || path.join(require('os').homedir(), '.HoneyGUI-SDK');
            logger.info(`[CreateProjectPanel] Using SDK path: ${sdkPath}`);

            // 验证必填字段
            if (!projectName || !saveLocation || !appId) {
                logger.error('[CreateProjectPanel] Validation failed: Missing required fields');
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '请填写所有必填字段 (项目名称、保存位置、APP ID)'
                });
                return;
            }

            // 验证项目名称格式
            const invalidChars = /[<>:*"?|\\/]/;
            if (invalidChars.test(projectName)) {
                logger.error(`[CreateProjectPanel] Invalid project name: ${projectName}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '项目名称包含非法字符，不能包含: < > : * " ? | \\ /'
                });
                return;
            }

            const projectPath = path.join(saveLocation, projectName);
            logger.info(`[CreateProjectPanel] Full project path: ${projectPath}`);

            // 检查项目路径是否已存在（增强检测）
            try {
                if (fs.existsSync(projectPath)) {
                    const stats = fs.statSync(projectPath);
                    if (stats.isDirectory()) {
                        logger.error(`[CreateProjectPanel] Project directory already exists: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `项目已存在: "${projectName}"\n\n目录 "${projectPath}" 已存在。\n\n请选择其他名称或删除现有项目。`
                        });
                        return;
                    } else {
                        logger.error(`[CreateProjectPanel] Path exists but is not a directory: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `无法创建项目: "${projectPath}" 已存在且不是一个目录`
                        });
                        return;
                    }
                }
            } catch (error) {
                logger.error(`[CreateProjectPanel] Error checking path existence: ${error}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: `检查项目路径时出错: ${error instanceof Error ? error.message : '未知错误'}`
                });
                return;
            }
            
            // 显示创建中消息
            vscode.window.showInformationMessage(`Creating project: ${projectName}...`);
            
            // 创建项目结构
            await this._createProjectStructure(projectPath, projectName, appId, resolution, minSdk, pixelMode, honeyguiSdkPath);
            
            // 显示成功消息
            this._panel.webview.postMessage({
                command: 'notify',
                text: `Project created successfully: ${projectPath}`
            });
            
            // 在打开文件夹前，将项目信息保存到全局存储
            // 这样即使在扩展重新加载后，我们也能知道需要激活哪个项目
            await this._context.globalState.update('pendingProjectActivation', {
                projectPath: projectPath,
                projectName: projectName,
                timestamp: Date.now()
            });

            // 自动打开项目文件夹
            // 注意：这会导致VSCode重新加载扩展，当前上下文将失效
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);

            // 注意：代码执行到这里，扩展会被重新加载
            // 实际的激活逻辑将在 extension.ts 的 activate 函数中处理
            // 通过检查 globalState 中的 pendingProjectActivation
            
            // 关闭Webview
            this.dispose();
            
        } catch (error) {
            logger.error(`创建项目失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'error',
                text: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    /**
     * 创建项目结构
     */
    private async _createProjectStructure(
        projectPath: string,
        projectName: string,
        appId: string,
        resolution: string,
        minSdk: string,
        pixelMode: string,
        honeyguiSdkPath?: string
    ): Promise<void> {
        // 创建目录结构
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui', 'main'), { recursive: true }); // 创建 ui/main 目录
        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

        // 使用HmlTemplateManager生成文件内容
        // 创建 {ProjectName}Main.hml 文件（包含 screen 容器）
        const hmlFileName = `${projectName}Main.hml`;
        const mainHmlContent = HmlTemplateManager.generateMainHml(
            projectName,
            resolution,
            appId,
            minSdk,
            pixelMode
        );
        fs.writeFileSync(path.join(projectPath, 'ui', 'main', hmlFileName), mainHmlContent, 'utf8');

        // 创建README文件
        const readmeContent = HmlTemplateManager.generateReadme(
            projectName,
            appId,
            resolution
        );
        fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

        // 创建 project.json 项目配置文件
        const projectConfig = {
            name: projectName,
            appId: appId,
            version: '1.0.0',
            resolution: resolution,
            minSdk: minSdk,
            pixelMode: pixelMode,
            mainHmlFile: `ui/main/${hmlFileName}`, // 使用新的文件名
            honeyguiSdkPath: honeyguiSdkPath || path.join(require('os').homedir(), '.HoneyGUI-SDK'),
            created: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(projectPath, 'project.json'),
            JSON.stringify(projectConfig, null, 2),
            'utf8'
        );

        // 拷贝 HoneyGUI SDK 文件到项目
        const sdkPath = honeyguiSdkPath || path.join(require('os').homedir(), '.HoneyGUI-SDK');

        // 拷贝 win32_sim 目录到 src
        const win32SimSource = path.join(sdkPath, 'win32_sim');
        const win32SimDest = path.join(projectPath, 'src', 'win32_sim');
        if (fs.existsSync(win32SimSource)) {
            this._copyDirectory(win32SimSource, win32SimDest);
            logger.info(`[CreateProjectPanel] Copied win32_sim`);
        } else {
            logger.warn(`[CreateProjectPanel] win32_sim not found at ${win32SimSource}`);
        }

        // 拷贝 tool 目录到 src
        const toolSource = path.join(sdkPath, 'tool');
        const toolDest = path.join(projectPath, 'src', 'tool');
        if (fs.existsSync(toolSource)) {
            this._copyDirectory(toolSource, toolDest);
            logger.info(`[CreateProjectPanel] Copied tool`);
        } else {
            logger.warn(`[CreateProjectPanel] tool not found at ${toolSource}`);
        }

        // 拷贝 realgui 目录到 src
        const realguiSource = path.join(sdkPath, 'realgui');
        const realguiDest = path.join(projectPath, 'src', 'realgui');
        if (fs.existsSync(realguiSource)) {
            this._copyDirectory(realguiSource, realguiDest);
            logger.info(`[CreateProjectPanel] Copied realgui`);
        } else {
            logger.warn(`[CreateProjectPanel] realgui not found at ${realguiSource}`);
        }
    }

    /**
     * 递归拷贝目录
     */
    private _copyDirectory(source: string, destination: string): void {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                this._copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        CreateProjectPanel.currentPanel = undefined;
        
        // 清理Webview面板
        this._panel.dispose();
        
        // 清理所有一次性资源
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
