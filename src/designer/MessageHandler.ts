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
import { ConversionConfigService, ConversionConfig } from '../services/ConversionConfigService';

/**
 * 消息处理器 - 负责分发来自Webview的消息
 */
export class MessageHandler {
    private readonly _panel: vscode.WebviewPanel;
    private readonly _assetManager: AssetManager;
    private readonly _codeGenerator: CodeGenerator;
    private readonly _componentManager: ComponentManager;
    private readonly _fileManager: FileManager;
    private readonly _hmlController: HmlController;
    private readonly _collaborationService: CollaborationService;
    private _autoCodeGenTimer: NodeJS.Timeout | null = null;

    constructor(
        panel: vscode.WebviewPanel,
        assetManager: AssetManager,
        codeGenerator: CodeGenerator,
        componentManager: ComponentManager,
        fileManager: FileManager,
        hmlController: HmlController
    ) {
        this._panel = panel;
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
                    vscode.window.showInformationMessage(vscode.l10n.t('No undo action available'));
                }
                break;

            case 'redo':
                logger.debug('[MessageHandler] 收到重做请求');
                const redoSuccess = await this._fileManager.redo();
                this._fileManager.sendUndoRedoState();
                if (!redoSuccess) {
                    vscode.window.showInformationMessage(vscode.l10n.t('No redo action available'));
                }
                break;

            case 'selectImagePath':
                this._assetManager.handleSelectImagePath(message.componentId, message.propertyName, message.callbackId, this._fileManager.currentFilePath);
                break;

            case 'selectFolderImages':
                this._assetManager.handleSelectFolderImages(message.callbackId, this._fileManager.currentFilePath);
                break;

            case 'selectGlassPath':
                this._assetManager.handleSelectGlassPath(message.componentId, this._fileManager.currentFilePath);
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
                    message.componentId,
                    message.callbackId
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

            case 'getImageSizeForComponent':
                this._assetManager.handleGetImageSizeForComponent(
                    message.componentId,
                    message.imagePath,
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

            case 'createGlassComponent':
                this._assetManager.handleCreateGlassComponent(
                    message.glassPath,
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

            case 'browseCharsetFile':
                this._handleBrowseCharsetFile(message.componentId, message.charsetIndex, message.fileType, message.filters);
                break;

            case 'loadConversionConfig':
                this._handleLoadConversionConfig();
                break;

            case 'saveConversionConfig':
                this._handleSaveConversionConfig(message.config, message.changedPath, message.changedField);
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
                vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
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
                openLabel: 'Select File',
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
            vscode.window.showErrorMessage(vscode.l10n.t('File browse failed: {0}', error instanceof Error ? error.message : vscode.l10n.t('Unknown error')));
        }
    }

    /**
     * 处理字符集文件浏览
     */
    private async _handleBrowseCharsetFile(componentId: string, charsetIndex: number, fileType: string, filters: any): Promise<void> {
        try {
            const projectRoot = this._fileManager.currentFilePath 
                ? ProjectUtils.findProjectRoot(this._fileManager.currentFilePath)
                : undefined;
            
            if (!projectRoot) {
                vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
                return;
            }

            // 根据文件类型设置默认路径
            let defaultPath = projectRoot;
            if (fileType === 'file') {
                // CST 文件默认路径：tools/font-converter/charset
                const charsetPath = path.join(projectRoot, 'tools', 'font-converter', 'charset');
                if (fs.existsSync(charsetPath)) {
                    defaultPath = charsetPath;
                }
            } else if (fileType === 'codepage') {
                // CodePage 文件默认路径：tools/font-converter/CodePage
                const codepagePath = path.join(projectRoot, 'tools', 'font-converter', 'CodePage');
                if (fs.existsSync(codepagePath)) {
                    defaultPath = codepagePath;
                }
            }

            // 构建文件过滤器
            const fileFilters: { [name: string]: string[] } = {};
            if (filters && Object.keys(filters).length > 0) {
                Object.keys(filters).forEach(key => {
                    fileFilters[key] = filters[key];
                });
            } else {
                // CodePage 文件没有后缀，显示所有文件
                fileFilters[vscode.l10n.t('All Files')] = ['*'];
            }

            // 打开文件选择对话框
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: vscode.l10n.t('Select File'),
                filters: Object.keys(fileFilters).length > 0 ? fileFilters : undefined,
                defaultUri: vscode.Uri.file(defaultPath)
            });

