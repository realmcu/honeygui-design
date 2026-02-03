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
                    // 保存操作：只同步 HmlController 数据，不刷新前端界面
                    // 因为组件的增量更新已经通过 addComponent/updateComponent/deleteComponent 同步了
                    if (payload?.content?.components && Array.isArray(payload.content.components)) {
                        this.hmlController.updateFromFrontendComponents(payload.content.components);
                    }
                    // 主机负责保存文件
                    if (this.service.isHost) {
                        const serializedContent = this.hmlController.serializeDocument();
                        this.fileManager.saveHml(payload.content?.raw ?? serializedContent);
                    }
                    break;
                    
                case 'saveImageToAssets':
                    // 保存图片资源：只在主机端执行，不刷新界面
                    if (this.service.isHost) {
                        this.messageHandler.handleMessage(payload, true);
                    }
                    break;
                    
                case 'createImageComponent':
                    // 创建图片组件：转发消息到前端，不刷新界面
                    this.panel.webview.postMessage({
                        command: 'createImageComponent',
                        imagePath: payload.imagePath,
                        dropPosition: payload.dropPosition,
                        targetContainerId: payload.targetContainerId,
                        imageSize: payload.imageSize
                    });
                    break;
                    
                case 'create3DComponent':
                    // 创建3D组件：转发消息到前端，不刷新界面
                    this.panel.webview.postMessage({
                        command: 'create3DComponent',
                        modelPath: payload.modelPath,
                        dropPosition: payload.dropPosition,
                        targetContainerId: payload.targetContainerId
                    });
                    break;
                    
                case 'createVideoComponent':
                    // 创建视频组件：转发消息到前端，不刷新界面
                    this.panel.webview.postMessage({
                        command: 'createVideoComponent',
                        videoPath: payload.videoPath,
                        dropPosition: payload.dropPosition,
                        targetContainerId: payload.targetContainerId,
                        videoSize: payload.videoSize
                    });
                    break;
                    
                case 'createSvgComponent':
                    // 创建SVG组件：转发消息到前端，不刷新界面
                    this.panel.webview.postMessage({
                        command: 'createSvgComponent',
                        svgPath: payload.svgPath,
                        dropPosition: payload.dropPosition,
                        targetContainerId: payload.targetContainerId,
                        size: payload.size
                    });
                    break;
                    
                case 'createGlassComponent':
                    // 创建Glass组件：转发消息到前端，不刷新界面
                    this.panel.webview.postMessage({
                        command: 'createGlassComponent',
                        glassPath: payload.glassPath,
                        dropPosition: payload.dropPosition,
                        targetContainerId: payload.targetContainerId,
                        size: payload.size
                    });
                    break;
                    
                default:
                    // 其他操作：只执行消息处理，不刷新界面
                    // 避免不必要的 loadHml 导致闪烁
                    this.messageHandler.handleMessage(payload, true);
            }
        }
    }
}
