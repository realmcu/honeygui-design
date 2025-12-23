import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
    
    // 撤销/重做历史栈
    private _undoStack: string[] = [];
    private _redoStack: string[] = [];
    private readonly _maxHistorySize = 50;
    
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
     * 记录当前状态到撤销栈（在保存前调用）
     */
    public pushUndoState(hmlContent: string): void {
        // 避免重复记录相同内容
        if (this._undoStack.length > 0 && this._undoStack[this._undoStack.length - 1] === hmlContent) {
            return;
        }
        
        this._undoStack.push(hmlContent);
        
        // 限制栈大小
        if (this._undoStack.length > this._maxHistorySize) {
            this._undoStack.shift();
        }
        
        // 新操作清空重做栈
        this._redoStack = [];
        
        logger.debug(`[FileManager] 记录撤销状态，当前栈深度: ${this._undoStack.length}`);
    }
    
    /**
     * 撤销
     */
    public async undo(): Promise<boolean> {
        if (this._undoStack.length === 0 || !this._filePath) {
            logger.debug('[FileManager] 无法撤销：栈为空或无文件');
            return false;
        }
        
        // 获取当前内容作为重做状态
        const document = await vscode.workspace.openTextDocument(this._filePath);
        const currentContent = document.getText();
        this._redoStack.push(currentContent);
        
        // 弹出上一个状态
        const previousContent = this._undoStack.pop()!;
        
        // 写入文件
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            previousContent
        );
        await vscode.workspace.applyEdit(edit);
        await document.save();
        
        // 重新加载到前端
        await this.reloadCurrentDocument();
        
        logger.info(`[FileManager] 撤销成功，剩余撤销栈: ${this._undoStack.length}`);
        return true;
    }
    
    /**
     * 重做
     */
    public async redo(): Promise<boolean> {
        if (this._redoStack.length === 0 || !this._filePath) {
            logger.debug('[FileManager] 无法重做：栈为空或无文件');
            return false;
        }
        
        // 获取当前内容作为撤销状态
        const document = await vscode.workspace.openTextDocument(this._filePath);
        const currentContent = document.getText();
        this._undoStack.push(currentContent);
        
        // 弹出重做状态
        const nextContent = this._redoStack.pop()!;
        
        // 写入文件
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            nextContent
        );
        await vscode.workspace.applyEdit(edit);
        await document.save();
        
        // 重新加载到前端
        await this.reloadCurrentDocument();
        
        logger.info(`[FileManager] 重做成功，剩余重做栈: ${this._redoStack.length}`);
        return true;
    }
    
    /**
     * 检查是否可以撤销
     */
    public canUndo(): boolean {
        return this._undoStack.length > 0;
    }
    
    /**
     * 检查是否可以重做
     */
    public canRedo(): boolean {
        return this._redoStack.length > 0;
    }
    
    /**
     * 清空历史（切换文件时调用）
     */
    public clearHistory(): void {
        this._undoStack = [];
        this._redoStack = [];
        logger.debug('[FileManager] 清空撤销/重做历史');
    }
    
    /**
     * 发送撤销/重做状态到前端
     */
    public sendUndoRedoState(): void {
        this._panel.webview.postMessage({
            command: 'undoRedoState',
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * 加载文件
     */

    /**
     * 扫描项目中所有 HML 文件
     */
    private scanAllHmlFiles(currentFilePath: string): Array<{path: string, name: string, relativePath: string}> {
        const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
        if (!projectRoot) {
            return [];
        }

        const uiDir = ProjectUtils.getUiDir(projectRoot);
        if (!fs.existsSync(uiDir)) {
            return [];
        }

        const allFiles: Array<{path: string, name: string, relativePath: string}> = [];
        const designDirs = fs.readdirSync(uiDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const designName of designDirs) {
            const designDir = path.join(uiDir, designName);
            const files = fs.readdirSync(designDir);
            
            for (const file of files) {
                if (file.endsWith('.hml')) {
                    const hmlPath = path.join(designDir, file);
                    const relativePath = path.relative(projectRoot, hmlPath);
                    allFiles.push({
                        path: hmlPath,
                        name: file,
                        relativePath: relativePath
                    });
                }
            }
        }

        return allFiles;
    }

    /**
     * 扫描项目中所有 HML 文件的 view（包含跳转关系）
     */
    private async scanAllViews(currentFilePath: string): Promise<Array<{id: string, name: string, file: string, edges: Array<{target: string, event: string, switchOutStyle?: string, switchInStyle?: string}>}>> {
        const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
        if (!projectRoot) {
            return [];
        }

        const uiDir = ProjectUtils.getUiDir(projectRoot);
        if (!fs.existsSync(uiDir)) {
            return [];
        }

        const allViews: Array<{id: string, name: string, file: string, edges: Array<{target: string, event: string, switchOutStyle?: string, switchInStyle?: string}>}> = [];
        const designDirs = fs.readdirSync(uiDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const designName of designDirs) {
            const designDir = path.join(uiDir, designName);
            const files = fs.readdirSync(designDir);
            
            for (const file of files) {
                if (file.endsWith('.hml')) {
                    const hmlPath = path.join(designDir, file);
                    try {
                        const tempController = new HmlController();
                        const doc = await tempController.loadFile(hmlPath);
                        
                        // 提取所有 hg_view 及其跳转关系
                        const extractViews = (components: any[]): void => {
                            for (const comp of components) {
                                if (comp.type === 'hg_view') {
                                    // 提取跳转边
                                    const edges: Array<{target: string, event: string, switchOutStyle?: string, switchInStyle?: string}> = [];
                                    if (comp.eventConfigs) {
                                        for (const eventConfig of comp.eventConfigs) {
                                            for (const action of eventConfig.actions || []) {
                                                if (action.type === 'switchView' && action.target) {
                                                    edges.push({
                                                        target: action.target,
                                                        event: eventConfig.type,
                                                        switchOutStyle: action.switchOutStyle,
                                                        switchInStyle: action.switchInStyle,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    
                                    allViews.push({
                                        id: comp.id,
                                        name: comp.name || comp.id,
                                        file: designName,
                                        edges,
                                    });
                                }
                                if (comp.children && comp.children.length > 0) {
                                    extractViews(comp.children);
                                }
                            }
                        };
                        
                        if (doc.view && doc.view.components) {
                            extractViews(doc.view.components);
                        }
                    } catch (err) {
                        logger.warn(`扫描 ${hmlPath} 失败: ${err}`);
                    }
                }
            }
        }

        return allViews;
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
     * 从 TextDocument 加载内容（CustomTextEditorProvider 入口）
     * 不立即发送，等待前端 ready 消息后由 reloadCurrentDocument() 发送
     */
    public async loadFromDocument(document: vscode.TextDocument): Promise<void> {
        this._filePath = document.uri.fsPath;

        logger.info(`[FileManager] loadFromDocument: 开始加载文件 ${this._filePath}`);

        try {
            const content = document.getText();

            // 解析文档内容
            const hmlDocument = this._hmlController.parseContent(content);
            logger.info(`[FileManager] 解析完成，获得 ${hmlDocument.view?.components?.length || 0} 个组件`);

            // 为前端准备组件数据（预处理，等待 ready 消息后发送）
            const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
            logger.info(`[FileManager] 前端组件数据准备完成，共 ${frontendComponents.length} 个组件`);

            // 不立即发送，等待前端 ready 消息后由 reloadCurrentDocument 发送
            logger.info(`[FileManager] 初始loadHml准备完成，等待前端ready消息`);

            // 更新面板标题
            const fileName = path.basename(document.fileName);
            this._onDidUpdateTitle.fire(`HoneyGUI Designer: ${fileName}`);
            logger.info(`[FileManager] 文件加载完成并发送到前端: ${fileName}`);

        } catch (error) {
            logger.error(`从文档加载HML失败: ${error}`);
            vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
    public async reloadCurrentDocument(): Promise<void> {
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
            
            // 使用统一的发送方法（内部会自动获取 allViews）
            await this.sendLoadHmlMessage(hmlDocument, hmlContent);
        } catch (error) {
            logger.error(`[FileManager] reloadCurrentDocument失败: ${error}`);
        }
    }

    /**
     * 统一的发送 loadHml 消息方法
     * 负责发送组件数据和项目配置到前端
     * 自动扫描并包含所有 view 列表和所有 HML 文件列表
     */
    private async sendLoadHmlMessage(hmlDocument: any, hmlContent: string): Promise<void> {
        const frontendComponents = this._hmlController.prepareComponentsForFrontend(hmlDocument);
        
        const projectConfig = ProjectConfigLoader.loadConfig(this._filePath!);
        const designerConfig = ProjectConfigLoader.getDesignerConfig(projectConfig);
        
        // 获取项目根目录
        const projectRoot = ProjectUtils.findProjectRoot(this._filePath!);
        
        // 扫描所有 view（统一在此处获取）
        const allViews = await this.scanAllViews(this._filePath!);
        
        // 扫描所有 HML 文件
        const allHmlFiles = this.scanAllHmlFiles(this._filePath!);
        
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
            designerConfig: designerConfig || { canvasBackgroundColor: '#3c3c3c' },
            projectRoot: projectRoot,
            allViews: allViews,
            allHmlFiles: allHmlFiles,
            currentFilePath: this._filePath
        });
    }

}
