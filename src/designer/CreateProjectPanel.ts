import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TemplateManager } from '../template/TemplateManager';
import { HmlTemplateManager } from '../hml/HmlTemplateManager';
import { WebviewUtils } from '../common/WebviewUtils';
import { logger } from '../utils/Logger';
import { getAllTemplateInfo, getTemplateById } from '../template/templates';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * 项目创建面板管理类
 */
export class CreateProjectPanel {
    public static currentPanel: CreateProjectPanel | undefined;
    public static readonly viewType = 'honeyguiCreateProject';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private readonly _templateManager: TemplateManager;

    /**
     * 创建或获取现有的项目创建面板
     */
    public static createOrShow(context: vscode.ExtensionContext): CreateProjectPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已有面板，则显示并返回
        if (CreateProjectPanel.currentPanel) {
            CreateProjectPanel.currentPanel._panel.reveal(column);
            return CreateProjectPanel.currentPanel;
        }

        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            CreateProjectPanel.viewType,
            'Create application',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'designer'),
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'designer')
                ]
            }
        );

        CreateProjectPanel.currentPanel = new CreateProjectPanel(panel, context);
        return CreateProjectPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;
        this._templateManager = new TemplateManager(context);

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
            async (message) => {
                switch (message.command) {
                    case 'selectFolder':
                        await this._selectProjectFolder();
                        break;
                    case 'selectSdkPath':
                        await this._selectSdkPath();
                        break;
                    case 'selectTemplateFolder':
                        await this._selectTemplateFolder();
                        break;
                    case 'selectTemplateSdkPath':
                        await this._selectTemplateSdkPath();
                        break;
                    case 'getTemplates':
                        this._sendTemplates();
                        break;
                    case 'createProject':
                        await this._createProject(message.config);
                        break;
                    case 'createTemplateProject':
                        await this._createTemplateProject(message.config);
                        break;
                    case 'cloneSdk':
                        await this._cloneSdk(message.source, message.target);
                        break;
                    case 'notify':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
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
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    /**
     * 获取Webview的HTML内容
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this._getNonce();
        const homeDir = os.homedir();
        
        // 读取 HTML 模板
        const templatePath = path.join(this._extensionUri.fsPath, 'src', 'designer', 'templates', 'createProject.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // 替换模板变量
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{homeDir\}\}/g, homeDir);
        
        return html;
    }
        

    /**
     * 生成随机nonce值
     */
    // 使用WebviewUtils中的方法替代原有的_getNonce
    private _getNonce(): string {
        return WebviewUtils.generateNonce();
    }

    /**
     * 选择项目文件夹
     */
    private async _selectProjectFolder(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select project location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'folderSelected',
                    folderPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择文件夹失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select folder');
        }
    }
    
    /**
     * 选择 HoneyGUI SDK 路径
     */
    private async _selectSdkPath(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select HoneyGUI SDK location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'sdkPathSelected',
                    sdkPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择 SDK 路径失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select SDK path');
        }
    }

    /**
     * 选择模板项目文件夹
     */
    private async _selectTemplateFolder(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select project location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'templateFolderSelected',
                    folderPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择文件夹失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select folder');
        }
    }

    /**
     * 选择模板项目的 SDK 路径
     */
    private async _selectTemplateSdkPath(): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select HoneyGUI SDK location'
            };
            
            const result = await vscode.window.showOpenDialog(options);
            if (result && result.length > 0) {
                this._panel.webview.postMessage({
                    command: 'templateSdkPathSelected',
                    sdkPath: result[0].fsPath
                });
            }
        } catch (error) {
            logger.error(`选择 SDK 路径失败: ${error}`);
            WebviewUtils.handleWebviewError(this._panel.webview, 'Failed to select SDK path');
        }
    }

    /**
     * 克隆 HoneyGUI SDK
     */
    private async _cloneSdk(source: 'github' | 'gitee', target: 'empty' | 'template' = 'empty'): Promise<void> {
        const urls = {
            github: 'https://github.com/realmcu/HoneyGUI.git',
            gitee: 'https://gitee.com/realmcu/HoneyGUI.git'
        };
        const url = urls[source] || urls.gitee;
        const targetPath = path.join(os.homedir(), '.HoneyGUI-SDK');

        try {
            // 检查目标目录是否已存在
            if (fs.existsSync(targetPath)) {
                this._panel.webview.postMessage({
                    command: 'cloneComplete',
                    sdkPath: targetPath,
                    target: target
                });
                vscode.window.showInformationMessage(`SDK 目录已存在: ${targetPath}`);
                return;
            }

            this._panel.webview.postMessage({
                command: 'cloneProgress',
                percent: 10,
                text: '正在克隆 HoneyGUI SDK...'
            });

            // 使用 child_process 执行 git clone
            const { spawn } = await import('child_process');
            const gitProcess = spawn('git', ['clone', '--progress', url, targetPath]);

            gitProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                // 解析 git clone 进度
                const match = output.match(/Receiving objects:\s+(\d+)%/);
                if (match) {
                    const percent = parseInt(match[1], 10);
                    this._panel.webview.postMessage({
                        command: 'cloneProgress',
                        percent: Math.min(90, 10 + percent * 0.8),
                        text: `正在克隆... ${percent}%`
                    });
                }
            });

            gitProcess.on('close', (code: number) => {
                if (code === 0) {
                    this._panel.webview.postMessage({
                        command: 'cloneProgress',
                        percent: 100,
                        text: '克隆完成!'
                    });
                    setTimeout(() => {
                        this._panel.webview.postMessage({
                            command: 'cloneComplete',
                            sdkPath: targetPath,
                            target: target
                        });
                    }, 500);
                    vscode.window.showInformationMessage(`SDK 克隆成功: ${targetPath}`);
                } else {
                    this._panel.webview.postMessage({
                        command: 'cloneError',
                        text: `克隆失败 (exit code: ${code})`,
                        target: target
                    });
                }
            });

            gitProcess.on('error', (err: Error) => {
                logger.error(`克隆 SDK 失败: ${err.message}`);
                this._panel.webview.postMessage({
                    command: 'cloneError',
                    text: `克隆失败: ${err.message}\n\n请确保已安装 Git`,
                    target: target
                });
            });

        } catch (error) {
            logger.error(`克隆 SDK 失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'cloneError',
                text: `克隆失败: ${error instanceof Error ? error.message : '未知错误'}`,
                target: target
            });
        }
    }

    /**
     * 发送模板列表到 Webview
     */
    private _sendTemplates(): void {
        this._panel.webview.postMessage({
            command: 'templatesLoaded',
            templates: getAllTemplateInfo()
        });
    }

    /**
     * 创建项目
     */
    private async _createProject(config: any): Promise<void> {
        try {
            const { projectName, saveLocation, appId, resolution, cornerRadius, targetEngine, minSdk, pixelMode, honeyguiSdkPath, romfsBaseAddr } = config;

            // 记录日志用于调试
            logger.info(`[CreateProjectPanel] Creating project: projectName=${projectName}, saveLocation=${saveLocation}, appId=${appId}, targetEngine=${targetEngine}, sdkPath=${honeyguiSdkPath}, romfsBaseAddr=${romfsBaseAddr}, cornerRadius=${cornerRadius}`);

            // 设置默认 SDK 路径
            const sdkPath = honeyguiSdkPath || ProjectUtils.getDefaultSdkPath();
            logger.info(`[CreateProjectPanel] Using SDK path: ${sdkPath}`);

            // 验证必填字段
            if (!projectName || !saveLocation || !appId) {
                logger.error('[CreateProjectPanel] Validation failed: Missing required fields');
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '请填写所有必填字段 (项目名称、保存位置、APP ID)'
                });
                return;
            }

            // 验证项目名称格式（必须是合法的 C 变量名）
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(projectName)) {
                logger.error(`[CreateProjectPanel] Invalid project name: ${projectName}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '项目名称只能包含字母、数字、下划线，且必须以字母或下划线开头'
                });
                return;
            }

            const projectPath = path.join(saveLocation, projectName);
            logger.info(`[CreateProjectPanel] Full project path: ${projectPath}`);

            // 检查项目路径是否已存在（增强检测）
            try {
                if (fs.existsSync(projectPath)) {
                    const stats = fs.statSync(projectPath);
                    if (stats.isDirectory()) {
                        logger.error(`[CreateProjectPanel] Project directory already exists: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `项目已存在: "${projectName}"\n\n目录 "${projectPath}" 已存在。\n\n请选择其他名称或删除现有项目。`
                        });
                        return;
                    } else {
                        logger.error(`[CreateProjectPanel] Path exists but is not a directory: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `无法创建项目: "${projectPath}" 已存在且不是一个目录`
                        });
                        return;
                    }
                }
            } catch (error) {
                logger.error(`[CreateProjectPanel] Error checking path existence: ${error}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: `检查项目路径时出错: ${error instanceof Error ? error.message : '未知错误'}`
                });
                return;
            }
            
            // 使用 withProgress 显示创建进度（完成后自动消失）
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating project: ${projectName}...`,
                cancellable: false
            }, async () => {
                // 创建项目结构
                await this._createProjectStructure(projectPath, projectName, appId, resolution, cornerRadius, targetEngine || 'honeygui', minSdk, pixelMode, honeyguiSdkPath, romfsBaseAddr);
            });
            
            // 显示成功消息
            this._panel.webview.postMessage({
                command: 'notify',
                text: `Project created successfully: ${projectPath}`
            });
            
            // 在打开文件夹前，将项目信息保存到全局存储
            // 这样即使在扩展重新加载后，我们也能知道需要激活哪个项目
            await this._context.globalState.update('pendingProjectActivation', {
                projectPath: projectPath,
                projectName: projectName,
                timestamp: Date.now()
            });

            // 自动打开工作区文件
            const workspaceFile = path.join(projectPath, `${projectName}.code-workspace`);
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFile), false);

            // 注意：代码执行到这里，扩展会被重新加载
            // 实际的激活逻辑将在 extension.ts 的 activate 函数中处理
            // 通过检查 globalState 中的 pendingProjectActivation
            
            // 关闭Webview
            this.dispose();
            
        } catch (error) {
            logger.error(`创建项目失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'error',
                text: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    /**
     * 创建项目结构
     */
    private async _createProjectStructure(
        projectPath: string,
        projectName: string,
        appId: string,
        resolution: string,
        cornerRadius: number,
        targetEngine: string,
        minSdk: string,
        pixelMode: string,
        honeyguiSdkPath?: string,
        romfsBaseAddr?: string
    ): Promise<void> {
        // 创建目录结构
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

        // 使用HmlTemplateManager生成文件内容
        // 创建 {ProjectName}Main.hml 文件（直接放在 ui/ 下）
        const hmlFileName = `${projectName}Main.hml`;
        const mainHmlContent = HmlTemplateManager.generateMainHml(
            projectName,
            resolution,
            appId,
            minSdk,
            pixelMode
        );
        fs.writeFileSync(path.join(projectPath, 'ui', hmlFileName), mainHmlContent, 'utf8');

        // 创建README文件
        const readmeContent = HmlTemplateManager.generateReadme(
            projectName,
            appId,
            resolution
        );
        fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

        // 创建 project.json 项目配置文件
        const projectConfig = {
            name: projectName,
            appId: appId,
            version: '1.0.0',
            resolution: resolution,
            cornerRadius: cornerRadius ?? 0,  // 屏幕形状：0=矩形, -1=圆形, >0=圆角半径
            targetEngine: targetEngine,  // 添加目标引擎配置
            minSdk: minSdk,
            pixelMode: pixelMode,
            mainHmlFile: `ui/${hmlFileName}`,
            honeyguiSdkPath: honeyguiSdkPath || ProjectUtils.getDefaultSdkPath(),
            romfsBaseAddr: romfsBaseAddr || '0x04400000',
            created: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(projectPath, 'project.json'),
            JSON.stringify(projectConfig, null, 2),
            'utf8'
        );

        // 创建 VSCode 工作区文件
        // 创建 VSCode 工作区文件
        const sdkRealguiPath = honeyguiSdkPath ? path.join(honeyguiSdkPath, 'realgui') : null;
        const workspaceFolders: Array<{path: string, name?: string}> = [
            { path: '.' }
        ];
        if (sdkRealguiPath && fs.existsSync(sdkRealguiPath)) {
            workspaceFolders.push({ path: sdkRealguiPath, name: 'HoneyGUI-SDK' });
        }
        
        const workspaceConfig = {
            folders: workspaceFolders,
            settings: {
                'files.associations': {
                    '*.hml': 'xml'
                }
            },
            extensions: {
                recommendations: [
                    'realmcu.honeygui-visual-designer'
                ]
            }
        };
        fs.writeFileSync(
            path.join(projectPath, `${projectName}.code-workspace`),
            JSON.stringify(workspaceConfig, null, 2),
            'utf8'
        );

        // SDK 路径已保存到 project.json，项目将直接引用 SDK 而不拷贝文件
        logger.info(`[CreateProjectPanel] Project created with target engine: ${targetEngine}, SDK path: ${projectConfig.honeyguiSdkPath || 'default'}, romfs base addr: ${projectConfig.romfsBaseAddr}`);
    }

    /**
     * 创建模板项目
     */
    private async _createTemplateProject(config: any): Promise<void> {
        try {
            const { templateId, projectName, saveLocation, appId, honeyguiSdkPath, romfsBaseAddr } = config;

            logger.info(`[CreateProjectPanel] Creating template project: templateId=${templateId}, projectName=${projectName}`);

            // 验证必填字段
            if (!templateId || !projectName || !saveLocation || !appId) {
                logger.error('[CreateProjectPanel] Validation failed: Missing required fields');
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '请填写所有必填字段并选择模板'
                });
                return;
            }

            // 验证项目名称格式（必须是合法的 C 变量名）
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(projectName)) {
                logger.error(`[CreateProjectPanel] Invalid project name: ${projectName}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '项目名称只能包含字母、数字、下划线，且必须以字母或下划线开头'
                });
                return;
            }

            const projectPath = path.join(saveLocation, projectName);

            // 检查项目路径是否已存在
            if (fs.existsSync(projectPath)) {
                logger.error(`[CreateProjectPanel] Project directory already exists: ${projectPath}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: `项目已存在: "${projectName}"\n\n目录 "${projectPath}" 已存在。\n\n请选择其他名称或删除现有项目。`
                });
                return;
            }

            // 获取模板实例
            const template = getTemplateById(templateId);
            if (!template) {
                throw new Error(`Template not found: ${templateId}`);
            }

            // 设置 SDK 路径
            const sdkPath = honeyguiSdkPath || ProjectUtils.getDefaultSdkPath();

            // 使用 withProgress 显示创建进度（完成后自动消失）
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating project from template: ${projectName}...`,
                cancellable: false
            }, async () => {
                // 使用模板创建项目（拷贝完整项目）
                await template.createProject(projectPath, projectName, appId, sdkPath);
                
                // 创建完成后，更新 project.json 添加 SDK 路径和 romfs 地址
                const projectJsonPath = path.join(projectPath, 'project.json');
                if (fs.existsSync(projectJsonPath)) {
                    const projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
                    projectConfig.honeyguiSdkPath = sdkPath;
                    projectConfig.romfsBaseAddr = romfsBaseAddr || '0x04400000';
                    fs.writeFileSync(projectJsonPath, JSON.stringify(projectConfig, null, 2), 'utf8');
                    logger.info(`[CreateProjectPanel] SDK path and romfs address added to project.json: ${sdkPath}, ${projectConfig.romfsBaseAddr}`);
                }

                // 创建 VSCode 工作区文件
                const sdkRealguiPath = sdkPath ? path.join(sdkPath, 'realgui') : null;
                const workspaceFolders: Array<{path: string, name?: string}> = [
                    { path: '.' }
                ];
                if (sdkRealguiPath && fs.existsSync(sdkRealguiPath)) {
                    workspaceFolders.push({ path: sdkRealguiPath, name: 'HoneyGUI-SDK' });
                }
                
                const workspaceConfig = {
                    folders: workspaceFolders,
                    settings: {
                        'files.associations': {
                            '*.hml': 'xml'
                        }
                    },
                    extensions: {
                        recommendations: [
                            'realmcu.honeygui-visual-designer'
                        ]
                    }
                };
                fs.writeFileSync(
                    path.join(projectPath, `${projectName}.code-workspace`),
                    JSON.stringify(workspaceConfig, null, 2),
                    'utf8'
                );
            });

            // 显示成功消息
            this._panel.webview.postMessage({
                command: 'notify',
                text: `Template project created successfully: ${projectPath}`
            });

            // 保存待激活项目信息
            await this._context.globalState.update('pendingProjectActivation', {
                projectPath: projectPath,
                projectName: projectName,
                timestamp: Date.now()
            });

            // 自动打开工作区文件
            const workspaceFile = path.join(projectPath, `${projectName}.code-workspace`);
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFile), false);

            // 关闭Webview
            this.dispose();

        } catch (error) {
            logger.error(`创建模板项目失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'error',
                text: `Failed to create template project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    /**
     * 创建模板项目结构
     */
    private async _createTemplateProjectStructure(
        projectPath: string,
        projectName: string,
        appId: string,
        resolution: string,
        targetEngine: string,
        minSdk: string,
        pixelMode: string,
        templateId: string,
        honeyguiSdkPath?: string
    ): Promise<void> {
        // 创建目录结构
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui', 'main'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

        // 获取模板实例
        const template = getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // 使用模板生成 HML 文件（直接放在 ui/ 下）
        const hmlFileName = `${projectName}Main.hml`;
        const mainHmlContent = template.generateHml({
            projectName,
            resolution,
            appId,
            minSdk,
            pixelMode
        });
        fs.writeFileSync(path.join(projectPath, 'ui', hmlFileName), mainHmlContent, 'utf8');

        // 拷贝模板资源
        await template.copyAssets(projectPath);

        // 创建README文件
        const readmeContent = `# ${projectName}

Created from template: **${template.name}**

${template.description}

## Project Info
- APP ID: ${appId}
- Resolution: ${resolution}
- Target Engine: ${targetEngine}
- Min SDK: ${minSdk}
- Pixel Mode: ${pixelMode}

## Getting Started

1. Open the HML file in \`ui/${hmlFileName}\`
2. Design your UI in the visual designer
3. Generate code and compile

Created: ${new Date().toLocaleString()}
`;
        fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

        // 创建 project.json 项目配置文件
        const projectConfig = {
            name: projectName,
            appId: appId,
            version: '1.0.0',
            resolution: resolution,
            targetEngine: targetEngine,
            minSdk: minSdk,
            pixelMode: pixelMode,
            mainHmlFile: `ui/${hmlFileName}`,
            honeyguiSdkPath: honeyguiSdkPath || ProjectUtils.getDefaultSdkPath(),
            template: templateId,
            created: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(projectPath, 'project.json'),
            JSON.stringify(projectConfig, null, 2),
            'utf8'
        );

        logger.info(`[CreateProjectPanel] Template project created: ${templateId}`);
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        CreateProjectPanel.currentPanel = undefined;
        
        // 清理Webview面板
        this._panel.dispose();
        
        // 清理所有一次性资源
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
