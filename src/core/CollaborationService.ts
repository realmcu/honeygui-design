import * as vscode from 'vscode';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/Logger';
import { EventEmitter } from 'events';
import * as os from 'os';

export enum CollaborationRole {
    None = 'none',
    Host = 'host',
    Guest = 'guest'
}

export interface CollaborationState {
    role: CollaborationRole;
    connected: boolean;
    port?: number;
    hostAddress?: string;
    peers: string[];
}

export interface CollaborationMessage {
    type: 'WELCOME' | 'SYNC_INIT' | 'REMOTE_UPDATE' | 'OP_DELTA' | 'GET_ASSET' | 'ASSET_DATA' | 'ASSETS_LIST' | 'SOURCES_LIST' | 'GET_SOURCE' | 'SOURCE_DATA' | 'UI_LIST' | 'GET_UI' | 'UI_DATA';
    peerId?: string;
    content?: string;
    payload?: any;
}

const CONNECTION_TIMEOUT_MS = 10000;

export class CollaborationService extends EventEmitter {
    private static instance: CollaborationService;
    private _role: CollaborationRole = CollaborationRole.None;
    private _wss: WebSocketServer | null = null;
    private _ws: WebSocket | null = null;
    private _peers: Map<string, WebSocket> = new Map();
    private _port: number = 3000;
    private _hostAddress: string | undefined; // 存储 Host 地址

    private constructor() {
        super();
    }

    public static getInstance(): CollaborationService {
        if (!CollaborationService.instance) {
            CollaborationService.instance = new CollaborationService();
        }
        return CollaborationService.instance;
    }

    public get role(): CollaborationRole {
        return this._role;
    }
    
    public get hostAddress(): string | undefined {
        return this._hostAddress;
    }

    public get isHost(): boolean {
        return this._role === CollaborationRole.Host;
    }

    public get isGuest(): boolean {
        return this._role === CollaborationRole.Guest;
    }

    public get isConnected(): boolean {
        return this._role !== CollaborationRole.None;
    }

