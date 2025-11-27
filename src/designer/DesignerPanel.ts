import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { WebviewUtils } from '../common/WebviewUtils';
import { SaveManager } from './SaveManager';
import { AssetManager } from './AssetManager';
import { CodeGenManager } from './CodeGenManager';
import { ComponentManager } from './ComponentManager';
import { FileManager } from './FileManager';
import { MessageHandler } from './MessageHandler';
import { CodeGenOptions } from '../codegen/honeygui';

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
    
    // Managers
    private readonly _hmlController: HmlController;
    private readonly _saveManager: SaveManager;
    private readonly _assetManager: AssetManager;
    private readonly _codeGenManager: CodeGenManager;
    private readonly _componentManager: ComponentManager;
    private readonly _fileManager: FileManager;
    private readonly _messageHandler: MessageHandler;

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
                DesignerPanel.currentPanel.loadFile(filePath);
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
            DesignerPanel.currentPanel.loadFile(filePath);
        } else {
            DesignerPanel.currentPanel.createNewDocument();
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
        
        // Initialize Core Controllers
        this._hmlController = new HmlController();
        this._saveManager = new SaveManager(this._hmlController);
        
        // Initialize Managers
        this._assetManager = new AssetManager(panel);
        this._codeGenManager = new CodeGenManager(this._hmlController);
        this._componentManager = new ComponentManager(panel, this._hmlController);
        this._fileManager = new FileManager(panel, this._hmlController, this._saveManager);
        
        // Initialize Message Handler
        this._messageHandler = new MessageHandler(
            panel,
            this._assetManager,
            this._codeGenManager,
            this._componentManager,
            this._fileManager,
            this._hmlController
        );

        // 如果有文档，设置文件路径
        if (document) {
            this._fileManager.currentFilePath = document.uri.fsPath;
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
            message => this._messageHandler.handleMessage(message),
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
     * 生成随机nonce值
     */
    private _getNonce(): string {
        return WebviewUtils.generateNonce();
    }

    /**
     * 加载文件
     */
    public async loadFile(filePath: string): Promise<void> {
        await this._fileManager.loadFile(filePath);
    }
    
    /**
     * 创建新的空白文档
     */
    public createNewDocument(): void {
        this._fileManager.createNewDocument();
    }

    /**
     * 从 TextDocument 加载内容（用于 CustomTextEditorProvider）
     */
    public async loadFromDocument(document: vscode.TextDocument): Promise<void> {
        await this._fileManager.loadFromDocument(document);
    }

    /**
     * 从文档更新内容（当文档在外部被修改时）
     */
    public async updateFromDocument(): Promise<void> {
        await this._fileManager.updateFromDocument();
    }

    /**
     * 生成代码
     */
    public async generateCode(language: 'cpp' | 'c' = 'cpp', options?: Partial<CodeGenOptions>, content?: string): Promise<void> {
        await this._codeGenManager.generateCode(
            language,
            options,
            content,
            this._fileManager.currentFilePath,
            async () => {
                const docContent = this._hmlController.serializeDocument();
                return await this._fileManager.saveHml(docContent);
            }
        );
    }

    /**
     * 生成所有设计稿的代码
     */
    public async generateAllCode(): Promise<void> {
        await this._codeGenManager.generateAllCode(this._fileManager.currentFilePath);
    }
    
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
        return this._fileManager.currentFilePath;
    }
    
    /**
     * 向Webview发送消息
     */
    public sendMessage(command: string, data?: any): void {
        this._panel.webview.postMessage({ command, ...data });
    }
    
    /**
     * 重新加载当前文档
     */
    public reloadCurrentDocument(): void {
        this._fileManager.reloadCurrentDocument();
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
