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

        // 创建设计器面板实例
        const designerPanel = new DesignerPanel(webviewPanel, this.context);

        // 加载文档内容到设计器
        await designerPanel.loadFromDocument(document);

        // 监听文档变化（排除我们自己的保存操作）
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !designerPanel.isSaving) {
                console.log('[HmlEditorProvider] 检测到文件变化，更新设计器...');
                designerPanel.updateFromDocument();
            }
        });
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
