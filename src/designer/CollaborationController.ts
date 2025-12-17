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
    private messageListener?: (message: CollaborationMessage) => void;

    constructor(
        service: CollaborationService,
        hmlController: HmlController,
        fileManager: FileManager,
        messageHandler: MessageHandler,
        onUpdate: () => void
    ) {
        this.service = service;
        this.hmlController = hmlController;
        this.fileManager = fileManager;
        this.messageHandler = messageHandler;
        this.onUpdate = onUpdate;
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
     * 处理新访客加入
     */
    private handleWelcome(): void {
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
        if (this.service.isGuest && message.content) {
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
     */
    private handleOpDelta(message: CollaborationMessage): void {
        if (message.payload) {
            // fromRemote=true 避免再次广播
            this.messageHandler.handleMessage(message.payload, true);
        }
    }
}
