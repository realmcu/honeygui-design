import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HmlController } from '../hml/HmlController';
import { Component } from '../hml/HmlParser';
import { CodeGeneratorFactory, CodeGeneratorOptions } from '../codegen/CodeGenerator';

/**
 * 设计器Webview面板管理类
 */
export class DesignerPanel {
    public static currentPanel: DesignerPanel | undefined;
    public static readonly viewType = 'honeyguiDesigner';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private readonly _hmlController: HmlController;
    private _filePath: string | undefined;

    /**
     * 创建或获取现有的设计器面板
     */
    public static createOrShow(context: vscode.ExtensionContext, filePath?: string): DesignerPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已有面板，则显示并返回
        if (DesignerPanel.currentPanel) {
            DesignerPanel.currentPanel._panel.reveal(column);
            
            // 如果提供了文件路径，加载该文件
            if (filePath) {
                DesignerPanel.currentPanel._loadFile(filePath);
            }
            
            return DesignerPanel.currentPanel;
        }

        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            DesignerPanel.viewType,
            'HoneyGUI 设计器',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'designer', 'webview'),
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'designer', 'webview')
                ]
            }
        );

        DesignerPanel.currentPanel = new DesignerPanel(panel, context);
        
        // 如果提供了文件路径，加载该文件，否则创建新文档
        if (filePath) {
            DesignerPanel.currentPanel._loadFile(filePath);
        } else {
            DesignerPanel.currentPanel._createNewDocument();
        }
        
        return DesignerPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;
        this._hmlController = new HmlController();

        // 设置Webview内容
        this._update();

        // 处理面板关闭事件
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 处理面板可见性变化
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // 处理来自Webview的消息
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'save':
                        this._saveHml(message.content);
                        break;
                    case 'preview':
                        this._previewUi(message.content);
                        break;
                    case 'codegen':
                this._generateCode(message.language || 'cpp', message.options, message.content);
                break;
                    case 'notify':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        break;
                    case 'addComponent':
                        this._handleAddComponent(message.parentId, message.component);
                        break;
                    case 'updateComponent':
                        this._handleUpdateComponent(message.componentId, message.updates);
                        break;
                    case 'deleteComponent':
                        this._handleDeleteComponent(message.componentId);
                        break;
                    case 'loadFile':
                        if (message.filePath) {
                            this._loadFile(message.filePath);
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * 更新Webview内容
     */
    private _update(): void {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    /**
     * 获取Webview的HTML内容
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        try {
            // 获取构建后的资源路径
            const onDiskPath = vscode.Uri.joinPath(
                this._extensionUri,
                'out',
                'designer',
                'webview'
            );
            const webviewUri = webview.asWebviewUri(onDiskPath);

            // 读取HTML文件内容
            const htmlPath = vscode.Uri.joinPath(onDiskPath, 'index.html');
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // 查找带哈希的JS和CSS文件
            // Webpack生成格式: main.{hash}.js 和 main.{hash}.css
            const files = fs.readdirSync(onDiskPath.fsPath);
            const jsFile = files.find(f => /^main\..+\.js$/.test(f));
            const cssFile = files.find(f => /^main\..+\.css$/.test(f));

            if (!jsFile || !cssFile) {
                throw new Error('未找到构建后的JS或CSS文件');
            }

            // 生成资源URL (正确方式)
            const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, cssFile));
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(onDiskPath, jsFile));

            // 替换资源URL (使用正确的Webview URI)
            // 删除 Webpack 自动插入的带哈希的引用（它们未经 webview.asWebviewUri 转换）
            // 替换旧的 styles.css 和 webview.js 引用
            htmlContent = htmlContent.replace(/<link href="main\..+\.css"[^>]*>/g, ''); // 删除 Webpack 插入的 CSS
            htmlContent = htmlContent.replace(/<script defer="defer" src="main\..+\.js"><\/script>/g, ''); // 删除 Webpack 插入的 JS

            // 替换模板中的占位符
            htmlContent = htmlContent.replace(/href="styles.css"/g, `href="${stylesUri}"`);
            htmlContent = htmlContent.replace(/src="webview.js"/g, `src="${scriptUri}"`);

            console.log('[HoneyGUI Designer] Webview URIs:');
            console.log('  Styles:', stylesUri.toString());
            console.log('  Script:', scriptUri.toString());
            console.log('  Webview Base:', webviewUri.toString());

            // 添加CSP meta标签 (放宽 CSP 以允许 React 运行)
            const nonce = this._getNonce();
            const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource};">`;
            htmlContent = htmlContent.replace('</head>', `${cspMetaTag}</head>`);

            return htmlContent;
        } catch (error) {
            console.error('[HoneyGUI Designer] 无法加载HTML文件:', error);

            // 如果文件不存在，返回默认HTML内容
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return this._getDefaultHtmlContent(webview, errorMessage);
        }
    }

    /**
     * 获取默认HTML内容（错误提示页面）
     * 注意：此方法仅在无法加载编译后的React bundle时调用
     */
    private _getDefaultHtmlContent(webview: vscode.Webview, errorMessage?: string): string {
        const errorDetails = errorMessage || '无法加载设计器界面';

        return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HoneyGUI 设计器 - 加载失败</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    justify-content: center;
                    align-items: center;
                }
                .error-container {
                    max-width: 600px;
                    padding: 40px;
                    text-align: center;
                }
                .error-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                .error-title {
                    font-size: 24px;
                    font-weight: 500;
                    margin-bottom: 15px;
                    color: #f87474;
                }
                .error-message {
                    font-size: 14px;
                    line-height: 1.6;
                    color: #969696;
                    margin-bottom: 30px;
                }
                .error-details {
                    background-color: #252526;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 30px;
                    text-align: left;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #ce9178;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .solution {
                    background-color: #252526;
                    border-left: 4px solid #007acc;
                    padding: 20px;
                    border-radius: 4px;
                    text-align: left;
                }
                .solution-title {
                    font-size: 16px;
                    font-weight: 500;
                    margin-bottom: 10px;
                    color: #007acc;
                }
                .solution-step {
                    font-size: 13px;
                    margin-bottom: 8px;
                    line-height: 1.5;
                }
                .code-block {
                    background-color: #1e1e1e;
                    border: 1px solid #3e3e42;
                    border-radius: 3px;
                    padding: 8px 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #d4d4d4;
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">设计器加载失败</div>
                <div class="error-message">
                    无法加载 HoneyGUI 设计器界面。这通常是因为编译后的 React bundle 文件缺失或损坏。
                </div>
                <div class="error-details">${errorDetails}</div>
                <div class="solution">
                    <div class="solution-title">解决方案：</div>
                    <div class="solution-step">
                        1. 确保已运行编译命令：<span class="code-block">npm run compile</span>
                    </div>
                    <div class="solution-step">
                        2. 确保已构建 Webview：<span class="code-block">npm run build:webview</span>
                    </div>
                    <div class="solution-step">
                        3. 检查文件是否存在：<span class="code-block">out/designer/webview/index.html</span>
                    </div>
                    <div class="solution-step">
                        4. 重新打包扩展：<span class="code-block">vsce package</span>
                    </div>
                    <div class="solution-step">
                        5. 在 VSCode 输出面板查看"扩展主机"日志获取详细错误信息
                    </div>
                </div>
            </div>
        </body>
        </html>`;
    }

    /**
     * 生成随机nonce值
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        
        return text;
    }

    /**
     * 保存HML内容
     */
    private async _saveHml(content: string): Promise<void> {
        try {
            // 首先尝试解析和验证HML内容
            try {
                this._hmlController.parseContent(content);
            } catch (parseError) {
                console.error('HML内容验证失败:', parseError);
                vscode.window.showErrorMessage(`HML内容格式错误: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
                return;
            }
            
            if (!this._filePath) {
                // 如果没有当前文件路径，让用户选择保存位置
                await this._promptSaveLocation(content);
                return;
            }
            
            // 使用HML控制器保存文件
            // 使用getter方法
            const filePath = this.currentFilePath;
            if (filePath) {
                await this._hmlController.saveDocument(filePath);
                // 更新VSCode的文件系统缓存
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                vscode.window.showInformationMessage(`设计已保存到 ${path.basename(filePath)}`);
            }
            
        } catch (error) {
            console.error('保存文件失败:', error);
            vscode.window.showErrorMessage(`保存文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    
    /**
     * 提示用户选择保存位置
     */
    private async _promptSaveLocation(content?: string): Promise<boolean> {
        try {
            // 显示保存对话框
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('untitled.hml'),
                filters: {
                    'HML 文件': ['hml'],
                    '所有文件': ['*']
                }
            });
            
            if (uri) {
                // 使用HML控制器保存文件
                if (content) {
                    this._hmlController.parseContent(content);
                }
                await this._hmlController.saveDocument(uri.fsPath);
                this._filePath = uri.fsPath;
                
                // 更新面板标题
                const fileName = path.basename(uri.fsPath);
                this._panel.title = `HoneyGUI 设计器 - ${fileName}`;
                
                vscode.window.showInformationMessage(`设计已保存到 ${fileName}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('保存文件失败:', error);
            vscode.window.showErrorMessage(`保存文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return false;
        }
    }
    
    /**
     * 加载文件
     */
    private async _loadFile(filePath: string): Promise<void> {
        this._filePath = filePath;
        
        try {
            // 使用HML控制器加载文件
            const document = await this._hmlController.loadFile(filePath);
            
            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();
            
            // 尝试加载项目配置文件
            let projectConfig = null;
            try {
                // 首先尝试从HML文件所在目录查找
                const hmlDir = path.dirname(filePath);
                const configPathInHmlDir = path.join(hmlDir, 'project.json');
                
                if (fs.existsSync(configPathInHmlDir)) {
                    const configContent = fs.readFileSync(configPathInHmlDir, 'utf8');
                    projectConfig = JSON.parse(configContent);
                    console.log('[HoneyGUI Designer] 成功从HML目录加载项目配置文件:', projectConfig);
                } else {
                    // 如果HML目录中找不到，尝试从项目根目录查找（上级目录）
                    const projectRootDir = path.dirname(hmlDir);
                    const configPathInRootDir = path.join(projectRootDir, 'project.json');
                    
                    if (fs.existsSync(configPathInRootDir)) {
                        const configContent = fs.readFileSync(configPathInRootDir, 'utf8');
                        projectConfig = JSON.parse(configContent);
                        console.log('[HoneyGUI Designer] 成功从项目根目录加载项目配置文件:', projectConfig);
                    } else {
                        console.log('[HoneyGUI Designer] 未找到项目配置文件:', configPathInHmlDir, '和', configPathInRootDir);
                    }
                }
            } catch (configError) {
                console.error('[HoneyGUI Designer] 加载项目配置文件失败:', configError);
            }

            // 从 project.json 获取设计器配置（画布背景色等）
            const canvasBackgroundColor = projectConfig?.designer?.canvasBackgroundColor || '#f0f0f0';

            // 发送HML内容和配置信息到Webview
            this._panel.webview.postMessage({
                command: 'loadHml',
                content: hmlContent,
                document: document,
                projectConfig: projectConfig,
                designerConfig: {
                    canvasBackgroundColor
                }
            });
            
            // 更新面板标题
            const fileName = path.basename(filePath);
            this._panel.title = `HoneyGUI 设计器 - ${fileName}`;
            
        } catch (error) {
            console.error('加载HML文件失败:', error);
            vscode.window.showErrorMessage(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
            
            // 如果加载失败，创建一个新的空白文档
            this._createNewDocument();
        }
    }
    
    /**
     * 创建新的空白文档
     */
    private _createNewDocument(): void {
        try {
            // 创建新的HML文档
            const document = this._hmlController.createNewDocument();

            // 序列化文档为字符串
            const hmlContent = this._hmlController.serializeDocument();

            // 尝试从工作区读取项目配置（包含画布背景色）
            let projectConfig: any = null;
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const workspaceRoot = workspaceFolders[0].uri.fsPath;
                    const projectJsonPath = path.join(workspaceRoot, 'project.json');

                    if (fs.existsSync(projectJsonPath)) {
                        const configContent = fs.readFileSync(projectJsonPath, 'utf8');
                        projectConfig = JSON.parse(configContent);
                        console.log('[HoneyGUI Designer] 从工作区加载 project.json:', projectConfig);
                    }
                }
            } catch (configError) {
                console.log('[HoneyGUI Designer] 无法加载 project.json，使用默认配置');
            }

            // 从 project.json 获取画布背景色，默认灰色
            const canvasBackgroundColor = projectConfig?.designer?.canvasBackgroundColor || '#f0f0f0';

            // 发送HML内容和配置到Webview
            this._panel.webview.postMessage({
                command: 'loadHml',
                content: hmlContent,
                document: document,
                projectConfig: projectConfig,
                designerConfig: {
                    canvasBackgroundColor
                }
            });

            // 更新面板标题
            this._panel.title = 'HoneyGUI 设计器 - 未命名';
            this._filePath = undefined;

        } catch (error) {
            console.error('创建新文档失败:', error);
            vscode.window.showErrorMessage(`创建新文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 预览UI
     */
    private async _previewUi(content: string): Promise<void> {
        try {
            // 解析HML内容
            this._hmlController.parseContent(content);
            
            // TODO: 实现预览逻辑
            vscode.window.showInformationMessage('预览功能开发中...');
        } catch (error) {
            console.error('预览失败:', error);
            vscode.window.showErrorMessage(`预览失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 生成代码
     */
    private async _generateCode(language: 'cpp' | 'c' = 'cpp', options?: Partial<CodeGeneratorOptions>, content?: string): Promise<void> {
        try {
            // 确保当前设计已保存
            if (!this._filePath) {
                const saveFirst = await vscode.window.showInformationMessage(
                    '请先保存当前设计，然后再生成代码',
                    '保存',
                    '取消'
                );

                if (saveFirst === '保存') {
                    const saved = await this._promptSaveLocation();
                        if (!saved) {
                            return;
                        }
                } else {
                    return;
                }
            }

            // 询问用户代码输出目录
            const defaultOutputDir = this._filePath ? path.dirname(this._filePath) + '/generated' : undefined;
            const outputDir = await this._promptForOutputDirectory(defaultOutputDir);
            if (!outputDir) {
                return;
            }

            // 准备代码生成选项
            const projectName = path.basename(this._filePath || 'HoneyGUIApp', '.hml');
            const generatorOptions: CodeGeneratorOptions = {
                outputDir,
                projectName,
                enableProtectedAreas: true,
                generateDebugInfo: true,
                ...options
            };

            // 显示进度通知
            const progress = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在生成${language.toUpperCase()}代码...`,
                    cancellable: true
                },
                async (progress, token) => {
                    token.onCancellationRequested(() => {
                        throw new Error('代码生成已取消');
                    });

                    // 更新进度
                    progress.report({ increment: 10, message: '准备生成器...' });

                    // 确保模型已同步
                    if (content) {
                        this._hmlController.parseContent(content);
                    } else if (this._filePath) {
                        await this._hmlController.loadFile(this._filePath);
                    }

                    progress.report({ increment: 30, message: '创建代码生成器...' });

                    // 创建代码生成器
                    const generator = CodeGeneratorFactory.createGenerator(
                        language,
                        // 简化实现，创建一个简单的DesignerModel对象
                        { components: [] } as any,
                        generatorOptions
                    );

                    progress.report({ increment: 50, message: '生成代码文件...' });

                    // 生成代码
                    const result = await generator.generate();

                    progress.report({ increment: 90, message: '完成代码生成...' });

                    return result;
                }
            );

            // 处理生成结果
            if ((progress as any).success) {
                // 显示成功消息
                const generatedFiles = (progress as any).generatedFiles || [];
                const message = `成功生成${language.toUpperCase()}代码文件（${generatedFiles.length}个文件）`;
                vscode.window.showInformationMessage(message);

                // 询问是否打开生成的文件
                const openFiles = await vscode.window.showInformationMessage(
                    '是否要在编辑器中打开生成的主要文件？',
                    '打开',
                    '取消'
                );

                if (openFiles === '打开' && generatedFiles.length > 0) {
                    // 打开第一个生成的文件（通常是主文件）
                    const mainFile = generatedFiles.find((file: string) => 
                        file.includes('Application') || file.includes('main') || file.includes('Window')
                    ) || generatedFiles[0];

                    const document = await vscode.workspace.openTextDocument(mainFile);
                    await vscode.window.showTextDocument(document);
                }
            } else {
                // 显示错误消息
                vscode.window.showErrorMessage(`代码生成失败: ${(progress as any).error || '未知错误'}`);
            }

            // 如果有警告，显示警告
            if ((progress as any).warnings && (progress as any).warnings.length > 0) {
                for (const warning of (progress as any).warnings) {
                    vscode.window.showWarningMessage(`警告: ${warning}`);
                }
            }

        } catch (error) {
            console.error('代码生成错误:', error);
            vscode.window.showErrorMessage(`代码生成过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 提示用户选择输出目录
     */
    private async _promptForOutputDirectory(defaultPath?: string): Promise<string | undefined> {
        const options: vscode.OpenDialogOptions = {
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: '选择输出目录',
            defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined
        };

        const uri = await vscode.window.showOpenDialog(options);
        return uri && uri.length > 0 ? uri[0].fsPath : undefined;
    }
    
    /**
     * 处理添加组件的请求
     */
    private _handleAddComponent(parentId: string, componentData: Omit<Component, 'id'>): void {
        try {
            const newComponent = this._hmlController.addComponent(parentId, componentData);
            
            if (newComponent) {
                // 通知Webview组件已添加成功
                this._panel.webview.postMessage({
                    command: 'componentAdded',
                    component: newComponent,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentAdded',
                    success: false,
                    error: '未找到父组件'
                });
            }
        } catch (error) {
            console.error('添加组件失败:', error);
            this._panel.webview.postMessage({
                command: 'componentAdded',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }
    
    /**
     * 处理更新组件的请求
     */
    private _handleUpdateComponent(componentId: string, updates: any): void {
        try {
            const updatedComponent = this._hmlController.updateComponent(componentId, updates);
            
            if (updatedComponent) {
                // 通知Webview组件已更新成功
                this._panel.webview.postMessage({
                    command: 'componentUpdated',
                    component: updatedComponent,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentUpdated',
                    success: false,
                    error: '未找到组件'
                });
            }
        } catch (error) {
            console.error('更新组件失败:', error);
            this._panel.webview.postMessage({
                command: 'componentUpdated',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }
    
    /**
     * 处理删除组件的请求
     */
    private _handleDeleteComponent(componentId: string): void {
        try {
            const success = this._hmlController.deleteComponent(componentId);
            
            if (success) {
                // 通知Webview组件已删除成功
                this._panel.webview.postMessage({
                    command: 'componentDeleted',
                    componentId,
                    success: true
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'componentDeleted',
                    success: false,
                    error: '未找到组件'
                });
            }
        } catch (error) {
            console.error('删除组件失败:', error);
            this._panel.webview.postMessage({
                command: 'componentDeleted',
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    }

    /**
     * 清理资源
     */
    /**
     * 获取当前的HML文档
     */
    public get currentDocument() {
        return this._hmlController.currentDocument;
    }
    
    /**
     * 获取当前的文件路径
     */
    public get currentFilePath() {
        return this._filePath;
    }
    
    /**
     * 向Webview发送消息
     */
    public sendMessage(command: string, data?: any): void {
        this._panel.webview.postMessage({ command, ...data });
    }
    
    public dispose(): void {
        DesignerPanel.currentPanel = undefined;

        // 清理所有监听器
        this._disposables.forEach(d => d.dispose());
        
        // 销毁面板
        this._panel.dispose();
    }
}