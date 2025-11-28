import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { ProjectConfigLoader } from '../utils/ProjectConfigLoader';
import { SaveManager } from './SaveManager';
import { HmlContentComparator } from '../utils/HmlContentComparator';

/**
 * 文件管理器 - 处理文件的加载、保存和更新
 */
export class FileManager {
    private readonly _panel: vscode.WebviewPanel;
    private readonly _hmlController: HmlController;
    private readonly _saveManager: SaveManager;
    private _filePath: string | undefined;
    private _lastSerializedSnapshot: string | null = null;
    
    // 事件发射器
    private readonly _onDidUpdateTitle = new vscode.EventEmitter<string>();
    
    // 事件
    public readonly onDidUpdateTitle = this._onDidUpdateTitle.event;

    constructor(panel: vscode.WebviewPanel, hmlController: HmlController, saveManager: SaveManager) {
        this._panel = panel;
        this._hmlController = hmlController;
        this._saveManager = saveManager;
    }

    public get currentFilePath(): string | undefined {
        return this._filePath;
    }

    public set currentFilePath(path: string | undefined) {
        this._filePath = path;
    }

    /**
     * 加载文件
     */
    public async loadFile(filePath: string): Promise<void> {
        this._filePath = filePath;
        
        try {
            // 使用HML控制器加载文件
            const document = await this._hmlController.loadFile(filePath);
            
            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();
            
            logger.debug(`[HoneyGUI Designer] 设计器配置加载中...`);

            // 发送HML内容和配置信息到Webview
            this.sendLoadHmlMessage(document, hmlContent);
                
            // 更新面板标题
            const fileName = path.basename(filePath);
            this._onDidUpdateTitle.fire(`HoneyGUI 设计器 - ${fileName}`);
                
        } catch (error) {
            logger.error(`加载HML文件失败: ${error}`);
            vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
            
            // 如果加载失败，创建一个新的空白文档
            this.createNewDocument();
        }
    }
    