            if (uris && uris.length > 0) {
                const selectedPath = uris[0].fsPath;
                // 转换为相对于项目根目录的路径
                let relativePath = path.relative(projectRoot, selectedPath);
                // 统一使用正斜杠
                relativePath = relativePath.replace(/\\/g, '/');

                // 获取组件
                const component = this._hmlController.findComponent(componentId);
                if (component && component.data) {
                    const charsets = (component.data as any).characterSets || [];
                    if (charsetIndex >= 0 && charsetIndex < charsets.length) {
                        // 更新指定索引的字符集值
                        charsets[charsetIndex].value = relativePath;
                        this._componentManager.updateComponentProperty(componentId, 'characterSets', charsets);
                    }
                }
            }
        } catch (error) {
            logger.error(`[MessageHandler] 字符集文件浏览失败: ${error}`);
            vscode.window.showErrorMessage(vscode.l10n.t('File browse failed: {0}', error instanceof Error ? error.message : vscode.l10n.t('Unknown error')));
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
            vscode.window.showInformationMessage(vscode.l10n.t('Preview feature is under development...'));
        } catch (error) {
            logger.error(`预览失败: ${error}`);
            vscode.window.showErrorMessage(vscode.l10n.t('Preview failed: {0}', error instanceof Error ? error.message : vscode.l10n.t('Unknown error')));
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
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to switch file: {0}', error instanceof Error ? error.message : vscode.l10n.t('Unknown error')));
        }
    }

    /**
     * 处理跳转到槽函数
     */
    private async _handleGotoSlot(componentId: string, componentName: string): Promise<void> {
        try {
            const currentFile = this._fileManager.currentFilePath;
            if (!currentFile) {
                vscode.window.showErrorMessage(vscode.l10n.t('Current HML file not found'));
                return;
            }

            // 获取项目根目录
            const projectRoot = ProjectUtils.findProjectRoot(currentFile);
            if (!projectRoot) {
                vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
                return;
            }

            // 获取设计稿名称（从HML文件名提取，不含扩展名）
            const designName = path.basename(currentFile, '.hml');

            // 构建回调文件路径
            const callbackFile = path.join(projectRoot, 'src', 'callbacks', `${designName}_callbacks.c`);
            
            // 检查文件是否存在，如果不存在则先生成代码
            if (!fs.existsSync(callbackFile)) {
                const result = await vscode.window.showInformationMessage(
                    vscode.l10n.t('The callback file already exists. Do you want to overwrite it?'),
                    vscode.l10n.t('Overwrite'), vscode.l10n.t('Cancel')
                );
                
                if (result === vscode.l10n.t('Overwrite')) {
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
                vscode.window.showWarningMessage(vscode.l10n.t('Function {0} not found, please check if code generation is correct', functionName));
            }

        } catch (error) {
            logger.error(`[MessageHandler] 跳转到槽函数失败: ${error}`);
            vscode.window.showErrorMessage(vscode.l10n.t('Jump failed: {0}', String(error)));
        }
    }

    /**
     * 处理加载转换配置
     * 从配置文件加载转换配置并发送到 webview
     */
    private _handleLoadConversionConfig(): void {
        try {
            const projectRoot = this._fileManager.currentFilePath
                ? ProjectUtils.findProjectRoot(this._fileManager.currentFilePath)
                : undefined;

            if (!projectRoot) {
                logger.warn('[MessageHandler] 无法加载转换配置：未找到项目根目录');
                return;
            }

            const configService = ConversionConfigService.getInstance();
            const config = configService.loadConfig(projectRoot);

            // 发送配置到 webview
            this._panel.webview.postMessage({
                command: 'conversionConfigLoaded',
                config
            });

            logger.debug('[MessageHandler] 转换配置已加载并发送到 webview');
        } catch (error) {
            logger.error(`[MessageHandler] 加载转换配置失败: ${error}`);
            // 发送空配置，让前端使用默认值
            this._panel.webview.postMessage({
                command: 'conversionConfigLoaded',
                config: null,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * 处理保存转换配置
     * 将配置保存到配置文件
     * @param config 转换配置对象
     * @param changedPath 变更的资源路径（可选）
     * @param changedField 变更的字段名（可选）
     */
    private _handleSaveConversionConfig(config: ConversionConfig, changedPath?: string, changedField?: string): void {
        try {
            const projectRoot = this._fileManager.currentFilePath
                ? ProjectUtils.findProjectRoot(this._fileManager.currentFilePath)
                : undefined;

            if (!projectRoot) {
                logger.warn('[MessageHandler] 无法保存转换配置：未找到项目根目录');
                vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
                return;
            }

            if (!config) {
                logger.warn('[MessageHandler] 无法保存转换配置：配置为空');
                return;
            }

            const configService = ConversionConfigService.getInstance();
            configService.saveConfig(projectRoot, config);

            logger.debug('[MessageHandler] 转换配置已保存');
            
            // 如果是视频格式变更，自动触发代码生成
            if (changedField === 'videoFormat') {
                logger.info('[MessageHandler] 视频格式变更，自动触发代码生成');
                this.handleGenerateCode().catch(err => {
                    logger.error(`[MessageHandler] 自动代码生成失败: ${err}`);
                });
            }
        } catch (error) {
            logger.error(`[MessageHandler] 保存转换配置失败: ${error}`);
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to save conversion config: {0}', error instanceof Error ? error.message : String(error)));
        }
    }
}
