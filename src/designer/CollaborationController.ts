import * as vscode from 'vscode';
import { CollaborationService, CollaborationMessage } from '../core/CollaborationService';
import { HmlController } from '../hml/HmlController';
import { FileManager } from './FileManager';
import { MessageHandler } from './MessageHandler';

/**
 * 协同消息控制器
 * 负责处理协同开发相关的消息
 */
export class CollaborationController {
    private readonly service: CollaborationService;
    private readonly hmlController: HmlController;
    private readonly fileManager: FileManager;
    private readonly messageHandler: MessageHandler;
    private readonly onUpdate: () => void;
    private readonly panel: vscode.WebviewPanel;
    private messageListener?: (message: CollaborationMessage) => void;

    constructor(
        service: CollaborationService,
        hmlController: HmlController,
        fileManager: FileManager,
        messageHandler: MessageHandler,
        onUpdate: () => void,
        panel: vscode.WebviewPanel
    ) {
        this.service = service;
        this.hmlController = hmlController;
        this.fileManager = fileManager;
        this.messageHandler = messageHandler;
        this.onUpdate = onUpdate;
        this.panel = panel;
    }

    /**
     * 启动监听
     */
    public start(): void {
        this.messageListener = (message: CollaborationMessage) => {
            this.handleMessage(message);
        };
        this.service.on('message', this.messageListener);
    }

    /**
     * 停止监听
     */
    public stop(): void {
        if (this.messageListener) {
            this.service.off('message', this.messageListener);
            this.messageListener = undefined;
        }
    }

    /**
     * 处理协同消息
     */
    private handleMessage(message: CollaborationMessage): void {
        switch (message.type) {
            case 'WELCOME':
                this.handleWelcome();
                break;
            case 'SYNC_INIT':
                this.handleSyncInit(message);
                break;
            case 'REMOTE_UPDATE':
                this.handleRemoteUpdate(message);
                break;
            case 'OP_DELTA':
                this.handleOpDelta(message);
                break;
        }
    }

    /**
     * 处理新访客加入（访客收到 WELCOME 后请求同步）
     */
    private handleWelcome(): void {
        // 访客收到 WELCOME 后，向主机请求初始文档
        if (this.service.isGuest) {
            this.service.broadcast({
                type: 'SYNC_INIT',
                content: 'REQUEST'
            });
        }
    }

    /**
     * 当有新访客连接时，主机主动发送文档
     * 由 DesignerPanel 在 peerCountChanged 事件中调用
     */
    public sendDocumentToNewPeer(): void {
        if (this.service.isHost) {
            const doc = this.hmlController.serializeDocument();
            this.service.broadcast({
                type: 'SYNC_INIT',
                content: doc
            });
        }
    }

    /**
     * 处理初始同步
     */
    private handleSyncInit(message: CollaborationMessage): void {
        // 主机收到访客的同步请求
        if (this.service.isHost && message.content === 'REQUEST') {
            const doc = this.hmlController.serializeDocument();
            this.service.broadcast({
                type: 'SYNC_INIT',
                content: doc
            });
            return;
        }
        
        // 访客收到主机发送的文档
        if (this.service.isGuest && message.content && message.content !== 'REQUEST') {
            this.hmlController.applyRemoteUpdate(message.content);
            this.onUpdate();
        }
    }

    /**
     * 处理远程更新
     */
    private handleRemoteUpdate(message: CollaborationMessage): void {
        if (!message.content) return;

        this.hmlController.applyRemoteUpdate(message.content);
        this.onUpdate();

        // 主机负责保存
        if (this.service.isHost) {
            this.fileManager.saveHml(message.content);
        }
    }

    /**
     * 处理增量操作
     * 使用增量更新避免界面闪烁
     */
    private handleOpDelta(message: CollaborationMessage): void {
        if (message.payload) {
            const payload = message.payload;
            
            // 根据操作类型发送增量更新到前端
            switch (payload.command) {
                case 'addComponent':
                    // 添加组件：发送增量添加消息
                    this.panel.webview.postMessage({
                        command: 'remoteAddComponent',
                        component: payload.component,
                        parentId: payload.parentId
                    });
                    // 同步到 HmlController
                    if (payload.component) {
                        this.hmlController.addComponent(payload.component);
                    }
                    break;
                    
                case 'updateComponent':
                    // 更新组件：发送增量更新消息
                    this.panel.webview.postMessage({
                        command: 'remoteUpdateComponent',
                        componentId: payload.componentId,
                        updates: payload.updates
                    });
                    // 同步到 HmlController
                    if (payload.componentId && payload.updates) {
                        this.hmlController.updateComponent(payload.componentId, payload.updates);
                    }
                    break;
                    
                case 'deleteComponent':
                    // 删除组件：发送增量删除消息
                    this.panel.webview.postMessage({
                        command: 'remoteDeleteComponent',
                        componentId: payload.componentId
                    });
                    // 同步到 HmlController
                    if (payload.componentId) {
                        this.hmlController.deleteComponent(payload.componentId);
                    }
                    break;
                    
                case 'save':
                    // 保存操作：需要完整同步
                    this.messageHandler.handleMessage(payload, true);
                    this.onUpdate();
                    break;
                    
                default:
                    // 其他操作：使用原有逻辑
                    this.messageHandler.handleMessage(payload, true);
                    this.onUpdate();
            }
        }
    }
}