    /**
     * 创建新的空白文档
     */
    public createNewDocument(): void {
        try {
            // 创建新的HML文档
            const document = this._hmlController.createNewDocument();

            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();
            
            // 为前端准备组件数据
            const frontendComponents = this._hmlController.prepareComponentsForFrontend(document);

            // 使用统一的配置加载器
            const projectConfig = ProjectConfigLoader.loadConfig();
            const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
            
            // 发送HML内容和配置到Webview
            this._panel.webview.postMessage({
                command: 'loadHml',
                content: hmlContent,
                document: {
                    ...document,
                    view: {
                        ...document.view,
                        components: frontendComponents
                    }
                },
                components: frontendComponents,
                projectConfig: projectConfig,
                designerConfig: designerConfig
            });

            // 更新面板标题
            this._onDidUpdateTitle.fire('HoneyGUI 设计器 - 未命名');
            this._filePath = undefined;

        } catch (error) {
            logger.error(`创建新文档失败: ${error}`);
            vscode.window.showErrorMessage(`创建新文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 从 TextDocument 加载内容（用于 CustomTextEditorProvider）
     */
    public async loadFromDocument(document: vscode.TextDocument): Promise<void> {
        this._filePath = document.uri.fsPath;

        logger.info(`[FileManager] loadFromDocument: 开始加载文件 ${this._filePath}`);

        try {
            const content = document.getText();
            logger.debug(`[FileManager] 文件内容长度: ${content.length} 字符`);

            // 解析文档内容
            logger.debug(`[FileManager] 解析HML内容...`);
            const hmlDocument = this._hmlController.parseContent(content);
            logger.info(`[FileManager] 解析完成，获得 ${hmlDocument.view?.components?.length || 0} 个组件`);

            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();
            logger.debug(`[FileManager] 序列化完成，内容长度: ${hmlContent.length}`);

            // 为前端准备组件数据
            logger.debug(`[FileManager] 准备前端组件数据...`);
            const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
            logger.info(`[FileManager] 前端组件数据准备完成，共 ${frontendComponents.length} 个组件`);

            // 使用统一的配置加载器
            const projectConfig = ProjectConfigLoader.loadConfig(document.uri.fsPath);
            const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
            logger.debug(`[FileManager] 项目配置加载完成`);

            // 发送内容到 Webview（不延迟，由前端ready消息触发重新加载）
            logger.info(`[FileManager] 初始loadHml准备完成，等待前端ready消息`);
            // 不立即发送，等待前端ready

            // 更新面板标题
            const fileName = path.basename(document.fileName);
            this._onDidUpdateTitle.fire(`HoneyGUI Designer: ${fileName}`);
            logger.info(`[FileManager] 文件加载完成并发送到前端: ${fileName}`);

        } catch (error) {
            logger.error(`从文档加载HML失败: ${error}`);
            vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);

            // 如果加载失败，创建一个新的空白文档
            this.createNewDocument();
        }
    }

    /**
     * 从文档更新内容（当文档在外部被修改时）
     */
    public async updateFromDocument(): Promise<void> {
        // 如果正在保存事务中，不执行更新（避免我们自己的保存操作触发重新加载）
        if (this._saveManager.getCurrentTransactionId() > 0) {
            logger.debug('[FileManager] 正在保存事务中，跳过updateFromDocument');
            return;
        }

        if (this._filePath) {
            try {
                logger.debug(`[FileManager] updateFromDocument: 重新加载文件 ${this._filePath}`);
                const document = await vscode.workspace.openTextDocument(this._filePath);
                const diskContent = document.getText();
                
                // 使用智能内容对比机制
                if (this._lastSerializedSnapshot) {
                    const comparison = HmlContentComparator.smartCompare(
                        diskContent,
                        this._lastSerializedSnapshot
                    );
                    
                    if (comparison.isEqual) {
                        logger.debug('[FileManager] 智能对比：保存后的内容与内存一致，跳过重载');
                        logger.debug(`[FileManager] 对比详情: ${comparison.reason}`);
                        // 清空快照，避免后续误匹配
                        this._lastSerializedSnapshot = null;
                        return;
                    } else {
                        logger.debug('[FileManager] 智能对比：文件内容发生变化');
                        logger.debug(`[FileManager] 差异原因: ${comparison.reason}`);
                    }
                } else {
                    logger.debug('[FileManager] 无快照，直接加载文件内容');
                }
                
                logger.debug('[FileManager] 重新加载到设计器');
                await this.loadFromDocument(document);
            } catch (error) {
                logger.error(`更新文档失败: ${error}`);
            }
        }
    }

    /**
     * 保存HML内容
     */
    public async saveHml(content: string): Promise<boolean> {
        try {
            logger.info('[FileManager] 开始保存HML文件');

            // 保存当前序列化快照（用于后续对比）
            this._lastSerializedSnapshot = content;

            if (!this._filePath) {
                logger.info('[FileManager] 没有文件路径，提示用户选择保存位置');

                // 提示用户选择保存位置
                const selectedPath = await this._saveManager.promptSaveLocation(content);
                if (selectedPath) {
                    this._filePath = selectedPath;

                    // 更新面板标题
                    const fileName = path.basename(selectedPath);
                    this._onDidUpdateTitle.fire(`HoneyGUI 设计器 - ${fileName}`);
                } else {
                    logger.info('[FileManager] 用户取消保存');
                    return false;
                }
            }

            // 执行保存
            const filePath = this._filePath;
            if (!filePath) {
                throw new Error('文件路径无效');
            }

            const transactionId = this._saveManager.beginTransaction(filePath, content);
            logger.debug(`[FileManager] 保存事务ID: ${transactionId}`);

            await this._saveManager.executeSave(filePath, content, transactionId);

            logger.info(`[FileManager] 保存成功: ${path.basename(filePath)}`);
            return true;

        } catch (error) {
            logger.error(`[FileManager] 保存失败: ${error}`);
            vscode.window.showErrorMessage(`保存文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return false;
        }
    }

    /**
     * 重新加载当前文档
     */
    public reloadCurrentDocument(): void {
        try {
            if (!this._filePath) {
                logger.warn('[FileManager] reloadCurrentDocument: 没有文件路径');
                return;
            }
            
            const hmlDocument = this._hmlController.currentDocument;
            if (!hmlDocument) {
                logger.warn('[FileManager] reloadCurrentDocument: 没有当前文档');
                return;
            }
            
            const hmlContent = this._hmlController.serializeDocument();
            
            logger.info(`[FileManager] 重新发送loadHml，组件数: ${hmlDocument.view?.components?.length || 0}`);
            
            // 使用统一的发送方法
            this.sendLoadHmlMessage(hmlDocument, hmlContent);
        } catch (error) {
            logger.error(`[FileManager] reloadCurrentDocument失败: ${error}`);
        }
    }

    /**
     * 统一的发送 loadHml 消息方法
     * 负责发送组件数据和项目配置到前端
     */
    private sendLoadHmlMessage(hmlDocument: any, hmlContent: string): void {
        const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
        
        const projectConfig = ProjectConfigLoader.loadConfig(this._filePath!);
        const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
        
        // 获取项目根目录，用于前端转换相对路径
        const projectRoot = ProjectUtils.findProjectRoot(this._filePath!);
        
        this._panel.webview.postMessage({
            command: 'loadHml',
            content: hmlContent,
            document: {
                ...hmlDocument,
                view: {
                    ...hmlDocument.view,
                    components: frontendComponents
                }
            },
            components: frontendComponents,
            projectConfig: projectConfig,
            designerConfig: designerConfig || { canvasBackgroundColor: '#f0f0f0' },
            projectRoot: projectRoot // 发送项目根目录给前端
        });
    }

}
