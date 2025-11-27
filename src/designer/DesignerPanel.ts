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

import { WebviewContentProvider } from './WebviewContentProvider';

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
    private readonly _webviewContentProvider: WebviewContentProvider;

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

        // Initialize WebviewContentProvider
        this._webviewContentProvider = new WebviewContentProvider(context.extensionUri);

        // 如果有文档，设置文件路径
        if (document) {
            this._fileManager.currentFilePath = document.uri.fsPath;
        }

        // 监听文件管理器的标题更新事件
        this._fileManager.onDidUpdateTitle(title => {
            this._panel.title = title;
        });

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
        this._panel.webview.html = this._webviewContentProvider.getHtmlForWebview(webview);
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
