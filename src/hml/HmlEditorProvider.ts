import * as vscode from 'vscode';
import * as path from 'path';
import { DesignerPanel } from '../designer/DesignerPanel';
import { ProjectUtils } from '../utils/ProjectUtils';
import { logger } from '../utils/Logger';

/**
 * HML 文件自定义编辑器提供器
 * 实现 CustomTextEditorProvider 接口，提供设计器视图
 */
export class HmlEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'honeygui.hmlEditor';
    private static activePanels: Set<DesignerPanel> = new Set();

    constructor(private readonly context: vscode.ExtensionContext) {
        // 注册广播命令
        context.subscriptions.push(
            vscode.commands.registerCommand('_honeygui.broadcastToWebviews', (message: any) => {
                HmlEditorProvider.broadcastMessage(message);
            })
        );
    }

    /**
     * 广播消息到所有活动的 Webview
     */
    private static broadcastMessage(message: any): void {
        this.activePanels.forEach(panel => {
            panel.sendMessage(message.command, message);
        });
    }

    /**
     * 当用户打开 HML 文件时调用此方法
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        logger.info(`[HmlEditorProvider] resolveCustomTextEditor被调用: ${document.fileName}`);
        
        // 计算 localResourceRoots
        const localRoots: vscode.Uri[] = [
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'designer', 'webview'),
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'designer', 'webview')
        ];
        
        // 从文件路径查找项目根目录
        const projectRoot = ProjectUtils.findProjectRoot(document.uri.fsPath);
        if (projectRoot) {
            localRoots.push(vscode.Uri.file(projectRoot));
            logger.info(`[HmlEditorProvider] 项目根目录: ${projectRoot}`);
        } else {
            // 如果没找到 project.json，使用 HML 文件所在目录的父目录作为项目根目录
            // 假设 HML 文件在 ui/ 目录下，父目录就是项目根目录
            const hmlDir = path.dirname(document.uri.fsPath);
            const parentDir = path.dirname(hmlDir);
            localRoots.push(vscode.Uri.file(parentDir));
            logger.info(`[HmlEditorProvider] 未找到project.json，使用父目录: ${parentDir}`);
        }
        
        logger.info(`[HmlEditorProvider] localResourceRoots: ${localRoots.map(r => r.fsPath).join(', ')}`);
        
        // 设置 Webview 选项
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: localRoots
        };

        // 获取文件名作为标题
        const fileName = path.basename(document.fileName);
        webviewPanel.title = `HML Designer: ${fileName}`;
        logger.debug(`[HmlEditorProvider] 设置面板标题: ${webviewPanel.title}`);

        // 创建设计器面板实例
        const designerPanel = new DesignerPanel(webviewPanel, this.context);
        logger.debug(`[HmlEditorProvider] 创建DesignerPanel实例`);

        // 注册到活动面板集合
        HmlEditorProvider.activePanels.add(designerPanel);

        // 监听面板关闭，从集合中移除
        webviewPanel.onDidDispose(() => {
            HmlEditorProvider.activePanels.delete(designerPanel);
        });

        // 加载文档内容到设计器
        logger.info(`[HmlEditorProvider] 开始加载文档内容到设计器: ${document.uri.fsPath}`);

        await designerPanel.loadFromDocument(document);

        logger.info(`[HmlEditorProvider] 文档内容加载完成`);

        // 监听保存事件（排除我们自己的保存操作）
        const changeDocumentSubscription = vscode.workspace.onDidSaveTextDocument(doc => {
            // 使用 fsPath 进行可靠的文件路径对比
            // 避免使用 toString() 可能导致的格式和编码问题
            const isSameUri = doc.uri.fsPath === document.uri.fsPath;
            const isInDesignSavingTransaction = designerPanel.getSaveTransactionId() > 0;

            if (isSameUri && !isInDesignSavingTransaction) {
                logger.debug('[HmlEditorProvider] 检测到保存事件，更新设计器...');
                designerPanel.updateFromDocument();
            }
        });
        
        // 面板关闭时清理监听器
        webviewPanel.onDidDispose(() => {
            logger.debug('[HmlEditorProvider] 面板关闭，清理监听器');
            changeDocumentSubscription.dispose();
        });
        
        logger.info('[HmlEditorProvider] resolveCustomTextEditor完成');
    }

    /**
     * 在文本编辑器中打开 HML 文件（右键菜单命令）
     */
    public static async openInTextEditor(uri: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active
        });
    }

    /**
     * 在设计器中打开 HML 文件（右键菜单命令）
     */
    public static async openInDesigner(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
        // 使用 VS Code 的 custom 打开方式
        await vscode.commands.executeCommand(
            'vscode.openWith',
            uri,
            HmlEditorProvider.viewType
        );
    }
}
