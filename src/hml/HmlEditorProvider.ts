import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DesignerPanel } from '../designer/DesignerPanel';
import { HmlController } from './HmlController';

/**
 * HML 文件自定义编辑器提供器
 * 实现 CustomTextEditorProvider 接口，提供设计器视图
 */
export class HmlEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'honeygui.hmlEditor';
    private hmlController: HmlController;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.hmlController = new HmlController();
    }

    /**
     * 当用户打开 HML 文件时调用此方法
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        console.log(`[HmlEditorProvider] resolveCustomTextEditor被调用: ${document.fileName}`);
        
        // 设置 Webview 选项
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'designer', 'webview')
            ]
        };

        // 获取文件名作为标题
        const fileName = path.basename(document.fileName);
        webviewPanel.title = `HML Designer: ${fileName}`;
        console.log(`[HmlEditorProvider] 设置面板标题: ${webviewPanel.title}`);

        // 创建设计器面板实例
        const designerPanel = new DesignerPanel(webviewPanel, this.context);
        console.log(`[HmlEditorProvider] 创建DesignerPanel实例`);

        // 加载文档内容到设计器
        console.log(`[HmlEditorProvider] 开始加载文档内容到设计器`);
        console.log(`[HmlEditorProvider] 加载的文件路径: ${document.uri.fsPath}`);
        console.log(`[HmlEditorProvider] 加载的实际内容:\n${'='.repeat(50)}\n${document.getText()}\n${'='.repeat(50)}`);

        await designerPanel.loadFromDocument(document);

        console.log(`[HmlEditorProvider] 文档内容加载完成`);
        console.log(`[HmlEditorProvider] 加载到内存内存里面的内容如下:`);
        const hmlController = (designerPanel as any)._hmlController;
        if (hmlController && hmlController.currentDocument) {
            console.log(`[HmlEditorProvider] 内存中的组件数量: ${hmlController.currentDocument.view?.components?.length || 0}`);
            const components = hmlController.currentDocument.view?.components || [];
            console.log(`[HmlEditorProvider] 内存中的组件列表:`,
                components.map((c: any) => `${c.type}(id=${c.id}, name=${c.name}, parent=${c.parent})`).join(', '));
        }

        // 监听保存事件（排除我们自己的保存操作）
        const changeDocumentSubscription = vscode.workspace.onDidSaveTextDocument(doc => {
            // 使用 fsPath 进行可靠的文件路径对比
            // 避免使用 toString() 可能导致的格式和编码问题
            const isSameUri = doc.uri.fsPath === document.uri.fsPath;
            const isInDesignSavingTransaction = designerPanel.getSaveTransactionId() > 0;

            if (isSameUri && !isInDesignSavingTransaction) {
                console.log('[HmlEditorProvider] 检测到保存事件，更新设计器...');
                designerPanel.updateFromDocument();
            }
        });
        
        // 面板关闭时清理监听器
        webviewPanel.onDidDispose(() => {
            console.log('[HmlEditorProvider] 面板关闭，清理监听器');
            changeDocumentSubscription.dispose();
        });
        
        console.log('[HmlEditorProvider] resolveCustomTextEditor完成');
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
