import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PreviewService } from '../preview/PreviewService';
import { TemplateManager } from '../template/TemplateManager';

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
                    case 'createProject':
                        await this._createProject(message.config);
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
        
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Create application</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    min-height: 100vh;
                }

                h1 {
                    font-size: 24px;
                    margin-bottom: 20px;
                    color: #ffffff;
                }

                .tabs {
                    display: flex;
                    border-bottom: 1px solid #3e3e42;
                    margin-bottom: 20px;
                }

                .tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    background-color: transparent;
                    border: none;
                    color: #969696;
                    font-size: 14px;
                    transition: all 0.2s;
                    user-select: none;
                    outline: none;
                    position: relative;
                    z-index: 10;
                }

                .tab.active {
                    color: #007acc;
                    border-bottom: 2px solid #007acc;
                }

                .form-container {
                    background-color: #252526;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 20px;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #d4d4d4;
                }

                .form-control {
                    width: 100%;
                    padding: 8px 12px;
                    background-color: #3c3c3c;
                    border: 1px solid #3e3e42;
                    border-radius: 3px;
                    color: #d4d4d4;
                    font-size: 14px;
                }

                .form-control:focus {
                    outline: none;
                    border-color: #007acc;
                }

                .input-group {
                    display: flex;
                }

                .input-group .form-control {
                    flex: 1;
                    border-top-right-radius: 0;
                    border-bottom-right-radius: 0;
                }

                .btn-icon {
                    padding: 8px 12px;
                    background-color: #0e639c;
                    border: 1px solid #007acc;
                    border-left: none;
                    border-top-right-radius: 3px;
                    border-bottom-right-radius: 3px;
                    color: #ffffff;
                    cursor: pointer;
                    font-size: 14px;
                }

                .btn-icon:hover {
                    background-color: #1177bb;
                }

                select.form-control {
                    cursor: pointer;
                }

                .btn-create {
                    width: 100%;
                    padding: 12px;
                    background-color: #107c10;
                    border: 1px solid #107c10;
                    border-radius: 4px;
                    color: #ffffff;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    margin-top: 10px;
                }

                .btn-create:hover:not(:disabled) {
                    background-color: #148514;
                }

                .btn-create:disabled {
                    background-color: #3c3c3c;
                    border-color: #3e3e42;
                    cursor: not-allowed;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                @media (max-width: 768px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }

                /* 错误消息样式 */
                .error-message {
                    background-color: rgba(231, 76, 60, 0.15);
                    border: 1px solid #e74c3c;
                    border-radius: 4px;
                    color: #e74c3c;
                    padding: 12px;
                    margin-bottom: 20px;
                    white-space: pre-line;
                    font-size: 14px;
                    line-height: 1.4;
                }

                .error-message.hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <h1>Create project</h1>

            <!-- 错误消息显示区域 -->
            <div id="errorMessage" class="error-message hidden"></div>

            
            <div class="tabs">
                <button id="tab-empty" class="tab active">Create empty project</button>
                <button id="tab-template" class="tab">Create template project</button>
            </div>
            
            <div id="empty-tab" class="tab-content" style="display: block;">
                <div class="form-container">
                    <div class="form-group">
                        <label for="projectName">Project name</label>
                        <input type="text" id="projectName" class="form-control" value="NewProject" />
                    </div>
                    
                    <div class="form-group">
                            <label for="saveLocation">Save location</label>
                            <div class="input-group">
                                <input type="text" id="saveLocation" class="form-control" placeholder="Please select a project save path" />
                                <button class="btn-icon" id="selectFolderButton">📁</button>
                            </div>
                        </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="appId">APP ID</label>
                            <input type="text" id="appId" class="form-control" value="com.example.NewProject" />
                        </div>

                        <div class="form-group">
                            <label for="resolution">Resolution</label>
                            <select id="resolution" class="form-control">
                                <option value="480X272">480X272</option>
                                <option value="800X480">800X480</option>
                                <option value="1024X600">1024X600</option>
                                <option value="1280X720">1280X720</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="minSdk">Minimum SDK</label>
                            <select id="minSdk" class="form-control">
                                <option value="API 2: Persim Wear V1.1.0">API 2: Persim Wear V1.1.0</option>
                                <option value="API 3: Persim Wear V1.2.0">API 3: Persim Wear V1.2.0</option>
                                <option value="API 4: Persim Wear V2.0.0">API 4: Persim Wear V2.0.0</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="pixelMode">Pixel Mode</label>
                            <select id="pixelMode" class="form-control">
                                <option value="ARGB8888">ARGB8888</option>
                                <option value="RGB565">RGB565</option>
                                <option value="ARGB4444">ARGB4444</option>
                                <option value="L8">L8</option>
                            </select>
                        </div>
                    </div>
                    
                    <button id="createButton" class="btn-create" disabled>Create</button>
                </div>
            </div>
            
            <div id="template-tab" class="tab-content" style="display: none;">
                <div class="form-container">
                    <p>Template project feature coming soon.</p>
                </div>
            </div>
            
            <script nonce="${nonce}">
                // 获取VSCode API
                const vscode = acquireVsCodeApi();
                
                // 切换选项卡
                function switchTab(tabId) {
                    console.log('Switching to tab:', tabId);
                    
                    // 隐藏所有内容
                    const contents = document.querySelectorAll('.tab-content');
                    console.log('Found content elements:', contents.length);
                    contents.forEach(content => {
                        content.style.display = 'none';
                    });
                    
                    // 移除所有选项卡的激活状态
                    const tabs = document.querySelectorAll('.tab');
                    console.log('Found tab elements:', tabs.length);
                    tabs.forEach(tab => {
                        tab.classList.remove('active');
                    });
                    
                    // 显示选中的内容
                    const contentElement = document.getElementById(tabId + '-tab');
                    console.log('Content element found:', contentElement !== null);
                    if (contentElement) {
                        contentElement.style.display = 'block';
                    }
                    
                    // 激活选中的选项卡
                    const activeTab = document.getElementById('tab-' + tabId);
                    console.log('Tab element found:', activeTab !== null);
                    if (activeTab) {
                        activeTab.classList.add('active');
                    }
                    
                    validateForm();
                }
                
                // 动态绑定事件监听器，避免内联事件处理程序违反CSP
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('DOM content loaded, binding event listeners...');

                    // 获取表单元素
                    const tabEmpty = document.getElementById('tab-empty');
                    const tabTemplate = document.getElementById('tab-template');
                    const selectFolderButton = document.getElementById('selectFolderButton');
                    const saveLocationInput = document.getElementById('saveLocation');
                    const createButton = document.getElementById('createButton');
                    const appIdInput = document.getElementById('appId');
                    const resolutionSelect = document.getElementById('resolution');
                    const minSdkSelect = document.getElementById('minSdk');
                    const pixelModeSelect = document.getElementById('pixelMode');

                    console.log('Tab buttons found - empty:', !!tabEmpty, 'template:', !!tabTemplate);
                    console.log('Form elements found:', {
                        folderBtn: !!selectFolderButton,
                        saveLocation: !!saveLocationInput,
                        createBtn: !!createButton,
                        appId: !!appIdInput,
                        resolution: !!resolutionSelect,
                        minSdk: !!minSdkSelect,
                        pixelMode: !!pixelModeSelect
                    });

                    // 绑定标签切换事件
                    if (tabEmpty) {
                        tabEmpty.addEventListener('click', function() {
                            console.log('Empty tab clicked');
                            switchTab('empty');
                        });
                    }

                    if (tabTemplate) {
                        tabTemplate.addEventListener('click', function() {
                            console.log('Template tab clicked');
                            switchTab('template');
                        });
                    }

                    // 绑定文件夹选择事件
                    if (selectFolderButton) {
                        selectFolderButton.addEventListener('click', function() {
                            console.log('Select folder button clicked');
                            selectFolder();
                        });
                    }

                    // 绑定表单验证事件
                    if (saveLocationInput) {
                        saveLocationInput.addEventListener('input', function() {
                            console.log('Save location input changed');
                            validateForm();
                        });
                    }

                    if (appIdInput) {
                        appIdInput.addEventListener('input', function() {
                            console.log('APP ID input changed');
                            validateForm();
                        });
                    }

                    if (resolutionSelect) {
                        resolutionSelect.addEventListener('change', function() {
                            console.log('Resolution changed');
                            validateForm();
                        });
                    }

                    if (minSdkSelect) {
                        minSdkSelect.addEventListener('change', function() {
                            console.log('Min SDK changed');
                            validateForm();
                        });
                    }

                    if (pixelModeSelect) {
                        pixelModeSelect.addEventListener('change', function() {
                            console.log('Pixel mode changed');
                            validateForm();
                        });
                    }

                    // 绑定创建按钮事件
                    if (createButton) {
                        createButton.addEventListener('click', function() {
                            console.log('Create button clicked');
                            createProject();
                        });
                    }

                    console.log('Event listeners bound successfully');
                });
                
                // 选择文件夹
                function selectFolder() {
                    vscode.postMessage({ command: 'selectFolder' });
                }
                
                // 验证表单
                function validateForm() {
                    console.log('Validating form...');
                    const projectName = document.getElementById('projectName').value.trim();
                    const saveLocation = document.getElementById('saveLocation').value.trim();
                    const createButton = document.getElementById('createButton');

                    console.log('Project name:', projectName, 'Save location:', saveLocation);

                    // 清除之前的错误消息
                    if (projectName || saveLocation) {
                        hideError();
                    }

                    // 启用或禁用创建按钮
                    if (createButton) {
                        createButton.disabled = !projectName || !saveLocation;
                        console.log('Create button disabled state:', createButton.disabled);
                    }
                }
                
                // 创建项目
                function createProject() {
                    console.log('Creating project...');
                    const projectName = document.getElementById('projectName').value.trim();
                    const saveLocation = document.getElementById('saveLocation').value.trim();
                    const appId = document.getElementById('appId').value.trim();
                    const resolution = document.getElementById('resolution').value;
                    const minSdk = document.getElementById('minSdk').value;
                    const pixelMode = document.getElementById('pixelMode').value;
                    
                    console.log('Project config:', { projectName, saveLocation, appId, resolution, minSdk, pixelMode });
                    
                    vscode.postMessage({
                        command: 'createProject',
                        config: {
                            projectName,
                            saveLocation,
                            appId,
                            resolution,
                            minSdk,
                            pixelMode
                        }
                    });
                }
                
                // 监听项目名称变化，更新APP ID
                document.getElementById('projectName').addEventListener('input', function() {
                    const projectName = this.value.trim();
                    const appIdInput = document.getElementById('appId');
                    
                    // 只有当用户没有手动修改APP ID时才更新
                    if (appIdInput.value === 'com.example.' + projectName || 
                        appIdInput.value === 'com.example.NewProject') {
                        appIdInput.value = 'com.example.' + projectName;
                    }
                    
                    validateForm();
                });
                
                // 显示错误消息
                function showError(message) {
                    const errorElement = document.getElementById('errorMessage');
                    errorElement.textContent = message;
                    errorElement.classList.remove('hidden');

                    // 3秒后自动隐藏
                    setTimeout(() => {
                        hideError();
                    }, 5000);
                }

                // 隐藏错误消息
                function hideError() {
                    const errorElement = document.getElementById('errorMessage');
                    errorElement.classList.add('hidden');
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'folderSelected':
                            document.getElementById('saveLocation').value = message.folderPath;
                            hideError(); // 清除错误消息
                            validateForm();
                            break;
                        case 'error':
                            // 显示错误消息给用户（不使用alert，改用页面内显示）
                            console.error('Error from extension:', message.text);
                            showError(message.text);
                            break;
                    }
                });
                
                // 初始验证
                validateForm();
            </script>
        </body>
        </html>
        `;
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
            console.error('选择文件夹失败:', error);
            this._panel.webview.postMessage({
                command: 'error',
                text: 'Failed to select folder'
            });
        }
    }

    /**
     * 创建项目
     */
    private async _createProject(config: any): Promise<void> {
        try {
            const { projectName, saveLocation, appId, resolution, minSdk, pixelMode } = config;

            // 记录日志用于调试
            console.log(`[CreateProjectPanel] Creating project: projectName=${projectName}, saveLocation=${saveLocation}, appId=${appId}`);

            // 验证必填字段
            if (!projectName || !saveLocation || !appId) {
                console.error('[CreateProjectPanel] Validation failed: Missing required fields');
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '请填写所有必填字段 (项目名称、保存位置、APP ID)'
                });
                return;
            }

            // 验证项目名称格式
            const invalidChars = /[<>:*"?|\\/]/;
            if (invalidChars.test(projectName)) {
                console.error(`[CreateProjectPanel] Invalid project name: ${projectName}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: '项目名称包含非法字符，不能包含: < > : * " ? | \\ /'
                });
                return;
            }

            const projectPath = path.join(saveLocation, projectName);
            console.log(`[CreateProjectPanel] Full project path: ${projectPath}`);

            // 检查项目路径是否已存在（增强检测）
            try {
                if (fs.existsSync(projectPath)) {
                    const stats = fs.statSync(projectPath);
                    if (stats.isDirectory()) {
                        console.error(`[CreateProjectPanel] Project directory already exists: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `项目已存在: "${projectName}"\n\n目录 "${projectPath}" 已存在。\n\n请选择其他名称或删除现有项目。`
                        });
                        return;
                    } else {
                        console.error(`[CreateProjectPanel] Path exists but is not a directory: ${projectPath}`);
                        this._panel.webview.postMessage({
                            command: 'error',
                            text: `无法创建项目: "${projectPath}" 已存在且不是一个目录`
                        });
                        return;
                    }
                }
            } catch (error) {
                console.error(`[CreateProjectPanel] Error checking path existence: ${error}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    text: `检查项目路径时出错: ${error instanceof Error ? error.message : '未知错误'}`
                });
                return;
            }
            
            // 显示创建中消息
            vscode.window.showInformationMessage(`Creating project: ${projectName}...`);
            
            // 创建项目结构
            await this._createProjectStructure(projectPath, projectName, appId, resolution, minSdk, pixelMode);
            
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

            // 自动打开项目文件夹
            // 注意：这会导致VSCode重新加载扩展，当前上下文将失效
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);

            // 注意：代码执行到这里，扩展会被重新加载
            // 实际的激活逻辑将在 extension.ts 的 activate 函数中处理
            // 通过检查 globalState 中的 pendingProjectActivation
            
            // 关闭Webview
            this.dispose();
            
        } catch (error) {
            console.error('创建项目失败:', error);
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
        minSdk: string,
        pixelMode: string
    ): Promise<void> {
        // 创建目录结构
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'ui'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
        
        // 解析分辨率
        const [width, height] = resolution.split('X').map(Number);
        
        // 创建HML文件
        const hmlContent = `<!-- ${projectName} UI definition -->
<!-- APP ID: ${appId} -->
<!-- Resolution: ${resolution} -->
<!-- Min SDK: ${minSdk} -->
<!-- Pixel Mode: ${pixelMode} -->
<hml page id="${projectName}" width="${width}" height="${height}">
  <container id="root" layout="column" padding="16">
    <text id="title" value="${projectName}" fontSize="24" marginTop="16" align="center"/>
    <button id="welcomeButton" text="Click Me" marginTop="32" align="center" onClick="OnWelcomeButtonClick"/>
  </container>
</hml>`;
        
        fs.writeFileSync(path.join(projectPath, 'ui', `${projectName}.hml`), hmlContent, 'utf8');
        
        // 创建C++文件
        const cppContent = `// ${projectName} Main Program
// APP ID: ${appId}

#include <iostream>

// <honeygui-protect-begin:handler>
void OnWelcomeButtonClick() {
    std::cout << "Welcome to ${projectName}!" << std::endl;
}
// <honeygui-protect-end:handler>

int main() {
    std::cout << "${projectName} starting..." << std::endl;
    return 0;
}`;
        
        fs.writeFileSync(path.join(projectPath, 'src', 'main.cpp'), cppContent, 'utf8');
        
        // 创建README文件
        const readmeContent = `# ${projectName}

A HoneyGUI project created with the following configuration:

- **APP ID**: ${appId}
- **Resolution**: ${resolution}
- **Minimum SDK**: ${minSdk}
- **Pixel Mode**: ${pixelMode}

## Project Structure

- **ui/**: Contains HML UI definition files
- **src/**: Contains C/C++ source code
- **assets/**: Contains image and other resource files

## Getting Started

1. Open this project in VS Code
2. Use the HoneyGUI Designer to modify the UI
3. Run the preview to see your changes in real-time
4. Generate code to update the C/C++ implementation
`;

        fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

        // 创建 project.json 项目配置文件
        const projectConfig = {
            name: projectName,
            appId: appId,
            version: '1.0.0',
            resolution: resolution,
            minSdk: minSdk,
            pixelMode: pixelMode,
            mainHmlFile: `ui/${projectName}.hml`,
            created: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(projectPath, 'project.json'),
            JSON.stringify(projectConfig, null, 2),
            'utf8'
        );
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
