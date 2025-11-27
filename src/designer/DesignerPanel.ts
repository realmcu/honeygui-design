import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { Component } from '../hml/types';
import { generateHoneyGuiCode, CodeGenOptions } from '../codegen/honeygui';
import { WebviewUtils } from '../common/WebviewUtils';
import { ProjectConfigLoader } from '../utils/ProjectConfigLoader';
import { HmlContentComparator } from '../utils/HmlContentComparator';
import { SaveManager } from './SaveManager';

/**
 * 设计器Webview面板管理类
 */
export class DesignerPanel {
    public static currentPanel: DesignerPanel | undefined;
    public static readonly viewType = 'honeyguiDesigner';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private readonly _hmlController: HmlController;
    private readonly _saveManager: SaveManager;
    private _filePath: string | undefined;
    private _lastSerializedSnapshot: string | null = null;

    /**
     * 获取当前的保存事务ID
     * @returns 当前事务ID（0表示没有正在进行的保存操作）
     */
    public getSaveTransactionId(): number {
        return this._saveManager.getCurrentTransactionId();
    }

    /**
     * 判断是否正在保存
     */
    public get isSaving(): boolean {
        return this._saveManager.isInTransaction();
    }

    /**
     * 创建或获取现有的设计器面板
     */
    public static createOrShow(context: vscode.ExtensionContext, filePath?: string): DesignerPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已有面板，则显示并返回
        if (DesignerPanel.currentPanel) {
            DesignerPanel.currentPanel._panel.reveal(column);

            // 如果提供了文件路径，加载该文件
            if (filePath) {
                DesignerPanel.currentPanel._loadFile(filePath);
            }

            return DesignerPanel.currentPanel;
        }

        // 创建新面板
        // 计算本地资源根目录，允许webview访问扩展资源与项目assets目录
        const localRoots: vscode.Uri[] = [
            vscode.Uri.joinPath(context.extensionUri, 'src', 'designer', 'webview'),
            vscode.Uri.joinPath(context.extensionUri, 'out', 'designer', 'webview')
        ];
        
        logger.info(`[DesignerPanel] 创建面板，filePath: ${filePath}`);
        
        // 推断项目根目录：从HML文件路径向上查找包含project.json的目录
        let projectRoot: string | undefined;
        if (filePath) {
            projectRoot = ProjectUtils.findProjectRoot(filePath);
            if (projectRoot) {
                logger.info(`[DesignerPanel] 找到项目根目录: ${projectRoot}`);
                localRoots.push(vscode.Uri.file(projectRoot));
            } else {
                logger.warn(`[DesignerPanel] 未能从文件路径找到项目根目录: ${filePath}`);
            }
        }
        
        // 如果没找到project.json，尝试使用workspace
        if (!projectRoot) {
            projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (projectRoot) {
                logger.info(`[DesignerPanel] 使用workspace作为项目根: ${projectRoot}`);
                localRoots.push(vscode.Uri.file(projectRoot));
            } else {
                logger.warn(`[DesignerPanel] 未找到workspace`);
            }
        }
        
        logger.info(`[DesignerPanel] localResourceRoots: ${localRoots.map(r => r.fsPath).join(', ')}`);

