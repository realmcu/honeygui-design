import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';
import { AssetManager } from './AssetManager';
import { CodeGenerator } from '../services/CodeGenerator';
import { ComponentManager } from './ComponentManager';
import { FileManager } from './FileManager';
import { HmlController } from '../hml/HmlController';
import { CollaborationService } from '../core/CollaborationService';
import { ProjectUtils } from '../utils/ProjectUtils';
import { CodeGenerationService } from '../services/CodeGenerationService';

/**
 * 消息处理器 - 负责分发来自Webview的消息
 */
export class MessageHandler {
    private readonly _assetManager: AssetManager;
    private readonly _codeGenerator: CodeGenerator;
    private readonly _componentManager: ComponentManager;
    private readonly _fileManager: FileManager;
    private readonly _hmlController: HmlController;
    private readonly _collaborationService: CollaborationService;
    private _autoCodeGenTimer: NodeJS.Timeout | null = null;

    constructor(
        assetManager: AssetManager,
        codeGenerator: CodeGenerator,
        componentManager: ComponentManager,
        fileManager: FileManager,
        hmlController: HmlController
    ) {
        this._assetManager = assetManager;
        this._codeGenerator = codeGenerator;
        this._componentManager = componentManager;
        this._fileManager = fileManager;
        this._hmlController = hmlController;
        this._collaborationService = CollaborationService.getInstance();
    }

