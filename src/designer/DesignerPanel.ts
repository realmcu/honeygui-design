import * as vscode from 'vscode';
import { logger } from '../utils/Logger';
import { HmlController } from '../hml/HmlController';
import { SaveManager } from './SaveManager';
import { AssetManager } from './AssetManager';
import { CodeGenerator } from '../services/CodeGenerator';
import { ComponentManager } from './ComponentManager';
import { FileManager } from './FileManager';
import { MessageHandler } from './MessageHandler';
import { CodeGenOptions } from '../codegen/honeygui';
import { WebviewContentProvider } from './WebviewContentProvider';
import { DesignerService } from './DesignerService';
import { CollaborationService, CollaborationMessage } from '../core/CollaborationService';

/**
 * 设计器Webview面板管理类
 */
export class DesignerPanel {
    /** @deprecated Use panelRegistry instead for multi-file support */
    public static currentPanel: DesignerPanel | undefined;
    /** Registry of all active panels by file path */
    private static panelRegistry: Map<string, DesignerPanel> = new Map();
    public static readonly viewType = 'honeyguiDesigner';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    
    // Managers
    private readonly _hmlController: HmlController;
    private readonly _saveManager: SaveManager;
    private readonly _assetManager: AssetManager;
    private readonly _codeGenerator: CodeGenerator;
    private readonly _componentManager: ComponentManager;
    private readonly _fileManager: FileManager;
    private readonly _messageHandler: MessageHandler;
    private readonly _webviewContentProvider: WebviewContentProvider;
    private readonly _collaborationService: CollaborationService;
    private readonly _collaborationMessageHandler: (message: CollaborationMessage) => void;

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
     * 获取指定文件路径的面板
     */
    public static getPanel(filePath: string): DesignerPanel | undefined {
        return DesignerPanel.panelRegistry.get(filePath);
    }

    /**
     * 注册面板到 registry
     */
    public static registerPanel(filePath: string, panel: DesignerPanel): void {
        DesignerPanel.panelRegistry.set(filePath, panel);
    }

    /**
     * 显示面板
     */
    public reveal(column?: vscode.ViewColumn): void {
        this._panel.reveal(column);
    }

    /**
     * 从 TextDocument 构造（用于 CustomTextEditorProvider）
     */
    public constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, document?: vscode.TextDocument) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;
        
        // Initialize Core Controllers - each panel gets its own HmlController
        // to support multiple files being edited simultaneously
        this._hmlController = DesignerService.getInstance().createHmlController();
        this._saveManager = new SaveManager(this._hmlController);
        
        // Initialize Managers
        this._assetManager = new AssetManager(panel);
        this._codeGenerator = new CodeGenerator();
        this._componentManager = new ComponentManager(panel, this._hmlController);
        this._fileManager = new FileManager(panel, this._hmlController, this._saveManager);
        
        // Initialize Message Handler
        this._messageHandler = new MessageHandler(
            this._assetManager,
            this._codeGenerator,
            this._componentManager,
            this._fileManager,
            this._hmlController
        );

        // Initialize WebviewContentProvider
        this._webviewContentProvider = new WebviewContentProvider(context.extensionUri);
        
        // Initialize Collaboration Service
        this._collaborationService = CollaborationService.getInstance();
        
        // 保存监听器引用，便于精确移除
        this._collaborationMessageHandler = (message: CollaborationMessage) => {
            this.handleCollaborationMessage(message);
        };

        // 如果有文档，设置文件路径
        if (document) {
            this._fileManager.currentFilePath = document.uri.fsPath;
        }

        // 监听文件管理器的标题更新事件
        this._fileManager.onDidUpdateTitle(title => {
            this._panel.title = title;
        });

        // 监听协同消息
        this._collaborationService.on('message', this._collaborationMessageHandler);

        // 设置Webview内容
        this._update();

        // 处理面板关闭事件
        this._panel.onDidDispose(() => {
            // 精确移除本实例的监听器，不影响其他监听器
            this._collaborationService.off('message', this._collaborationMessageHandler);
            this.dispose();
        }, null, this._disposables);

        // 处理面板可见性变化
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                    DesignerPanel.currentPanel = this;
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
    public async generateCode(): Promise<void> {
        const projectRoot = this._fileManager.currentFilePath 
            ? require('../utils/ProjectUtils').ProjectUtils.findProjectRoot(this._fileManager.currentFilePath)
            : undefined;
        
        if (!projectRoot) {
            vscode.window.showErrorMessage('未找到项目根目录');
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '正在生成代码...',
                cancellable: false
            },
            async (progress) => {
                const result = await this._codeGenerator.generate(projectRoot, (prog) => {
                    progress.report({
                        increment: 100 / prog.total,
                        message: `正在生成 ${prog.designName} (${prog.current}/${prog.total})...`
                    });
                });

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
            }
        );
    }

    /**
     * 处理协同消息
     */
    private handleCollaborationMessage(message: any): void {
        // TODO: 实现协同消息处理逻辑
        logger.info(`[DesignerPanel] Received collaboration message: ${JSON.stringify(message)}`);
        
        switch (message.type) {
            case 'WELCOME':
                // 新访客加入，如果是主机，发送当前文档状态
                if (this._collaborationService.isHost) {
                    const doc = this._hmlController.serializeDocument();
                    this._collaborationService.broadcast({
                        type: 'SYNC_INIT',
                        content: doc
                    });
                }
                break;
            case 'SYNC_INIT':
                // 访客收到初始文档状态
                if (this._collaborationService.isGuest && message.content) {
                    // 更新本地文档
                    this._hmlController.applyRemoteUpdate(message.content);
                    // 刷新 Webview
                    this._update();
                }
                break;
            case 'REMOTE_UPDATE':
                // 收到增量更新或全量更新（这里先简化为全量同步）
                if (this._collaborationService.isGuest && message.content) {
                    this._hmlController.applyRemoteUpdate(message.content);
                    this._update();
                } else if (this._collaborationService.isHost && message.content) {
                    // 主机收到访客的更新，保存并广播
                    this._hmlController.applyRemoteUpdate(message.content);
                    this._update();
                    // 主机作为真理之源，可以触发保存
                    this._fileManager.saveHml(message.content);
                }
                break;
            case 'OP_DELTA':
                // 处理增量操作（由 MessageHandler 广播出来的原子操作）
                // 无论 Host 还是 Guest，收到 OP_DELTA 都意味着这是来自远程的操作
                // 传入 fromRemote=true 以避免 MessageHandler 再次广播
                this._messageHandler.handleMessage(message.payload, true);
                break;
        }
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
        // 从 registry 中移除
        const filePath = this._fileManager.currentFilePath;
        if (filePath) {
            DesignerPanel.panelRegistry.delete(filePath);
        }
        DesignerPanel.currentPanel = undefined;

        // 精确移除本实例的协同消息监听器
        this._collaborationService.off('message', this._collaborationMessageHandler);

        // 清理所有监听器
        this._disposables.forEach(d => d.dispose());

        // 清理保存管理器
        this._saveManager.dispose();

        // 销毁面板
        this._panel.dispose();

        logger.info('[DesignerPanel] DesignerPanel 已销毁');
    }
}