        const panel = vscode.window.createWebviewPanel(
            DesignerPanel.viewType,
            'HoneyGUI 设计器',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: localRoots
            }
        );

        DesignerPanel.currentPanel = new DesignerPanel(panel, context);

        // 如果提供了文件路径，加载该文件，否则创建新文档
        if (filePath) {
            DesignerPanel.currentPanel._loadFile(filePath);
        } else {
            DesignerPanel.currentPanel._createNewDocument();
        }

        return DesignerPanel.currentPanel;
    }

    /**
     * 从 TextDocument 构造（用于 CustomTextEditorProvider）
     */
    public constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, document?: vscode.TextDocument) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;
        this._hmlController = new HmlController();
        this._saveManager = new SaveManager(this._hmlController);

        // 如果有文档，设置文件路径
        if (document) {
            this._filePath = document.uri.fsPath;
        }

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
            message => {
                switch (message.command) {
                    case 'ready':
                        logger.info('[DesignerPanel] 收到前端ready消息');
                        try {
                            this.reloadCurrentDocument();
                        } catch (error) {
                            logger.error(`[DesignerPanel] reloadCurrentDocument失败: ${error}`);
                        }
                        break;
                    case 'save':
                        logger.debug(`[HoneyGUI Designer] 收到保存请求，组件数量: ${message?.content?.components?.length || 0}`);
                        try {
                            if (message?.content?.components && Array.isArray(message.content.components)) {
                                logger.debug('[HoneyGUI Designer] 更新组件到HmlController...');
                                this._hmlController.updateFromFrontendComponents(message.content.components);
                                logger.debug(`[HoneyGUI Designer] 组件更新完成，当前文档组件数: ${this._hmlController.currentDocument?.view?.components?.length || 0}`);
                            }
                        } catch (syncErr) {
                            logger.warn(`[HoneyGUI Designer] 前端组件同步失败: ${syncErr}`);
                        }
                        const serializedContent = this._hmlController.serializeDocument();
                        logger.debug(`[HoneyGUI Designer] 序列化完成，内容长度: ${serializedContent.length}`);
                        this._saveHml(message.content?.raw ?? serializedContent);
                        break;
                    case 'selectImagePath':
                        this._handleSelectImagePath(message.componentId);
                        break;
                    case 'preview':
                        this._previewUi(message.content);
                        break;
                    case 'codegen':
                this.generateCode(message.language || 'cpp', message.options, message.content);
                break;
                    case 'generateAllCode':
                        this.generateAllCode();
                        break;
                    case 'loadAssets':
                        this._handleLoadAssets();
                        break;
                    case 'deleteAsset':
                        this._handleDeleteAsset(message.fileName);
                        break;
                    case 'renameAsset':
                        this._handleRenameAsset(message.oldPath, message.newName);
                        break;
                    case 'openAssetsFolder':
                        this._handleOpenAssetsFolder();
                        break;
                    case 'saveImageToAssets':
                        this._handleSaveImageToAssets(
                            message.fileName, 
                            message.fileData, 
                            message.dropPosition, 
                            message.targetContainerId,
                            message.relativePath
                        );
                        break;
                    case 'convertPathToWebviewUri':
                        this._handleConvertPathToWebviewUri(message.path, message.requestId);
                        break;
                    case 'notify':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        break;
                    case 'addComponent':
                        this._handleAddComponent(message.parentId, message.component);
                        break;
                    case 'updateComponent':
                        this._handleUpdateComponent(message.componentId, message.updates);
                        break;
                    case 'deleteComponent':
                        this._handleDeleteComponent(message.componentId);
                        break;
                    case 'loadFile':
                        if (message.filePath) {
                            this._loadFile(message.filePath);
                        }
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
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    /**
     * 获取Webview的HTML内容
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        try {
            // 1. 首先尝试从构建目录加载
            const buildPath = vscode.Uri.joinPath(
                this._extensionUri,
                'out',
                'designer',
                'webview'
            );
            
            // 2. 同时准备源码目录作为备选
            const sourcePath = vscode.Uri.joinPath(
                this._extensionUri,
                'src',
                'designer',
                'webview'
            );
            
            // 3. 确定使用哪个路径
            let htmlPath: vscode.Uri;
            let onDiskPath: vscode.Uri;

            if (fs.existsSync(vscode.Uri.joinPath(buildPath, 'index.html').fsPath)) {
                onDiskPath = buildPath;
                htmlPath = vscode.Uri.joinPath(buildPath, 'index.html');
            } else if (fs.existsSync(vscode.Uri.joinPath(sourcePath, 'index.html').fsPath)) {
                onDiskPath = sourcePath;
                htmlPath = vscode.Uri.joinPath(sourcePath, 'index.html');
            } else {
                // 如果都不存在，使用内置的最小HTML模板
                logger.warn(`[HoneyGUI Designer] 未找到HTML文件，使用内置最小模板`);
                return this._getMinimalHtmlTemplate(webview);
            }

            // 读取HTML文件内容
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // 4. 查找并处理资源文件（JS和CSS）
            let stylesUri: vscode.Uri | undefined;
            let scriptUri: vscode.Uri | undefined;
            
            try {
                if (fs.existsSync(onDiskPath.fsPath)) {
                    const files = fs.readdirSync(onDiskPath.fsPath);
                    
                    // 尝试查找带哈希的文件或普通文件名
                    const jsFile = files.find(f => /^main\..+\.js$/.test(f)) || 
                                  files.find(f => f === 'webview.js') || 
                                  files.find(f => f.endsWith('.js'));
                    
                    const cssFile = files.find(f => /^main\..+\.css$/.test(f)) || 
                                   files.find(f => f === 'styles.css') || 
                                   files.find(f => f.endsWith('.css'));

                    if (jsFile) {
                        scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, jsFile));
                    }
                    
                    if (cssFile) {
                        stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, cssFile));
                    }
                }
            } catch (e) {
                logger.warn(`[HoneyGUI Designer] 无法读取资源文件列表: ${e}`);
            }

            // 5. 替换资源URL
            if (stylesUri) {
                // 删除所有CSS引用并添加正确的Webview URI
                htmlContent = htmlContent.replace(/<link href=".+\.css"[^>]*>/g, '');
                htmlContent = htmlContent.replace('</head>', `<link href="${stylesUri}" rel="stylesheet"></head>`);
            }
            
            if (scriptUri) {
                // 删除所有JS引用并添加正确的Webview URI
                htmlContent = htmlContent.replace(/<script src=".+\.js".*><\/script>/g, '');
                htmlContent = htmlContent.replace('</body>', `<script src="${scriptUri}"></script></body>`);
            }

            logger.debug(`[HoneyGUI Designer] Webview 初始化:`);
            logger.debug(`  使用路径: ${onDiskPath.toString()}`);
            if (stylesUri) logger.debug(`  Styles: ${stylesUri.toString()}`);
            if (scriptUri) logger.debug(`  Script: ${scriptUri.toString()}`);

            // 6. 添加CSP meta标签（严格的CSP策略）
            // 注意：移除了 'unsafe-eval'，React 生产构建不需要它
            // style-src 仍需要 'unsafe-inline'，因为 React 可能会动态注入样式
            const nonce = this._getNonce();
            const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: vscode-resource: vscode-webview-resource:; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource};">`;

            // 将 nonce 添加到 script 标签（如果有）
            if (scriptUri) {
                htmlContent = htmlContent.replace(
                    /<script([^>]*)src=\"([^\"]+)\"([^>]*)><\/script>/g,
                    `<script$1src="$2"$3 nonce="${nonce}"></script>`
                );
            }

            // 确保CSP标签被添加，如果已经有则替换
            if (htmlContent.includes('<meta http-equiv="Content-Security-Policy"')) {
                htmlContent = htmlContent.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, cspMetaTag);
            } else {
                htmlContent = htmlContent.replace('</head>', `${cspMetaTag}</head>`);
            }

            return htmlContent;
        } catch (error) {
            logger.error(`[HoneyGUI Designer] 加载HTML内容时出错: ${error}`);
            
            // 无论发生什么错误，都返回最小可用的HTML模板
            return this._getMinimalHtmlTemplate(webview, error instanceof Error ? error.message : '未知错误');
        }
    }
    
    /**
     * 获取最小化的HTML模板，作为最后的回退方案
     */
    private _getMinimalHtmlTemplate(webview: vscode.Webview, errorMessage?: string): string {
        const nonce = this._getNonce();
        const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">`;
        
        return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HoneyGUI 设计器</title>
            ${cspMetaTag}
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    min-height: 100vh;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #252526;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #007acc;
                    margin-top: 0;
                }
                .message {
                    margin: 20px 0;
                    padding: 15px;
                    border-radius: 4px;
                    background-color: #1e1e1e;
                }
                .error {
                    border-left: 4px solid #f44336;
                    color: #f87474;
                }
                .info {
                    border-left: 4px solid #007acc;
                }
                button {
                    background-color: #007acc;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background-color: #005a9e;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>HoneyGUI 设计器</h1>
                ${errorMessage ? 
                    `<div class="message error">
                        <strong>加载警告:</strong> ${errorMessage}<br>
                        <strong>解决方案:</strong> 请确保已正确构建项目。尝试运行: <code>npm run build</code>
                    </div>` : 
                    '<div class="message info">设计器基础界面已加载。部分高级功能可能不可用。</div>'
                }
                <div class="message">
                    <p>基础功能可用。您可以尝试:</p>
                    <ul>
                        <li>创建新的HML文档</li>
                        <li>保存设计内容</li>
                        <li>与VSCode扩展通信</li>
                    </ul>
                </div>
                <button onclick="sendMessage('save', {content: '<?xml version=\"1.0\" encoding=\"UTF-8\"?><hml><hg_screen id=\"mainScreen\"></hg_screen></hml>'});">测试保存</button>
            </div>
            
            <script nonce="${nonce}">
                // 基础的VSCode消息通信功能
                const vscode = acquireVsCodeApi();

                function sendMessage(command, data) {
                    vscode.postMessage({
                        command: command,
                        ...data
                    });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log("[Webview] VSCode message:", JSON.stringify(message));
                });
            </script>
        </body>
        </html>
        `;
    }

    /**
     * 获取默认HTML内容（错误提示页面）
     * 注意：此方法仅在无法加载编译后的React bundle时调用
     */
    private _getDefaultHtmlContent(webview: vscode.Webview, errorMessage?: string): string {
        const errorDetails = errorMessage || '无法加载设计器界面';

        return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HoneyGUI 设计器 - 加载失败</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    justify-content: center;
                    align-items: center;
                }
                .error-container {
                    max-width: 600px;
                    padding: 40px;
                    text-align: center;
                }
                .error-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                .error-title {
                    font-size: 24px;
                    font-weight: 500;
                    margin-bottom: 15px;
                    color: #f87474;
                }
                .error-message {
                    font-size: 14px;
                    line-height: 1.6;
                    color: #969696;
                    margin-bottom: 30px;
                }
                .error-details {
                    background-color: #252526;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 30px;
                    text-align: left;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #ce9178;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .solution {
                    background-color: #252526;
                    border-left: 4px solid #007acc;
                    padding: 20px;
                    border-radius: 4px;
                    text-align: left;
                }
                .solution-title {
                    font-size: 16px;
                    font-weight: 500;
                    margin-bottom: 10px;
                    color: #007acc;
                }
                .solution-step {
                    font-size: 13px;
                    margin-bottom: 8px;
                    line-height: 1.5;
                }
                .code-block {
                    background-color: #1e1e1e;
                    border: 1px solid #3e3e42;
                    border-radius: 3px;
                    padding: 8px 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #d4d4d4;
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">设计器加载失败</div>
                <div class="error-message">
                    无法加载 HoneyGUI 设计器界面。这通常是因为编译后的 React bundle 文件缺失或损坏。
                </div>
                <div class="error-details">${errorDetails}</div>
                <div class="solution">
                    <div class="solution-title">解决方案：</div>
                    <div class="solution-step">
                        1. 确保已运行编译命令：<span class="code-block">npm run compile</span>
                    </div>
                    <div class="solution-step">
                        2. 确保已构建 Webview：<span class="code-block">npm run build:webview</span>
                    </div>
                    <div class="solution-step">
                        3. 检查文件是否存在：<span class="code-block">out/designer/webview/index.html</span>
                    </div>
                    <div class="solution-step">
                        4. 重新打包扩展：<span class="code-block">vsce package</span>
                    </div>
                    <div class="solution-step">
                        5. 在 VSCode 输出面板查看"扩展主机"日志获取详细错误信息
                    </div>
                </div>
            </div>
        </body>
        </html>`;
    }

    /**
     * 生成随机nonce值
     */
    private _getNonce(): string {
        return WebviewUtils.generateNonce();
    }

    /**
     * 保存HML内容
     * 使用SaveManager处理保存逻辑
     */
    private async _saveHml(content: string): Promise<void> {
        try {
            logger.info('[DesignerPanel] 开始保存HML文件');

            // 保存当前序列化快照（用于后续对比）
            this._lastSerializedSnapshot = content;

            if (!this._filePath) {
                logger.info('[DesignerPanel] 没有文件路径，提示用户选择保存位置');

                // 提示用户选择保存位置
                const selectedPath = await this._saveManager.promptSaveLocation(content);
                if (selectedPath) {
                    this._filePath = selectedPath;

                    // 更新面板标题
                    const fileName = path.basename(selectedPath);
                    this._panel.title = `HoneyGUI 设计器 - ${fileName}`;
                } else {
                    logger.info('[DesignerPanel] 用户取消保存');
                    return;
                }
            }

            // 执行保存
            const filePath = this._filePath;
            if (!filePath) {
                throw new Error('文件路径无效');
            }

            const transactionId = this._saveManager.beginTransaction(filePath, content);
            logger.debug(`[DesignerPanel] 保存事务ID: ${transactionId}`);

            await this._saveManager.executeSave(filePath, content, transactionId);

            logger.info(`[DesignerPanel] 保存成功: ${path.basename(filePath)}`);

        } catch (error) {
            logger.error(`[DesignerPanel] 保存失败: ${error}`);
            vscode.window.showErrorMessage(`保存文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 提示用户选择保存位置（已弃用，由SaveManager处理）
     * @deprecated 使用SaveManager.promptSaveLocation替代
     */
    private async _promptSaveLocation(content?: string): Promise<boolean> {
        logger.warn('[DesignerPanel] _promptSaveLocation 已弃用，将由SaveManager处理');
        try {
            const selectedPath = await this._saveManager.promptSaveLocation(content || '');
            if (selectedPath) {
                this._filePath = selectedPath;
                const fileName = path.basename(selectedPath);
                this._panel.title = `HoneyGUI 设计器 - ${fileName}`;
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[DesignerPanel] 保存位置选择失败: ${error}`);
            return false;
        }
    }

    /**
     * 统一的发送 loadHml 消息方法
     * 负责发送组件数据和项目配置到前端
     */
    private sendLoadHmlMessage(hmlDocument: any, hmlContent: string): void {
        const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
        
        const projectConfig = ProjectConfigLoader.loadConfig(this._filePath!);
        const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
        
        // 获取项目根目录，用于前端转换相对路径
        const projectRoot = ProjectUtils.findProjectRoot(this._filePath!);
        
        this._panel.webview.postMessage({
            command: 'loadHml',
            content: hmlContent,
            document: {
                ...hmlDocument,
                view: {
                    ...hmlDocument.view,
                    components: frontendComponents
                }
            },
            components: frontendComponents,
            projectConfig: projectConfig,
            designerConfig: designerConfig || { canvasBackgroundColor: '#f0f0f0' },
            projectRoot: projectRoot // 发送项目根目录给前端
        });
    }

    /**
     * 处理转换路径为 webview URI 的请求
     */
    private _handleConvertPathToWebviewUri(relativePath: string, requestId: string): void {
        try {
            if (!this._filePath) {
                this._panel.webview.postMessage({
                    command: 'webviewUriConverted',
                    requestId,
                    uri: relativePath,
                    error: '没有文件路径'
                });
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                this._panel.webview.postMessage({
                    command: 'webviewUriConverted',
                    requestId,
                    uri: relativePath,
                    error: '未找到项目根目录'
                });
                return;
            }

            // 转换相对路径为绝对路径
            const absolutePath = path.join(projectRoot, relativePath);
            const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));

            this._panel.webview.postMessage({
                command: 'webviewUriConverted',
                requestId,
                uri: webviewUri.toString()
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'webviewUriConverted',
                requestId,
                uri: relativePath,
                error: error instanceof Error ? error.message : '转换失败'
            });
        }
    }

    /**
     * 转换组件中的相对路径为 webview URI
     * @deprecated 不再使用，前端动态转换
     */
    private convertImagePathsToWebviewUri(components: any[]): any[] {
        if (!this._filePath) {
            logger.warn('[convertImagePaths] 没有文件路径');
            return components;
        }

        const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
        if (!projectRoot) {
            logger.warn('[convertImagePaths] 未找到项目根目录');
            return components;
        }

        logger.info(`[convertImagePaths] 项目根目录: ${projectRoot}`);
        logger.info(`[convertImagePaths] 组件数量: ${components.length}`);

        return components.map(comp => {
            if (comp.type === 'hg_image' && comp.data?.src) {
                const src = comp.data.src;
                logger.info(`[convertImagePaths] 处理图片组件: ${comp.id}, 原始路径: ${src}`);
                
                // 如果是相对路径，转换为绝对路径再转为 webview URI
                if (!src.startsWith('http') && !src.startsWith('vscode-resource')) {
                    const absolutePath = path.join(projectRoot, src);
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));
                    logger.info(`[convertImagePaths] 绝对路径: ${absolutePath}`);
                    logger.info(`[convertImagePaths] webview URI: ${webviewUri.toString()}`);
                    
                    return {
                        ...comp,
                        data: {
                            ...comp.data,
                            src: webviewUri.toString()
                        }
                    };
                } else {
                    logger.info(`[convertImagePaths] 跳过转换（已是完整URL）`);
                }
            }
            return comp;
        });
    }
    
    /**
 * 加载文件
 */