    /**
     * 启动主机模式
     */
    public async startHost(port: number = 3000): Promise<string> {
        if (this._role !== CollaborationRole.None) {
            throw new Error('Already in a collaboration session');
        }

        return new Promise((resolve, reject) => {
            try {
                this._wss = new WebSocketServer({ port });
                this._port = port;

                // 监听 listening 事件，确保服务真正启动后再返回
                this._wss.on('listening', () => {
                    this._role = CollaborationRole.Host;
                    const ips = this.getLocalIPs();
                    const address = ips.length > 0 ? ips[0] : 'localhost';
                    const fullAddress = `${address}:${port}`;
                    this._hostAddress = fullAddress; // 保存 Host 地址
                    
                    logger.info(`[Collaboration] Host started on ${fullAddress}`);
                    
                    this.emit('statusChanged', {
                        role: this._role,
                        status: 'hosting',
                        hostAddress: fullAddress,
                        peerCount: 0
                    });
                    
                    resolve(fullAddress);
                });

                this._wss.on('connection', (ws) => {
                    const peerId = Math.random().toString(36).substring(7);
                    this._peers.set(peerId, ws);
                    logger.info(`[Collaboration] Client connected: ${peerId}`);

                    // 发送欢迎消息和当前状态
                    ws.send(JSON.stringify({
                        type: 'WELCOME',
                        peerId
                    }));

                    // 通知对等方数量变化
                    this.emit('peerCountChanged', this._peers.size);
                    this.emit('statusChanged', {
                        role: this._role,
                        status: 'hosting',
                        hostAddress: this._hostAddress,
                        peerCount: this._peers.size
                    });

                    ws.on('message', (data) => {
                        this.handleMessage(peerId, data.toString());
                    });

                    ws.on('close', () => {
                        this._peers.delete(peerId);
                        logger.info(`[Collaboration] Client disconnected: ${peerId}`);
                        // 通知对等方数量变化
                        this.emit('peerCountChanged', this._peers.size);
                        this.emit('statusChanged', {
                            role: this._role,
                            status: 'hosting',
                            peerCount: this._peers.size
                        });
                    });
                });

                this._wss.on('error', (error: any) => {
                    logger.error(`[Collaboration] Server error: ${error}`);
                    this.stop();
                    // 处理端口占用错误
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`端口 ${port} 已被占用，请更换端口`));
                    } else {
                        reject(error);
                    }
                });

            } catch (error) {
                this.stop();
                reject(error);
            }
        });
    }

    /**
     * 加入主机
     */
    public async joinSession(address: string): Promise<void> {
        if (this._role !== CollaborationRole.None) {
            throw new Error('Already in a collaboration session');
        }

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://${address}`;
                this._ws = new WebSocket(wsUrl);

                // 连接超时处理
                const timeout = setTimeout(() => {
                    if (this._ws) {
                        this._ws.terminate();
                        this._ws = null;
                    }
                    reject(new Error('连接超时，请检查主机地址是否正确'));
                }, CONNECTION_TIMEOUT_MS);

                this._ws.on('open', () => {
                    clearTimeout(timeout);
                    this._role = CollaborationRole.Guest;
                    this._hostAddress = address; // 保存 Host 地址
                    logger.info(`[Collaboration] Connected to host: ${address}`);
                    
                    this.emit('statusChanged', {
                        role: this._role,
                        status: 'connected',
                        hostAddress: address,
                        peerCount: 1
                    });
                    
                    resolve();
                });

                this._ws.on('message', (data) => {
                    this.handleMessage('host', data.toString());
                });

                this._ws.on('error', (error) => {
                    clearTimeout(timeout);
                    logger.error(`[Collaboration] Connection error: ${error}`);
                    reject(error);
                });

                this._ws.on('close', () => {
                    clearTimeout(timeout);
                    logger.info('[Collaboration] Disconnected from host');
                    this.stop();
                });

            } catch (error) {
                this.stop();
                reject(error);
            }
        });
    }

    /**
     * 停止协同
     */
    public stop() {
        if (this._wss) {
            // 必须手动关闭所有活跃的客户端连接
            this._peers.forEach((ws) => {
                try {
                    ws.terminate();
                } catch (e) {
                    // 忽略关闭错误
                }
            });
            this._wss.close();
            this._wss = null;
        }
        if (this._ws) {
            this._ws.terminate();
            this._ws = null;
        }
        this._peers.clear();
        this._role = CollaborationRole.None;
        this._hostAddress = undefined; // 清除 Host 地址
        logger.info('[Collaboration] Session stopped');
        this.emit('stopped');
        this.emit('statusChanged', {
            role: 'none',
            status: 'disconnected',
            peerCount: 0
        });
    }

    /**
     * 广播消息
     */
    public broadcast(message: any, excludePeerId?: string) {
        const msgString = JSON.stringify(message);

        if (this.isHost) {
            // 主机广播给所有客户端
            this._peers.forEach((client, id) => {
                if (client.readyState === WebSocket.OPEN && id !== excludePeerId) {
                    client.send(msgString);
                }
            });
        } else if (this.isGuest && this._ws?.readyState === WebSocket.OPEN) {
            // 访客发送给主机
            this._ws.send(msgString);
        }
    }

    /**
     * 处理接收到的消息
     */
    private handleMessage(fromPeerId: string, data: string) {
        try {
            const message = JSON.parse(data);

            // 如果是主机收到消息，需要转发给其他客户端
            if (this.isHost) {
                this.broadcast(message, fromPeerId);
            }

            // 触发消息事件，供上层业务处理
            this.emit('message', message);

        } catch (error) {
            logger.error(`[Collaboration] Failed to parse message: ${error}`);
        }
    }

    private getLocalIPs(): string[] {
        const interfaces = os.networkInterfaces();
        const ips: string[] = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
        return ips;
    }
}