    /**
     * 处理Webview消息
     * @param message 消息对象
     * @param fromRemote 是否来自远程（协同模式下），默认为 false
     */
    public async handleMessage(message: any, fromRemote: boolean = false): Promise<void> {
        // 协同模式下的消息广播拦截
        // 只有修改操作需要广播，查询类操作不需要
        const broadcastCommands = [
            'addComponent',
            'updateComponent',
            'deleteComponent',
            'saveImageToAssets'
        ];

        // 如果已连接协同，且是需要广播的命令，且该命令不是来自远程（即来自本地Webview操作）
        if (this._collaborationService.isConnected && broadcastCommands.includes(message.command) && !fromRemote) {
            // 无论 Host 还是 Guest，都先广播给对方
            // Guest 发给 Host，Host 广播给所有 Guest
            this._collaborationService.broadcast({
                type: 'OP_DELTA',
                payload: message
            });
            // 乐观更新：本地继续执行，不阻塞用户操作
        }

        switch (message.command) {
            case 'ready':
                logger.info('[MessageHandler] 收到前端ready消息');
                try {
                    await this._fileManager.reloadCurrentDocument();
                } catch (error) {
                    logger.error(`[MessageHandler] reloadCurrentDocument失败: ${error}`);
                }
                break;

            case 'save':
                logger.debug(`[MessageHandler] 收到保存请求，组件数量: ${message?.content?.components?.length || 0}`);
                try {
                    // 保存前记录当前状态到撤销栈
                    const currentFilePath = this._fileManager.currentFilePath;
                    if (currentFilePath) {
                        try {
                            const document = await vscode.workspace.openTextDocument(currentFilePath);
                            const currentContent = document.getText();
                            this._fileManager.pushUndoState(currentContent);
                        } catch (e) {
                            logger.warn(`[MessageHandler] 记录撤销状态失败: ${e}`);
                        }
                    }
                    
                    if (message?.content?.components && Array.isArray(message.content.components)) {
                        logger.debug('[MessageHandler] 更新组件到HmlController...');
                        this._hmlController.updateFromFrontendComponents(message.content.components);
                        logger.debug(`[MessageHandler] 组件更新完成，当前文档组件数: ${this._hmlController.currentDocument?.view?.components?.length || 0}`);
                    }
                } catch (syncErr) {
                    logger.warn(`[MessageHandler] 前端组件同步失败: ${syncErr}`);
                }
                const serializedContent = this._hmlController.serializeDocument();
                logger.debug(`[MessageHandler] 序列化完成，内容长度: ${serializedContent.length}`);
                await this._fileManager.saveHml(message.content?.raw ?? serializedContent);
                
                // 保存后通知前端更新撤销/重做状态
                this._fileManager.sendUndoRedoState();
                
                // 触发自动代码生成（带防抖）
                this._scheduleAutoCodeGeneration();
                break;

            case 'undo':
                logger.debug('[MessageHandler] 收到撤销请求');
                const undoSuccess = await this._fileManager.undo();
                this._fileManager.sendUndoRedoState();
                if (!undoSuccess) {
                    vscode.window.showInformationMessage('没有可撤销的操作');
                }
                break;

            case 'redo':
                logger.debug('[MessageHandler] 收到重做请求');
                const redoSuccess = await this._fileManager.redo();
                this._fileManager.sendUndoRedoState();
                if (!redoSuccess) {
                    vscode.window.showInformationMessage('没有可重做的操作');
                }
                break;

            case 'selectImagePath':
                this._assetManager.handleSelectImagePath(message.componentId, this._fileManager.currentFilePath);
                break;

            case 'preview':
                this._handlePreview(message.content);
                break;

            case 'executeCommand':
                if (message.commandId) {
                    vscode.commands.executeCommand(message.commandId);
                }
                break;

            case 'generateCode':
                this.handleGenerateCode();
                break;

            case 'gotoSlot':
                this._handleGotoSlot(message.componentId, message.componentName);
                break;

            case 'loadAssets':
                this._assetManager.handleLoadAssets(this._fileManager.currentFilePath);
                break;

            case 'getFontFiles':
                this._assetManager.handleGetFontFiles(this._fileManager.currentFilePath);
                break;

            case 'getFontMetrics':
                await this._assetManager.handleGetFontMetrics(
                    message.fontPath,
                    this._fileManager.currentFilePath
                );
                break;

            case 'checkFontGlyphs':
                this._assetManager.handleCheckFontGlyphs(
                    message.fontPath,
                    message.text,
                    message.requestId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'deleteAsset':
                this._assetManager.handleDeleteAsset(message.fileName, this._fileManager.currentFilePath);
                break;

            case 'renameAsset':
                this._assetManager.handleRenameAsset(message.oldPath, message.newName, this._fileManager.currentFilePath);
                break;

            case 'openAssetsFolder':
                this._assetManager.handleOpenAssetsFolder(this._fileManager.currentFilePath);
                break;

            case 'saveImageToAssets':
                this._assetManager.handleSaveImageToAssets(
                    message.fileName,
                    message.fileData,
                    this._fileManager.currentFilePath,
                    message.dropPosition,
                    message.targetContainerId,
                    message.relativePath,
                    message.componentId
                );
                break;

            case 'convertPathToWebviewUri':
                this._assetManager.handleConvertPathToWebviewUri(message.path, message.requestId, this._fileManager.currentFilePath);
                break;

            case 'switchFile':
                await this._handleSwitchFile(message.filePath);
                break;
                break;

            case 'getImageSize':
                this._assetManager.handleGetImageSize(
                    message.imagePath,
                    message.dropPosition,
                    message.targetContainerId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'create3DComponent':
                this._assetManager.handleCreate3DComponent(
                    message.modelPath,
                    message.dropPosition,
                    message.targetContainerId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'getVideoSize':
                this._assetManager.handleGetVideoSize(
                    message.videoPath,
                    message.dropPosition,
                    message.targetContainerId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'getVideoSizeForProperty':
                this._assetManager.handleGetVideoSizeForProperty(
                    message.videoPath,
                    message.componentId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'createVideoComponent':
                this._assetManager.handleCreateVideoComponent(
                    message.videoPath,
                    message.dropPosition,
                    message.targetContainerId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'createSvgComponent':
                this._assetManager.handleCreateSvgComponent(
                    message.svgPath,
                    message.dropPosition,
                    message.targetContainerId,
                    this._fileManager.currentFilePath
                );
                break;

            case 'notify':
                vscode.window.showInformationMessage(message.text);
                break;

            case 'showInfo':
                vscode.window.showInformationMessage(message.text);
                break;

            case 'error':
                vscode.window.showErrorMessage(message.text);
                break;

            case 'addComponent':
                this._componentManager.handleAddComponent(message.parentId, message.component);
                break;

            case 'updateComponent':
                this._componentManager.handleUpdateComponent(message.componentId, message.updates);
                break;

            case 'deleteComponent':
                this._componentManager.handleDeleteComponent(message.componentId);
                break;

            case 'browseFile':
                this._handleBrowseFile(message.componentId, message.propertyName, message.filters);
                break;
                
            default:
                logger.warn(`[MessageHandler] 未知消息命令: ${message.command}`);
        }
    }

    /**
     * 处理文件浏览
     */
    private async _handleBrowseFile(componentId: string, propertyName: string, filters: any): Promise<void> {
        try {
            const projectRoot = this._fileManager.currentFilePath 
                ? ProjectUtils.findProjectRoot(this._fileManager.currentFilePath)
                : undefined;
            
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            // 构建文件过滤器
            const fileFilters: { [name: string]: string[] } = {};
            if (filters) {
                Object.keys(filters).forEach(key => {
                    fileFilters[key] = filters[key];
                });
            }

            // 打开文件选择对话框
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: '选择文件',
                filters: fileFilters,
                defaultUri: vscode.Uri.file(projectRoot)
            });

            if (uris && uris.length > 0) {
                const selectedPath = uris[0].fsPath;
                // 转换为相对于项目根目录的路径
                let relativePath = path.relative(projectRoot, selectedPath);
                // 统一使用正斜杠
                relativePath = relativePath.replace(/\\/g, '/');

                // 发送更新消息给 webview
                this._componentManager.updateComponentProperty(componentId, propertyName, relativePath);
            }
        } catch (error) {
            logger.error(`[MessageHandler] 文件浏览失败: ${error}`);
            vscode.window.showErrorMessage(`文件浏览失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 预览UI (暂时保留在这里，后续可能也需要移出)
     */
    private async _handlePreview(content: string): Promise<void> {
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
    private async handleGenerateCode(): Promise<void> {
        await CodeGenerationService.generateFromFile(this._fileManager.currentFilePath, this._codeGenerator);
    }

    /**
     * 调度自动代码生成（带防抖）
     * 保存HML后2秒自动生成代码，如果2秒内再次保存则重置计时器
     */
    private _scheduleAutoCodeGeneration(): void {
        // 清除之前的计时器
        if (this._autoCodeGenTimer) {
            clearTimeout(this._autoCodeGenTimer);
        }

        // 设置新的计时器
        this._autoCodeGenTimer = setTimeout(() => {
            logger.info('[MessageHandler] 自动触发代码生成');
            this.handleGenerateCode().catch(err => {
                logger.error(`[MessageHandler] 自动代码生成失败: ${err}`);
            });
        }, 2000); // 2秒延迟
    }

    /**
     * 切换到其他 HML 文件
     */
    private async _handleSwitchFile(filePath: string): Promise<void> {
        try {
            logger.info(`[MessageHandler] 切换文件: ${filePath}`);
            
            // 打开文档
            const document = await vscode.workspace.openTextDocument(filePath);
            
            // 更新 FileManager 的当前文件路径
            this._fileManager.currentFilePath = filePath;
            
            // 加载文档内容
            await this._fileManager.loadFromDocument(document);
            
            // 重新加载并发送到前端
            await this._fileManager.reloadCurrentDocument();
            
            logger.info(`[MessageHandler] 文件切换完成: ${path.basename(filePath)}`);
        } catch (error) {
            logger.error(`[MessageHandler] 切换文件失败: ${error}`);
            vscode.window.showErrorMessage(`切换文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 处理跳转到槽函数
     */
    private async _handleGotoSlot(componentId: string, componentName: string): Promise<void> {
        try {
            const currentFile = this._fileManager.currentFilePath;
            if (!currentFile) {
                vscode.window.showErrorMessage('未找到当前HML文件');
                return;
            }

            // 获取项目根目录
            const projectRoot = ProjectUtils.findProjectRoot(currentFile);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            // 获取设计稿名称（从HML文件名提取，不含扩展名）
            const designName = path.basename(currentFile, '.hml');

            // 构建回调文件路径
            const callbackFile = path.join(projectRoot, 'src', 'callbacks', `${designName}_callbacks.c`);
            
            // 检查文件是否存在，如果不存在则先生成代码
            if (!fs.existsSync(callbackFile)) {
                const result = await vscode.window.showInformationMessage(
                    '回调文件不存在，是否先生成代码？',
                    '生成', '取消'
                );
                
                if (result === '生成') {
                    await this.handleGenerateCode();
                    // 等待一下确保文件生成完成
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    return;
                }
            }

            // 打开文件
            const document = await vscode.workspace.openTextDocument(callbackFile);
            const editor = await vscode.window.showTextDocument(document);

            // 查找槽函数位置
            const text = document.getText();
            const functionName = `on_${componentName}_click`;
            const regex = new RegExp(`void\\s+${functionName}\\s*\\(`, 'i');
            const match = regex.exec(text);

            if (match) {
                const position = document.positionAt(match.index);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            } else {
                vscode.window.showWarningMessage(`未找到函数 ${functionName}，请检查代码生成是否正确`);
            }

        } catch (error) {
            logger.error(`[MessageHandler] 跳转到槽函数失败: ${error}`);
            vscode.window.showErrorMessage(`跳转失败: ${error}`);
        }
    }
}
