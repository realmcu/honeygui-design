import * as vscode from 'vscode';
import { logger } from '../utils/Logger';
import { AssetManager } from './AssetManager';
import { CodeGenManager } from './CodeGenManager';
import { ComponentManager } from './ComponentManager';
import { FileManager } from './FileManager';
import { HmlController } from '../hml/HmlController';

/**
 * 消息处理器 - 负责分发来自Webview的消息
 */
export class MessageHandler {
    private readonly _assetManager: AssetManager;
    private readonly _codeGenManager: CodeGenManager;
    private readonly _componentManager: ComponentManager;
    private readonly _fileManager: FileManager;
    private readonly _hmlController: HmlController;

    constructor(
        assetManager: AssetManager,
        codeGenManager: CodeGenManager,
        componentManager: ComponentManager,
        fileManager: FileManager,
        hmlController: HmlController
    ) {
        this._assetManager = assetManager;
        this._codeGenManager = codeGenManager;
        this._componentManager = componentManager;
        this._fileManager = fileManager;
        this._hmlController = hmlController;
    }

    /**
     * 处理Webview消息
     */
    public async handleMessage(message: any): Promise<void> {
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
                break;

            case 'selectImagePath':
                this._assetManager.handleSelectImagePath(message.componentId, this._fileManager.currentFilePath);
                break;

            case 'preview':
                this._handlePreview(message.content);
                break;

            case 'codegen':
                this._codeGenManager.generateCode(
                    message.language || 'cpp',
                    message.options,
                    message.content,
                    this._fileManager.currentFilePath,
                    async () => {
                        // 保存回调
                        const content = this._hmlController.serializeDocument();
                        return await this._fileManager.saveHml(content);
                    }
                );
                break;

            case 'generateAllCode':
                this._codeGenManager.generateAllCode(this._fileManager.currentFilePath);
                break;

            case 'loadAssets':
                this._assetManager.handleLoadAssets(this._fileManager.currentFilePath);
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
                    message.relativePath
                );
                break;

            case 'convertPathToWebviewUri':
                this._assetManager.handleConvertPathToWebviewUri(message.path, message.requestId, this._fileManager.currentFilePath);
                break;

            case 'notify':
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

            case 'loadFile':
                if (message.filePath) {
                    this._fileManager.loadFile(message.filePath);
                }
                break;
                
            default:
                logger.warn(`[MessageHandler] 未知消息命令: ${message.command}`);
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
}
