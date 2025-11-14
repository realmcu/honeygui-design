import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CreateProjectPanel {
    public static readonly viewType = 'honeygui.createProject';

    private static instance: CreateProjectPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.panel = panel;
        this.context = context;

        // 设置面板内容
        this.update();

        // 添加事件监听器
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // 处理来自webview的消息
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'selectSaveLocation':
                        this.selectSaveLocation();
                        break;
                    case 'validateForm':
                        this.validateForm(message.formData);
                        break;
                    case 'createProject':
                        this.createProject(message.formData);
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    public static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经有实例存在，则显示它
        if (CreateProjectPanel.instance) {
            CreateProjectPanel.instance.panel.reveal(column);
            return;
        }

        // 否则创建新的面板
        const panel = vscode.window.createWebviewPanel(
            CreateProjectPanel.viewType,
            'Create application',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri],
            }
        );

        CreateProjectPanel.instance = new CreateProjectPanel(panel, context);
    }

    public static revive(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        CreateProjectPanel.instance = new CreateProjectPanel(panel, context);
    }

    private update() {
        this.panel.webview.html = this._getHtmlForWebview();
    }

    private async selectSaveLocation() {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Location',
            title: 'Select Project Save Location'
        };

        const result = await vscode.window.showOpenDialog(options);
        if (result && result.length > 0) {
            this.panel.webview.postMessage({
                command: 'saveLocationSelected',
                path: result[0].fsPath
            });
        }
    }

    private validateForm(formData: any) {
        let isValid = true;
        const errors: { [key: string]: string } = {};

        // 验证项目名称
        if (!formData.projectName || formData.projectName.trim() === '') {
            isValid = false;
            errors.projectName = 'Project name is required';
        }

        // 验证保存位置
        if (!formData.saveLocation || formData.saveLocation.trim() === '') {
            isValid = false;
            errors.saveLocation = 'Save location is required';
        }

        // 验证APP ID
        if (!formData.appId || formData.appId.trim() === '') {
            isValid = false;
            errors.appId = 'APP ID is required';
        } else {
            // 简单验证APP ID格式
            const appIdPattern = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;
            if (!appIdPattern.test(formData.appId)) {
                isValid = false;
                errors.appId = 'APP ID must be in reverse-domain format (e.g., com.example.app)';
            }
        }

        // 检查项目是否已存在
        if (isValid && formData.saveLocation && formData.projectName) {
            const projectPath = path.join(formData.saveLocation, formData.projectName);
            if (fs.existsSync(projectPath)) {
                isValid = false;
                errors.projectExists = 'Project with this name already exists at the selected location';
            }
        }

        this.panel.webview.postMessage({
            command: 'validationResult',
            isValid,
            errors
        });
    }

    private async createProject(formData: any) {
        try {
            // 显示加载状态
            this.panel.webview.postMessage({
                command: 'setLoading',
                isLoading: true
            });

            // 模拟项目创建过程（实际实现中应该调用项目脚手架逻辑）
            await new Promise(resolve => setTimeout(resolve, 1500));

            const projectPath = path.join(formData.saveLocation, formData.projectName);

            // 创建项目目录结构
            fs.mkdirSync(projectPath, { recursive: true });

            // 创建基本项目配置文件
            const projectConfig = {
                name: formData.projectName,
                appId: formData.appId,
                resolution: formData.resolution,
                minSdk: formData.minSdk,
                pixelMode: formData.pixelMode,
                version: '1.0.0',
                createdAt: new Date().toISOString()
            };

            fs.writeFileSync(
                path.join(projectPath, 'project.json'),
                JSON.stringify(projectConfig, null, 2)
            );

            // 创建基本的项目结构
            fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
            fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
            fs.mkdirSync(path.join(projectPath, 'styles'), { recursive: true });

            // 创建示例主页面
            fs.writeFileSync(
                path.join(projectPath, 'src', 'main.hml'),
                `<div class="container">
    <text class="title">Welcome to ${formData.projectName}</text>
    <button class="btn">Click Me</button>
</div>`
            );

            // 通知webview项目创建成功
            this.panel.webview.postMessage({
                command: 'setLoading',
                isLoading: false
            });

            // 显示成功消息
            vscode.window.showInformationMessage(`Project created successfully: ${formData.projectName}`);

            // 关闭面板
            this.dispose();

            // 询问是否打开新创建的项目
            const shouldOpen = await vscode.window.showInformationMessage(
                'Project created successfully. Would you like to open it?',
                'Yes',
                'No'
            );

            if (shouldOpen === 'Yes') {
                const uri = vscode.Uri.file(projectPath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, false);
            }
        } catch (error) {
            // 处理错误
            this.panel.webview.postMessage({
                command: 'setLoading',
                isLoading: false
            });
            
            vscode.window.showErrorMessage(
                `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private dispose() {
        CreateProjectPanel.instance = undefined;

        // 清理所有资源
        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getHtmlForWebview(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create HoneyGUI Project</title>
    <style>
        :root {
            --primary-color: #0366d6;
            --success-color: #28a745;
            --error-color: #d73a49;
            --border-color: #e1e4e8;
            --background-color: #ffffff;
            --text-color: #24292e;
            --text-secondary: #586069;
            --hover-background: #f6f8fa;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --primary-color: #58a6ff;
                --success-color: #3fb950;
                --error-color: #f85149;
                --border-color: #30363d;
                --background-color: #161b22;
                --text-color: #c9d1d9;
                --text-secondary: #8b949e;
                --hover-background: #1f6feb;
            }
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
            margin: 0;
            padding: 0;
            color: var(--text-color);
            background-color: var(--background-color);
            min-height: 100vh;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
        }

        .header {
            margin-bottom: 24px;
        }

        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
        }

        .subtitle {
            color: var(--text-secondary);
            margin: 0;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 24px;
        }

        .tab {
            padding: 12px 24px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            font-weight: 500;
            transition: all 0.2s;
        }

        .tab.active {
            border-bottom-color: var(--primary-color);
            color: var(--primary-color);
        }

        .tab:hover:not(.active) {
            background-color: var(--hover-background);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background-color: var(--background-color);
            color: var(--text-color);
            font-size: 14px;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3);
        }

        .input-group {
            display: flex;
            gap: 8px;
        }

        .input-group .form-control {
            flex: 1;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background-color: #0256c9;
        }

        .btn-success {
            background-color: var(--success-color);
            color: white;
        }

        .btn-success:hover:not(:disabled) {
            background-color: #22863a;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .error-message {
            color: var(--error-color);
            font-size: 12px;
            margin-top: 4px;
        }

        .form-actions {
            margin-top: 32px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }

        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Create a new HoneyGUI project</h1>
            <p class="subtitle">Set up your project with the options below</p>
        </div>

        <div class="tabs">
            <div class="tab active" id="emptyProjectTab">Create empty project</div>
            <div class="tab" id="templateProjectTab">Create template project</div>
        </div>

        <form id="projectForm">
            <div class="form-group">
                <label for="projectName">Project name</label>
                <input 
                    type="text" 
                    id="projectName" 
                    class="form-control" 
                    placeholder="NewProject" 
                    value="NewProject"
                    required
                >
                <div class="error-message" id="projectNameError"></div>
            </div>

            <div class="form-group">
                <label for="saveLocation">Save location</label>
                <div class="input-group">
                    <input 
                        type="text" 
                        id="saveLocation" 
                        class="form-control" 
                        placeholder="Please select a project save path" 
                        readonly
                        required
                    >
                    <button type="button" class="btn btn-primary" id="browseButton">Browse...</button>
                </div>
                <div class="error-message" id="saveLocationError"></div>
                <div class="error-message" id="projectExistsError"></div>
            </div>

            <div class="form-group">
                <label for="appId">APP ID</label>
                <input 
                    type="text" 
                    id="appId" 
                    class="form-control" 
                    placeholder="com.example.NewProject" 
                    value="com.example.NewProject"
                    required
                >
                <div class="error-message" id="appIdError"></div>
            </div>

            <div class="form-group">
                <label for="resolution">Resolution</label>
                <select id="resolution" class="form-control">
                    <option value="480x272">480x272</option>
                    <option value="800x480">800x480</option>
                    <option value="1280x720">1280x720</option>
                    <option value="1920x1080">1920x1080</option>
                </select>
            </div>

            <div class="form-group">
                <label for="minSdk">Minimum SDK</label>
                <select id="minSdk" class="form-control">
                    <option value="API 2: Persim Wear V1.1.0" selected>API 2: Persim Wear V1.1.0</option>
                    <option value="API 3: Persim Wear V2.0.0">API 3: Persim Wear V2.0.0</option>
                    <option value="API 4: Persim Wear V3.0.0">API 4: Persim Wear V3.0.0</option>
                </select>
            </div>

            <div class="form-group">
                <label for="pixelMode">Pixel Mode</label>
                <select id="pixelMode" class="form-control">
                    <option value="ARGB8888" selected>ARGB8888</option>
                    <option value="RGB565">RGB565</option>
                    <option value="RGBA4444">RGBA4444</option>
                </select>
            </div>

            <div class="form-actions">
                <button type="button" class="btn" id="cancelButton">Cancel</button>
                <button type="button" class="btn btn-success" id="createButton" disabled>Create</button>
            </div>
        </form>
    </div>

    <div class="loading-overlay" id="loadingOverlay" style="display: none;">
        <div class="loading-spinner"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // 表单元素
        const projectNameInput = document.getElementById('projectName');
        const saveLocationInput = document.getElementById('saveLocation');
        const appIdInput = document.getElementById('appId');
        const createButton = document.getElementById('createButton');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        // 监听项目名称变化，自动更新APP ID
        projectNameInput.addEventListener('input', () => {
            if (appIdInput.value.startsWith('com.example.')) {
                const projectName = projectNameInput.value.trim();
                if (projectName) {
                    // 将项目名称转换为驼峰命名
                    const formattedName = projectName.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
                    appIdInput.value = "com.example." + formattedName;
                }
            }
            validateForm();
        });
        
        // 浏览按钮点击事件
        document.getElementById('browseButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'selectSaveLocation' });
        });
        
        // 接收保存位置选择结果
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'saveLocationSelected') {
                saveLocationInput.value = message.path;
                validateForm();
            } else if (message.command === 'validationResult') {
                // 更新表单验证状态
                updateValidationErrors(message.errors);
                createButton.disabled = !message.isValid;
            } else if (message.command === 'setLoading') {
                loadingOverlay.style.display = message.isLoading ? 'flex' : 'none';
            }
        });
        
        // 表单输入事件
        const formInputs = document.querySelectorAll('input, select');
        formInputs.forEach(input => {
            input.addEventListener('input', validateForm);
        });
        
        // 验证表单
        function validateForm() {
            const formData = {
                projectName: projectNameInput.value.trim(),
                saveLocation: saveLocationInput.value.trim(),
                appId: appIdInput.value.trim(),
                resolution: document.getElementById('resolution').value,
                minSdk: document.getElementById('minSdk').value,
                pixelMode: document.getElementById('pixelMode').value
            };
            
            vscode.postMessage({
                command: 'validateForm',
                formData
            });
        }
        
        // 更新验证错误信息
        function updateValidationErrors(errors) {
            // 清除所有错误信息
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            
            // 显示新的错误信息
            for (const [field, message] of Object.entries(errors)) {
                const errorElement = document.getElementById(field + "Error");
                if (errorElement) {
                    errorElement.textContent = message;
                }
            }
        }
        
        // 创建按钮点击事件
        createButton.addEventListener('click', () => {
            const formData = {
                projectName: projectNameInput.value.trim(),
                saveLocation: saveLocationInput.value.trim(),
                appId: appIdInput.value.trim(),
                resolution: document.getElementById('resolution').value,
                minSdk: document.getElementById('minSdk').value,
                pixelMode: document.getElementById('pixelMode').value
            };
            
            vscode.postMessage({
                command: 'createProject',
                formData
            });
        });
        
        // 取消按钮点击事件
        document.getElementById('cancelButton').addEventListener('click', () => {
            // 通知VS Code关闭面板
            window.close();
        });
        
        // 选项卡切换
        document.getElementById('emptyProjectTab').addEventListener('click', () => {
            setActiveTab('emptyProjectTab');
        });
        
        document.getElementById('templateProjectTab').addEventListener('click', () => {
            setActiveTab('templateProjectTab');
            // 简单提示，模板项目功能暂未实现
            alert('Template project creation will be implemented in a future update.');
        });
        
        function setActiveTab(tabId) {
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        }
        
        // 初始验证
        validateForm();
    </script>
</body>
</html>
        `;
    }
}