private async _loadFile(filePath: string): Promise<void> {
    this._filePath = filePath;
    
    try {
        // 使用HML控制器加载文件
        const document = await this._hmlController.loadFile(filePath);
        
        // 序列化文档为字符串
        const hmlContent = this._hmlController.serializeDocument();
        
        logger.debug(`[HoneyGUI Designer] 设计器配置加载中...`);

        // 发送HML内容和配置信息到Webview
        this.sendLoadHmlMessage(document, hmlContent);
            
        // 更新面板标题
        const fileName = path.basename(filePath);
        this._panel.title = `HoneyGUI 设计器 - ${fileName}`;
            
    } catch (error) {
        logger.error(`加载HML文件失败: ${error}`);
        vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        
        // 如果加载失败，创建一个新的空白文档
        this._createNewDocument();
    }
}
    
    /**
 * 创建新的空白文档
 */
private _createNewDocument(): void {
    try {
        // 创建新的HML文档
        const document = this._hmlController.createNewDocument();

        // 序列化文档为字符串
        const hmlContent = this._hmlController.serializeDocument();
        
        // 为前端准备组件数据
        const frontendComponents = this._hmlController.prepareComponentsForFrontend(document);

        // 使用统一的配置加载器
        const projectConfig = ProjectConfigLoader.loadConfig();
        const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
        
        // 从 project.json 获取画布背景色，默认灰色
        const canvasBackgroundColor = designerConfig?.canvasBackgroundColor || '#f0f0f0';

        // 发送HML内容和配置到Webview
        this._panel.webview.postMessage({
            command: 'loadHml',
            content: hmlContent,
            document: {
                ...document,
                view: {
                    ...document.view,
                    components: frontendComponents
                }
            },
            components: frontendComponents,
            projectConfig: projectConfig,
            designerConfig: designerConfig
        });

            // 更新面板标题
            this._panel.title = 'HoneyGUI 设计器 - 未命名';
            this._filePath = undefined;

        } catch (error) {
            logger.error(`创建新文档失败: ${error}`);
            vscode.window.showErrorMessage(`创建新文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 从 TextDocument 加载内容（用于 CustomTextEditorProvider）
     */
    public async loadFromDocument(document: vscode.TextDocument): Promise<void> {
        this._filePath = document.uri.fsPath;

        logger.info(`[DesignerPanel] loadFromDocument: 开始加载文件 ${this._filePath}`);

        try {
            const content = document.getText();
            logger.debug(`[DesignerPanel] 文件内容长度: ${content.length} 字符`);

            // 解析文档内容
            logger.debug(`[DesignerPanel] 解析HML内容...`);
            const hmlDocument = this._hmlController.parseContent(content);
            logger.info(`[DesignerPanel] 解析完成，获得 ${hmlDocument.view?.components?.length || 0} 个组件`);

            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();
            logger.debug(`[DesignerPanel] 序列化完成，内容长度: ${hmlContent.length}`);

            // 为前端准备组件数据
            logger.debug(`[DesignerPanel] 准备前端组件数据...`);
            const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
            logger.info(`[DesignerPanel] 前端组件数据准备完成，共 ${frontendComponents.length} 个组件`);

            // 使用统一的配置加载器
            const projectConfig = ProjectConfigLoader.loadConfig(document.uri.fsPath);
            const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
            logger.debug(`[DesignerPanel] 项目配置加载完成`);

            // 发送内容到 Webview（不延迟，由前端ready消息触发重新加载）
            logger.info(`[DesignerPanel] 初始loadHml准备完成，等待前端ready消息`);
            // 不立即发送，等待前端ready

            // 更新面板标题
            const fileName = path.basename(document.fileName);
            this._panel.title = `HoneyGUI Designer: ${fileName}`;
            logger.info(`[DesignerPanel] 文件加载完成并发送到前端: ${fileName}`);

        } catch (error) {
            logger.error(`从文档加载HML失败: ${error}`);
            vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);

            // 如果加载失败，创建一个新的空白文档
            this._createNewDocument();
        }
    }

    /**
     * 从文档更新内容（当文档在外部被修改时）
     */
    public async updateFromDocument(): Promise<void> {
        // 如果正在保存事务中，不执行更新（避免我们自己的保存操作触发重新加载）
        if (this.getSaveTransactionId() > 0) {
            logger.debug('[DesignerPanel] 正在保存事务中，跳过updateFromDocument');
            return;
        }

        if (this._filePath) {
            try {
                logger.debug(`[DesignerPanel] updateFromDocument: 重新加载文件 ${this._filePath}`);
                const document = await vscode.workspace.openTextDocument(this._filePath);
                const diskContent = document.getText();
                
                // 使用智能内容对比机制
                if (this._lastSerializedSnapshot) {
                    const comparison = HmlContentComparator.smartCompare(
                        diskContent,
                        this._lastSerializedSnapshot
                    );
                    
                    if (comparison.isEqual) {
                        logger.debug('[DesignerPanel] 智能对比：保存后的内容与内存一致，跳过重载');
                        logger.debug(`[DesignerPanel] 对比详情: ${comparison.reason}`);
                        // 清空快照，避免后续误匹配
                        this._lastSerializedSnapshot = null;
                        return;
                    } else {
                        logger.debug('[DesignerPanel] 智能对比：文件内容发生变化');
                        logger.debug(`[DesignerPanel] 差异原因: ${comparison.reason}`);
                    }
                } else {
                    logger.debug('[DesignerPanel] 无快照，直接加载文件内容');
                }
                
                logger.debug('[DesignerPanel] 重新加载到设计器');
                await this.loadFromDocument(document);
            } catch (error) {
                logger.error(`更新文档失败: ${error}`);
            }
        }
    }

    /**
     * 预览UI
     */
    private async _previewUi(content: string): Promise<void> {
        try {
            // 解析HML内容
            this._hmlController.parseContent(content);
            
            // TODO: 实现预览逻辑
            vscode.window.showInformationMessage('预览功能开发中...');
        } catch (error) {
            logger.error(`预览失败: ${error}`);
            vscode.window.showErrorMessage(`预览失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 生成代码
     */
    public async generateCode(language: 'cpp' | 'c' = 'cpp', options?: Partial<CodeGenOptions>, content?: string): Promise<void> {
        try {
            // 确保当前设计已保存
            if (!this._filePath) {
                const saveFirst = await vscode.window.showInformationMessage(
                    '请先保存当前设计，然后再生成代码',
                    '保存',
                    '取消'
                );

                if (saveFirst === '保存') {
                    const saved = await this._promptSaveLocation();
                        if (!saved) {
                            return;
                        }
                } else {
                    return;
                }
            }

            // 查找项目根目录
            const projectRoot = ProjectUtils.findProjectRoot(this._filePath!);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录（project.json）');
                return;
            }
            
            const config = ProjectUtils.loadProjectConfig(projectRoot);
            const uiDir = ProjectUtils.getUiDir(projectRoot);
            const relativePath = path.relative(uiDir, this._filePath!);
            
            // 检查是否在ui目录下
            if (relativePath.startsWith('..')) {
                vscode.window.showErrorMessage(`HML文件必须在${config.uiDir || 'ui'}目录下`);
                return;
            }
            
            // 提取设计稿目录名：main/main.hml -> main
            const pathParts = relativePath.split(path.sep);
            if (pathParts.length < 2) {
                vscode.window.showErrorMessage(`HML文件路径格式不正确，应为 ${config.uiDir}/设计稿名/设计稿名.hml`);
                return;
            }
            
            const designName = pathParts[0];
            const srcDir = ProjectUtils.getSrcDir(projectRoot);
            const outputDir = path.join(srcDir, 'autogen', designName);

            // 准备代码生成选项
            const hmlFileName = path.basename(this._filePath || 'HoneyGUIApp', '.hml');
            const generatorOptions: CodeGenOptions = {
                outputDir,
                hmlFileName,
                enableProtectedAreas: true,
                ...options
            };

            const genResult = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在生成${language.toUpperCase()}代码...`,
                    cancellable: true
                },
                async (progress, token) => {
                    token.onCancellationRequested(() => {
                        throw new Error('代码生成已取消');
                    });

                    // 更新进度
                    progress.report({ increment: 10, message: '准备生成器...' });

                    // 确保模型已同步
                    if (content) {
                        this._hmlController.parseContent(content);
                    } else if (this._filePath) {
                        await this._hmlController.loadFile(this._filePath);
                    }

                    progress.report({ increment: 30, message: '创建代码生成器...' });

                    progress.report({ increment: 50, message: '生成代码文件...' });

                    const components = this._hmlController.currentDocument?.view.components || [];
                    const result = await generateHoneyGuiCode(components as any, generatorOptions);

                    progress.report({ increment: 90, message: '完成代码生成...' });

                    return result;
                }
            );

            if ((genResult as any).success) {
                // 显示成功消息
                const generatedFiles = (genResult as any).files || [];
                const message = `成功生成${language.toUpperCase()}代码文件（${generatedFiles.length}个文件）`;
                vscode.window.showInformationMessage(message);

                // 询问是否打开生成的文件
                const openFiles = await vscode.window.showInformationMessage(
                    '是否要在编辑器中打开生成的主要文件？',
                    '打开',
                    '取消'
                );

                if (openFiles === '打开' && generatedFiles.length > 0) {
                    // 打开第一个生成的文件（通常是主文件）
                    const mainFile = generatedFiles.find((file: string) => 
                        file.includes('Application') || file.includes('main') || file.includes('Window')
                    ) || generatedFiles[0];

                    const document = await vscode.workspace.openTextDocument(mainFile);
                    await vscode.window.showTextDocument(document);
                }
            } else {
                // 显示错误消息
                const errors = (genResult as any).errors;
                vscode.window.showErrorMessage(`代码生成失败: ${errors && errors.length ? errors[0] : '未知错误'}`);
            }

            // 如果有警告，显示警告
            if ((genResult as any).warnings && (genResult as any).warnings.length > 0) {
                for (const warning of (genResult as any).warnings) {
                    vscode.window.showWarningMessage(`警告: ${warning}`);
                }
            }

        } catch (error) {
            logger.error(`代码生成错误: ${error}`);
            vscode.window.showErrorMessage(`代码生成过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 生成所有设计稿的代码
     */
    public async generateAllCode(): Promise<void> {
        try {
            if (!this._filePath) {
                vscode.window.showErrorMessage('未找到当前文件路径');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const generator = new (await import('../services/BatchCodeGenerator')).BatchCodeGenerator();
            
            // 先扫描文件
            const hmlFiles = await generator.scanHmlFiles(projectRoot);
            if (hmlFiles.length === 0) {
                vscode.window.showInformationMessage('未找到任何HML文件');
                return;
            }

            // 执行批量生成
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: '正在生成所有设计稿的代码...',
                    cancellable: false
                },
                async (progress) => {
                    return await generator.generateAll(projectRoot, (prog) => {
                        progress.report({
                            increment: 100 / prog.total,
                            message: `正在生成 ${prog.designName} (${prog.current}/${prog.total})...`
                        });
                    });
                }
            );

            // 显示结果
            if (result.success) {
                vscode.window.showInformationMessage(
                    `成功生成 ${result.successCount} 个设计稿的代码，共 ${result.totalFiles} 个文件`
                );
            } else {
                const errorMsg = result.errors.map(e => `${e.designName}: ${e.error}`).join('\n');
                vscode.window.showWarningMessage(
                    `生成完成，成功 ${result.successCount} 个，失败 ${result.errors.length} 个`,
                    '查看详情'
                ).then(selection => {
                    if (selection === '查看详情') {
                        vscode.window.showErrorMessage(errorMsg, { modal: true });
                    }
                });
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            logger.error(`批量代码生成错误: ${errorMsg}`);
            vscode.window.showErrorMessage(`批量生成失败: ${errorMsg}`);
        }
    }
    
    /**
     * 处理添加组件的请求
     */
    private _handleAddComponent(parentId: string, componentData: Omit<Component, 'id'>): void {
        try {
            const newComponent = this._hmlController.addComponent({...componentData, id: `${componentData.type}_${Date.now()}`, parent: parentId || null} as Component);
            
            if (newComponent) {
                // 通知Webview组件已添加成功
                this._panel.webview.postMessage({
                    command: 'componentAdded',
                    component: newComponent,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentAdded',
                    success: false,
                    error: '未找到父组件'
                });
            }
        } catch (error) {
            logger.error(`添加组件失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'componentAdded',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }
    
    /**
     * 处理更新组件的请求
     */
    private _handleUpdateComponent(componentId: string, updates: any): void {
        try {
            const updatedComponent = this._hmlController.updateComponent(componentId, updates);
            
            if (updatedComponent) {
                // 通知Webview组件已更新成功
                this._panel.webview.postMessage({
                    command: 'componentUpdated',
                    component: updatedComponent,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentUpdated',
                    success: false,
                    error: '未找到组件'
                });
            }
        } catch (error) {
            logger.error(`更新组件失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'componentUpdated',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }
    
    /**
     * 处理删除组件的请求
     */
    private _handleDeleteComponent(componentId: string): void {
        try {
            const success = this._hmlController.deleteComponent(componentId);
            
            if (success) {
                // 通知Webview组件已删除成功
                this._panel.webview.postMessage({
                    command: 'componentDeleted',
                    componentId,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentDeleted',
                    success: false,
                    error: '未找到组件'
                });
            }
        } catch (error) {
            logger.error(`删除组件失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'componentDeleted',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }

    /**
     * 清理资源
     */
    /**
     * 获取当前的HML文档
     */
    public get currentDocument() {
        return this._hmlController.currentDocument;
    }
    
    /**
     * 获取当前的文件路径
     */
    public get currentFilePath() {
        return this._filePath;
    }
    
    /**
     * 向Webview发送消息
     */
    public sendMessage(command: string, data?: any): void {
        this._panel.webview.postMessage({ command, ...data });
    }
    
    private reloadCurrentDocument(): void {
        try {
            if (!this._filePath) {
                logger.warn('[DesignerPanel] reloadCurrentDocument: 没有文件路径');
                return;
            }
            
            const hmlDocument = this._hmlController.currentDocument;
            if (!hmlDocument) {
                logger.warn('[DesignerPanel] reloadCurrentDocument: 没有当前文档');
                return;
            }
            
            const hmlContent = this._hmlController.serializeDocument();
            
            logger.info(`[DesignerPanel] 重新发送loadHml，组件数: ${hmlDocument.view?.components?.length || 0}`);
            
            // 使用统一的发送方法
            this.sendLoadHmlMessage(hmlDocument, hmlContent);
        } catch (error) {
            logger.error(`[DesignerPanel] reloadCurrentDocument失败: ${error}`);
        }
    }

    /**
     * 处理选择图片路径
     */
    private async _handleSelectImagePath(componentId: string): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp']
                },
                openLabel: '选择图片'
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri.length > 0) {
                const filePath = fileUri[0].fsPath;
                
                // 获取工作区路径
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                let relativePath = filePath;
                
                if (workspaceFolder) {
                    // 转换为相对路径
                    relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
                    // 统一使用正斜杠
                    relativePath = relativePath.replace(/\\/g, '/');
                }
                
                // 发送路径到webview
                this._panel.webview.postMessage({
                    command: 'updateImagePath',
                    componentId: componentId,
                    path: relativePath
                });
                
                logger.info(`[DesignerPanel] 选择图片路径: ${relativePath}`);
            }
        } catch (error) {
            logger.error(`[DesignerPanel] 选择图片路径失败: ${error}`);
            vscode.window.showErrorMessage('选择图片失败');
        }
    }
    
    /**
     * 加载资源文件列表
     */
    private async _handleLoadAssets(): Promise<void> {
        try {
            if (!this._filePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                logger.warn('[Assets] 未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 递归扫描assets目录
            const assets = this._scanAssetsDirectory(assetsDir, assetsDir);

            // 发送资源列表到webview
            this._panel.webview.postMessage({
                command: 'assetsLoaded',
                assets
            });
        } catch (error) {
            logger.error(`加载资源列表失败: ${error}`);
        }
    }

    /**
     * 递归扫描资源目录
     */
    private _scanAssetsDirectory(dirPath: string, rootPath: string): any[] {
        const assets: any[] = [];
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
                // 递归扫描子目录
                const children = this._scanAssetsDirectory(filePath, rootPath);
                if (children.length > 0) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(filePath));
                    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                    assets.push({
                        name: file,
                        path: webviewUri.toString(),
                        relativePath: relativePath,
                        type: 'folder',
                        size: 0,
                        children
                    });
                }
            } else if (stats.isFile()) {
                const ext = path.extname(file).toLowerCase();
                const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
                
                if (imageExts.includes(ext)) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(filePath));
                    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                    assets.push({
                        name: file,
                        path: webviewUri.toString(),
                        relativePath: relativePath,
                        type: 'image',
                        size: stats.size
                    });
                }
            }
        }
        
        return assets;
    }

    /**
     * 删除资源文件
     */
    private async _handleDeleteAsset(fileName: string): Promise<void> {
        try {
            logger.info(`[删除资源] 收到删除请求: ${fileName}`);
            
            if (!this._filePath) {
                logger.error('[删除资源] 文件路径未初始化');
                return;
            }
            
            // 构建完整的文件路径
            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                logger.error('[删除资源] 无法找到项目根目录');
                return;
            }
            
            const assetsDir = path.join(projectRoot, 'assets');
            const filePath = path.join(assetsDir, fileName);
            
            logger.info(`[删除资源] 完整路径: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
                const relativePath = `assets/${fileName}`;
                
                logger.info(`[删除资源] 删除文件: ${filePath}, 相对路径: ${relativePath}`);
                
                // 删除文件
                fs.unlinkSync(filePath);
                
                // 通知前端删除引用此资源的组件
                this._panel.webview.postMessage({
                    command: 'deleteComponentsByImagePath',
                    imagePath: relativePath
                });
                
                vscode.window.showInformationMessage('资源文件已删除');
                // 重新加载资源列表
                this._handleLoadAssets();
            } else {
                logger.warn(`[删除资源] 文件不存在: ${filePath}`);
                vscode.window.showErrorMessage('资源文件不存在');
            }
        } catch (error) {
            logger.error(`删除资源文件失败: ${error}`);
            vscode.window.showErrorMessage('删除资源文件失败');
        }
    }

    /**
     * 重命名资源文件
     */
    private async _handleRenameAsset(oldPath: string, newName: string): Promise<void> {
        try {
            const dir = path.dirname(oldPath);
            const newPath = path.join(dir, newName);
            
            if (fs.existsSync(newPath)) {
                vscode.window.showErrorMessage('文件名已存在');
                return;
            }
            
            fs.renameSync(oldPath, newPath);
            vscode.window.showInformationMessage('资源文件已重命名');
            // 重新加载资源列表
            this._handleLoadAssets();
        } catch (error) {
            logger.error(`重命名资源文件失败: ${error}`);
            vscode.window.showErrorMessage('重命名资源文件失败');
        }
    }

    /**
     * 打开assets文件夹
     */
    private async _handleOpenAssetsFolder(): Promise<void> {
        try {
            if (!this._filePath) {
                vscode.window.showErrorMessage('请先保存设计稿');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 在系统文件管理器中打开
            const uri = vscode.Uri.file(assetsDir);
            await vscode.commands.executeCommand('revealFileInOS', uri);
        } catch (error) {
            logger.error(`打开assets文件夹失败: ${error}`);
            vscode.window.showErrorMessage('打开assets文件夹失败');
        }
    }

    /**
     * 保存图片到assets目录并可选创建图片控件
     */
    private async _handleSaveImageToAssets(
        fileName: string,
        fileData: number[],
        dropPosition?: { x: number; y: number },
        targetContainerId?: string,
        relativePath?: string
    ): Promise<void> {
        try {
            if (!this._filePath) {
                vscode.window.showErrorMessage('请先保存设计稿');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(this._filePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 构建完整路径（支持子文件夹）
            let targetDir = assetsDir;
            let assetRelativePath = fileName;
            
            if (relativePath) {
                targetDir = path.join(assetsDir, relativePath);
                // 确保子目录存在
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                assetRelativePath = `${relativePath}/${fileName}`;
            }

            // 保存文件
            const filePath = path.join(targetDir, fileName);
            const buffer = Buffer.from(fileData);
            fs.writeFileSync(filePath, buffer);

            // 计算相对路径（保存到 HML 文件）
            const hmlRelativePath = `assets/${assetRelativePath}`;

            // 如果提供了位置和容器ID，则创建图片控件
            if (dropPosition && targetContainerId) {
                this._panel.webview.postMessage({
                    command: 'createImageComponent',
                    imagePath: hmlRelativePath,
                    dropPosition,
                    targetContainerId
                });
            }

            // 重新加载资源列表
            this._handleLoadAssets();

            vscode.window.showInformationMessage(`图片已保存到 ${hmlRelativePath}`);
        } catch (error) {
            logger.error(`保存图片到assets失败: ${error}`);
            vscode.window.showErrorMessage('保存图片失败');
        }
    }
    
    public dispose(): void {
        DesignerPanel.currentPanel = undefined;

        // 清理所有监听器
        this._disposables.forEach(d => d.dispose());

        // 清理保存管理器
        this._saveManager.dispose();

        // 销毁面板
        this._panel.dispose();

        logger.info('[DesignerPanel] DesignerPanel 已销毁');
    }
}
