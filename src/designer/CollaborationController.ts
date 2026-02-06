import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CollaborationService, CollaborationMessage } from '../core/CollaborationService';
import { HmlController } from '../hml/HmlController';
import { FileManager } from './FileManager';
import { MessageHandler } from './MessageHandler';
import { ProjectUtils } from '../utils/ProjectUtils';
import { logger } from '../utils/Logger';

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
    private guestWorkspacePath: string | undefined;
    private isUserSpecifiedWorkspace: boolean = false;

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
     * 设置访客工作区路径
     */
    public setGuestWorkspacePath(path: string): void {
        this.guestWorkspacePath = path;
        this.isUserSpecifiedWorkspace = true;
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
        // 清理临时工作区 (如果是系统生成的)
        if (this.guestWorkspacePath && !this.isUserSpecifiedWorkspace && fs.existsSync(this.guestWorkspacePath)) {
            try {
                fs.rmSync(this.guestWorkspacePath, { recursive: true, force: true });
            } catch (e) {
                logger.error(`[Collaboration] Failed to clean up guest workspace: ${e}`);
            }
        }
        if (!this.isUserSpecifiedWorkspace) {
            this.guestWorkspacePath = undefined;
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
            case 'ASSETS_LIST':
                this.handleAssetsList(message);
                break;
            case 'GET_ASSET':
                this.handleGetAsset(message);
                break;
            case 'ASSET_DATA':
                this.handleAssetData(message);
                break;
            case 'SOURCES_LIST':
                this.handleSourcesList(message);
                break;
            case 'GET_SOURCE':
                this.handleGetSource(message);
                break;
            case 'SOURCE_DATA':
                this.handleSourceData(message);
                break;
            case 'UI_LIST':
                this.handleUiList(message);
                break;
            case 'GET_UI':
                this.handleGetUi(message);
                break;
            case 'UI_DATA':
                this.handleUiData(message);
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
            
            // 获取当前文件相对路径
            let relativePath = 'guest.hml';
            let projectConfig = null;
            const currentPath = this.fileManager.currentFilePath;
            if (currentPath) {
                const projectRoot = ProjectUtils.findProjectRoot(currentPath);
                if (projectRoot) {
                    relativePath = path.relative(projectRoot, currentPath);
                    projectConfig = ProjectUtils.loadProjectConfig(projectRoot);
                } else {
                    relativePath = path.basename(currentPath);
                }
            }

            this.service.broadcast({
                type: 'SYNC_INIT',
                content: doc,
                payload: { relativePath, projectConfig }
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
            
            // 获取当前文件相对路径
            let relativePath = 'guest.hml';
            let projectConfig = null;
            const currentPath = this.fileManager.currentFilePath;
            if (currentPath) {
                const projectRoot = ProjectUtils.findProjectRoot(currentPath);
                if (projectRoot) {
                    relativePath = path.relative(projectRoot, currentPath);
                    projectConfig = ProjectUtils.loadProjectConfig(projectRoot);
                } else {
                    relativePath = path.basename(currentPath);
                }
            }

            this.service.broadcast({
                type: 'SYNC_INIT',
                content: doc,
                payload: { relativePath, projectConfig }
            });
            return;
        }
        
        // 访客收到主机发送的文档
        if (this.service.isGuest && message.content && message.content !== 'REQUEST') {
            const relativePath = message.payload?.relativePath || 'guest.hml';
            const projectConfig = message.payload?.projectConfig;

            // 设置临时工作区
            this.setupGuestWorkspace(message.content, relativePath, projectConfig);

            // 请求资源列表
            this.service.broadcast({
                type: 'ASSETS_LIST',
                content: 'REQUEST'
            });

            // 请求源码列表
            this.service.broadcast({
                type: 'SOURCES_LIST',
                content: 'REQUEST'
            });

            // 请求 UI 列表
            this.service.broadcast({
                type: 'UI_LIST',
                content: 'REQUEST'
            });

            this.hmlController.applyRemoteUpdate(message.content);
            this.onUpdate();
        }
    }

    /**
     * 设置访客临时工作区
     */
    private setupGuestWorkspace(hmlContent: string, relativePath: string = 'guest.hml', projectConfig?: any) {
        try {
            // 如果已经有工作区，先复用或清理? 这里选择复用或者新建唯一的
            if (!this.guestWorkspacePath) {
                const workspaceId = Math.random().toString(36).substring(7);
                this.guestWorkspacePath = path.join(os.tmpdir(), 'honeygui-guest', workspaceId);
            }
            
            if (!fs.existsSync(this.guestWorkspacePath)) {
                fs.mkdirSync(this.guestWorkspacePath, { recursive: true });
            }
            
            // 创建 assets 目录
            const assetsDir = path.join(this.guestWorkspacePath, 'assets');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 创建 src 目录
            const srcDir = path.join(this.guestWorkspacePath, 'src');
            if (!fs.existsSync(srcDir)) {
                fs.mkdirSync(srcDir, { recursive: true });
            }

            // 创建 ui 目录
            const uiDir = path.join(this.guestWorkspacePath, 'ui');
            if (!fs.existsSync(uiDir)) {
                fs.mkdirSync(uiDir, { recursive: true });
            }
            
            // 创建/写入 project.json
            const projectJsonPath = path.join(this.guestWorkspacePath, 'project.json');
            
            let configContent;
            if (projectConfig) {
                configContent = JSON.stringify(projectConfig, null, 2);
            } else {
                configContent = JSON.stringify({
                    name: "Guest Project",
                    version: "1.0.0",
                    assetsDir: "assets"
                }, null, 2);
            }
            
            fs.writeFileSync(projectJsonPath, configContent);
            
            // 保存 HML
            const hmlPath = path.join(this.guestWorkspacePath, relativePath);
            
            // 确保目录存在
            const hmlDir = path.dirname(hmlPath);
            if (!fs.existsSync(hmlDir)) {
                fs.mkdirSync(hmlDir, { recursive: true });
            }
            
            fs.writeFileSync(hmlPath, hmlContent);
            
            // 更新 FileManager 的路径，这样 AssetManager 就能找到正确的根目录
            this.fileManager.currentFilePath = hmlPath;
            
            // 更新面板标题
            this.panel.title = `HoneyGUI Designer: ${path.basename(relativePath)}`;

            // 触发一次资源加载，初始化 AssetManager 上下文
            this.messageHandler.handleMessage({ command: 'loadAssets' }, true);

            logger.info(`[Collaboration] Guest workspace setup at: ${this.guestWorkspacePath}`);
        } catch (error) {
            logger.error(`[Collaboration] Failed to setup guest workspace: ${error}`);
        }
    }

    /**
     * 处理资源列表请求
     */
    private handleAssetsList(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content === 'REQUEST') {
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            if (fs.existsSync(assetsDir)) {
                const files = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.'));
                this.service.broadcast({
                    type: 'ASSETS_LIST',
                    payload: files
                });
            }
            return;
        }
        
        // Guest 收到列表
        if (this.service.isGuest && Array.isArray(message.payload)) {
            const files = message.payload as string[];
            files.forEach(file => {
                 // 检查本地是否存在
                 const localPath = path.join(this.guestWorkspacePath!, 'assets', file);
                 if (!fs.existsSync(localPath)) {
                     // 请求下载
                     this.service.broadcast({
                         type: 'GET_ASSET',
                         content: file
                     });
                 }
            });
        }
    }

    /**
     * 处理获取单个资源请求
     */
    private handleGetAsset(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content) {
            const fileName = message.content;
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const assetPath = path.join(ProjectUtils.getAssetsDir(projectRoot), fileName);
            if (fs.existsSync(assetPath)) {
                try {
                    const content = fs.readFileSync(assetPath, 'base64');
                    this.service.broadcast({
                        type: 'ASSET_DATA',
                        content: fileName, // 文件名
                        payload: content   // Base64 内容
                    });
                } catch (e) {
                    logger.error(`[Collaboration] Failed to read asset ${fileName}: ${e}`);
                }
            }
        }
    }

    /**
     * 处理资源数据接收
     */
    private handleAssetData(message: CollaborationMessage) {
        // Guest 收到数据
        if (this.service.isGuest && message.content && message.payload && this.guestWorkspacePath) {
            const fileName = message.content;
            const base64Data = message.payload;
            const filePath = path.join(this.guestWorkspacePath, 'assets', fileName);
            
            try {
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                logger.info(`[Collaboration] Asset synced: ${fileName}`);
                
                // 通知 AssetManager 刷新
                this.messageHandler.handleMessage({ command: 'loadAssets' }, true);
                
                // 刷新 Webview 以显示新资源
                this.onUpdate();
                
            } catch (e) {
                logger.error(`[Collaboration] Failed to save asset ${fileName}: ${e}`);
            }
        }

        // Host 收到数据 (来自 Guest 上传)
        if (this.service.isHost && message.content && message.payload) {
            const fileName = message.content;
            const base64Data = message.payload;
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            
            if (projectRoot) {
                const assetPath = path.join(ProjectUtils.getAssetsDir(projectRoot), fileName);
                try {
                    fs.writeFileSync(assetPath, Buffer.from(base64Data, 'base64'));
                    logger.info(`[Collaboration] Host received uploaded asset: ${fileName}`);
                    // 可选：广播给其他 Guest? 
                    // 目前依赖 Guest 请求或 OP_DELTA 触发
                } catch (e) {
                    logger.error(`[Collaboration] Host failed to save uploaded asset ${fileName}: ${e}`);
                }
            }
        }
    }

    /**
     * 递归获取所有文件
     */
    private getAllFiles(dir: string, fileList: string[] = [], relativePath: string = ''): string[] {
        if (!fs.existsSync(dir)) return [];
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            // 使用 path.join 生成相对路径，然后统一转换为 POSIX 风格 (/)
            // 这样在跨平台传输时更安全
            const fileRelativePath = relativePath ? `${relativePath}/${file}` : file;
            
            if (fs.statSync(filePath).isDirectory()) {
                this.getAllFiles(filePath, fileList, fileRelativePath);
            } else {
                fileList.push(fileRelativePath);
            }
        });
        return fileList;
    }

    /**
     * 处理源码列表请求
     */
    private handleSourcesList(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content === 'REQUEST') {
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const srcDir = ProjectUtils.getSrcDir(projectRoot);
            if (fs.existsSync(srcDir)) {
                try {
                    const files = this.getAllFiles(srcDir);
                    // 过滤掉不需要的文件，只保留 .c, .h, .cpp, .hpp
                    const sourceFiles = files.filter(f => {
                        const ext = path.extname(f).toLowerCase();
                        return ['.c', '.h', '.cpp', '.hpp'].includes(ext);
                    });
                    
                    this.service.broadcast({
                        type: 'SOURCES_LIST',
                        payload: sourceFiles
                    });
                } catch (e) {
                    logger.error(`[Collaboration] Failed to list source files: ${e}`);
                }
            }
            return;
        }
        
        // Guest 收到列表
        if (this.service.isGuest && Array.isArray(message.payload)) {
            const files = message.payload as string[];
            files.forEach(file => {
                 // 检查本地是否存在
                 const localPath = path.join(this.guestWorkspacePath!, 'src', file);
                 if (!fs.existsSync(localPath)) {
                     // 请求下载
                     this.service.broadcast({
                         type: 'GET_SOURCE',
                         content: file
                     });
                 }
            });
        }
    }

    /**
     * 处理获取单个源码请求
     */
    private handleGetSource(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content) {
            const fileName = message.content;
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const srcDir = ProjectUtils.getSrcDir(projectRoot);
            const sourcePath = path.join(srcDir, fileName);
            
            if (fs.existsSync(sourcePath)) {
                try {
                    const content = fs.readFileSync(sourcePath, 'utf-8'); // 源码用文本格式传输
                    this.service.broadcast({
                        type: 'SOURCE_DATA',
                        content: fileName, // 相对路径
                        payload: content   // 文本内容
                    });
                } catch (e) {
                    logger.error(`[Collaboration] Failed to read source file ${fileName}: ${e}`);
                }
            }
        }
    }

    /**
     * 处理源码数据接收
     */
    private handleSourceData(message: CollaborationMessage) {
        // Guest 收到数据
        if (this.service.isGuest && message.content && message.payload !== undefined && this.guestWorkspacePath) {
            const fileName = message.content;
            const content = message.payload;
            const filePath = path.join(this.guestWorkspacePath, 'src', fileName);
            
            try {
                // 确保目录存在
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content);
                logger.info(`[Collaboration] Source synced: ${fileName}`);
                
            } catch (e) {
                logger.error(`[Collaboration] Failed to save source file ${fileName}: ${e}`);
            }
        }
    }

    /**
     * 处理 UI 文件列表请求
     */
    private handleUiList(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content === 'REQUEST') {
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const uiDir = ProjectUtils.getUiDir(projectRoot);
            if (fs.existsSync(uiDir)) {
                try {
                    const files = this.getAllFiles(uiDir);
                    const uiFiles = files.filter(f => f.endsWith('.hml'));
                    
                    this.service.broadcast({
                        type: 'UI_LIST',
                        payload: uiFiles
                    });
                } catch (e) {
                    logger.error(`[Collaboration] Failed to list UI files: ${e}`);
                }
            }
            return;
        }
        
        // Guest 收到列表
        if (this.service.isGuest && Array.isArray(message.payload)) {
            const files = message.payload as string[];
            files.forEach(file => {
                 // 检查本地是否存在
                 const localPath = path.join(this.guestWorkspacePath!, 'ui', file);
                 if (!fs.existsSync(localPath)) {
                     // 请求下载
                     this.service.broadcast({
                         type: 'GET_UI',
                         content: file
                     });
                 }
            });
        }
    }

    /**
     * 处理获取单个 UI 文件请求
     */
    private handleGetUi(message: CollaborationMessage) {
        // Host 收到请求
        if (this.service.isHost && message.content) {
            const fileName = message.content;
            const projectRoot = ProjectUtils.findProjectRoot(this.fileManager.currentFilePath || '');
            if (!projectRoot) return;
            
            const uiDir = ProjectUtils.getUiDir(projectRoot);
            const filePath = path.join(uiDir, fileName);
            
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    this.service.broadcast({
                        type: 'UI_DATA',
                        content: fileName,
                        payload: content
                    });
                } catch (e) {
                    logger.error(`[Collaboration] Failed to read UI file ${fileName}: ${e}`);
                }
            }
        }
    }

    /**
     * 处理 UI 文件数据接收
     */
    private handleUiData(message: CollaborationMessage) {
        // Guest 收到数据
        if (this.service.isGuest && message.content && message.payload !== undefined && this.guestWorkspacePath) {
            const fileName = message.content;
            const content = message.payload;
            const filePath = path.join(this.guestWorkspacePath, 'ui', fileName);
            
            try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content);
                logger.info(`[Collaboration] UI file synced: ${fileName}`);
                
            } catch (e) {
                logger.error(`[Collaboration] Failed to save UI file ${fileName}: ${e}`);
            }
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

                        // 触发自动代码生成
                        this.messageHandler.triggerAutoCodeGeneration();
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
