import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { Model3DConverterService } from '../services/Model3DConverterService';

/**
 * 资源转换工具面板
 */
export class ToolsPanel {
    public static currentPanel: ToolsPanel | undefined;
    private static readonly viewType = 'honeygui.toolsPanel';

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private imageConverter: ImageConverterService;
    private videoConverter: VideoConverterService;
    private model3DConverter: Model3DConverterService;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;

        const sdkPath = this.getSdkPath();
        this.imageConverter = new ImageConverterService(sdkPath);
        this.videoConverter = new VideoConverterService(sdkPath, msg => logger.info(msg));
        this.model3DConverter = new Model3DConverterService(sdkPath);

        this.panel.webview.html = this.getWebviewContent();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri): void {
        if (ToolsPanel.currentPanel) {
            ToolsPanel.currentPanel.panel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ToolsPanel.viewType,
            '资源转换工具',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        ToolsPanel.currentPanel = new ToolsPanel(panel, extensionUri);
    }

    private getSdkPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('honeygui');
        return config.get<string>('sdk.path') || process.env.HOME + '/.HoneyGUI-SDK';
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'selectFiles':
                await this.selectFiles(message.fileType);
                break;
            case 'selectOutputDir':
                await this.selectOutputDir();
                break;
            case 'convertImages':
                await this.convertImages(message.files, message.outputDir, message.format);
                break;
            case 'convertVideos':
                await this.convertVideos(message.files, message.outputDir, message.options);
                break;
            case 'convertModels':
                await this.convertModels(message.files, message.outputDir);
                break;
        }
    }

    private async selectFiles(fileType: string): Promise<void> {
        const filters: Record<string, string[]> = {
            image: ['png', 'jpg', 'jpeg', 'bmp'],
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
            model: ['obj', 'gltf']
        };

        const result = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: { [fileType]: filters[fileType] || ['*'] }
        });

        if (result) {
            this.panel.webview.postMessage({
                type: 'filesSelected',
                fileType,
                files: result.map(uri => uri.fsPath)
            });
        }
    }

    private async selectOutputDir(): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: '选择输出目录'
        });

        if (result?.[0]) {
            this.panel.webview.postMessage({ type: 'outputDirSelected', dir: result[0].fsPath });
        }
    }

    private async convertImages(files: string[], outputDir: string, format: string): Promise<void> {
        const results = await Promise.all(files.map(file => {
            const outputPath = path.join(outputDir, path.basename(file, path.extname(file)) + '.bin');
            return this.imageConverter.convert(file, outputPath, format);
        }));
        this.panel.webview.postMessage({ type: 'convertComplete', category: 'image', results });
    }

    private async convertVideos(files: string[], outputDir: string, options: any): Promise<void> {
        const extMap: Record<string, string> = { avi: '.avi', h264: '.h264', mjpeg: '.mjpeg' };
        const results = await Promise.all(files.map(file => {
            const outputPath = path.join(outputDir, path.basename(file, path.extname(file)) + (extMap[options.format] || '.mjpeg'));
            return this.videoConverter.convert(file, outputPath, options);
        }));
        this.panel.webview.postMessage({ type: 'convertComplete', category: 'video', results });
    }

    private async convertModels(files: string[], outputDir: string): Promise<void> {
        const results = await Promise.all(files.map(file => {
            const ext = path.extname(file).toLowerCase();
            const baseName = path.basename(file, ext);
            const prefix = ext === '.gltf' ? 'gltf_desc_' : 'desc_';
            return this.model3DConverter.convert(file, path.join(outputDir, prefix + baseName + '.bin'), outputDir);
        }));
        this.panel.webview.postMessage({ type: 'convertComplete', category: 'model', results });
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>资源转换工具</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:20px}
        h1{font-size:18px;margin-bottom:20px}
        .tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:20px}
        .tab{padding:10px 20px;cursor:pointer;border:none;background:transparent;color:var(--vscode-foreground);opacity:.7}
        .tab.active{opacity:1;border-bottom:2px solid var(--vscode-focusBorder)}
        .tab-content{display:none}.tab-content.active{display:block}
        .section{background:var(--vscode-input-background);border-radius:4px;padding:16px;margin-bottom:16px}
        .section-title{font-size:14px;font-weight:600;margin-bottom:12px}
        .form-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .form-row label{min-width:80px}
        select,input[type="number"]{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);color:var(--vscode-input-foreground);padding:6px 10px;border-radius:4px}
        button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 16px;border-radius:4px;cursor:pointer}
        button:hover{background:var(--vscode-button-hoverBackground)}
        button:disabled{opacity:.5;cursor:not-allowed}
        .file-list{max-height:150px;overflow-y:auto;border:1px solid var(--vscode-input-border);border-radius:4px;padding:8px;margin-top:8px}
        .file-item{padding:4px 0;font-size:12px;color:var(--vscode-descriptionForeground)}
        .output-dir{padding:8px;background:var(--vscode-textBlockQuote-background);border-radius:4px;font-size:12px;word-break:break-all}
        .results{margin-top:16px;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap}
        .results.success{background:#2e7d32;color:#fff}
        .results.error{background:#c62828;color:#fff}
        .results.info{background:var(--vscode-textBlockQuote-background)}
        .convert-btn{padding:10px 24px;font-size:14px}
    </style>
</head>
<body>
    <h1>🔧 资源转换工具</h1>
    <div class="tabs">
        <button class="tab active" data-tab="image">🖼️ 图片转换</button>
        <button class="tab" data-tab="video">🎬 视频转换</button>
        <button class="tab" data-tab="model">📦 3D模型转换</button>
    </div>

    <div id="image" class="tab-content active">
        <div class="section">
            <div class="section-title">输入文件</div>
            <button onclick="selectFiles('image')">选择图片文件</button>
            <div id="image-files" class="file-list" style="display:none"></div>
        </div>
        <div class="section">
            <div class="section-title">输出设置</div>
            <div class="form-row">
                <label>像素格式:</label>
                <select id="image-format">
                    <option value="auto">自动检测</option>
                    <option value="rgb565">RGB565</option>
                    <option value="rgb888">RGB888</option>
                    <option value="argb8888">ARGB8888</option>
                    <option value="argb8565">ARGB8565</option>
                    <option value="a8">A8</option>
                </select>
            </div>
            <div class="form-row">
                <label>输出目录:</label>
                <button onclick="selectOutputDir('image')">选择目录</button>
            </div>
            <div id="image-output-dir" class="output-dir" style="display:none"></div>
        </div>
        <button class="convert-btn" onclick="convert('image')" id="image-convert-btn" disabled>开始转换</button>
        <div id="image-results" class="results" style="display:none"></div>
    </div>

    <div id="video" class="tab-content">
        <div class="section">
            <div class="section-title">输入文件</div>
            <button onclick="selectFiles('video')">选择视频文件</button>
            <div id="video-files" class="file-list" style="display:none"></div>
        </div>
        <div class="section">
            <div class="section-title">输出设置</div>
            <div class="form-row"><label>输出格式:</label>
                <select id="video-format"><option value="mjpeg">MJPEG</option><option value="avi">AVI</option><option value="h264">H.264</option></select>
            </div>
            <div class="form-row"><label>质量(1-31):</label><input type="number" id="video-quality" value="1" min="1" max="31"></div>
            <div class="form-row"><label>帧率:</label><input type="number" id="video-framerate" placeholder="保持原始"></div>
            <div class="form-row"><label>输出目录:</label><button onclick="selectOutputDir('video')">选择目录</button></div>
            <div id="video-output-dir" class="output-dir" style="display:none"></div>
        </div>
        <button class="convert-btn" onclick="convert('video')" id="video-convert-btn" disabled>开始转换</button>
        <div id="video-results" class="results" style="display:none"></div>
    </div>

    <div id="model" class="tab-content">
        <div class="section">
            <div class="section-title">输入文件</div>
            <button onclick="selectFiles('model')">选择模型文件 (.obj/.gltf)</button>
            <div id="model-files" class="file-list" style="display:none"></div>
        </div>
        <div class="section">
            <div class="section-title">输出设置</div>
            <div class="form-row"><label>输出目录:</label><button onclick="selectOutputDir('model')">选择目录</button></div>
            <div id="model-output-dir" class="output-dir" style="display:none"></div>
        </div>
        <button class="convert-btn" onclick="convert('model')" id="model-convert-btn" disabled>开始转换</button>
        <div id="model-results" class="results" style="display:none"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const state = {image:{files:[],outputDir:''},video:{files:[],outputDir:''},model:{files:[],outputDir:''}};
        let currentTab = 'image';

        document.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                document.getElementById(currentTab).classList.add('active');
            };
        });

        function selectFiles(type) { vscode.postMessage({type:'selectFiles',fileType:type}); }
        function selectOutputDir() { vscode.postMessage({type:'selectOutputDir'}); }

        function updateBtn(type) {
            document.getElementById(type+'-convert-btn').disabled = !(state[type].files.length && state[type].outputDir);
        }

        function convert(type) {
            const msg = {files:state[type].files, outputDir:state[type].outputDir};
            if(type==='image') { msg.type='convertImages'; msg.format=document.getElementById('image-format').value; }
            else if(type==='video') {
                msg.type='convertVideos';
                const fr = document.getElementById('video-framerate').value;
                msg.options = {format:document.getElementById('video-format').value, quality:+document.getElementById('video-quality').value||1, frameRate:fr?+fr:undefined};
            } else { msg.type='convertModels'; }
            vscode.postMessage(msg);
            const r = document.getElementById(type+'-results');
            r.style.display='block'; r.className='results info'; r.textContent='转换中...';
        }

        window.addEventListener('message', e => {
            const msg = e.data;
            if(msg.type==='filesSelected') {
                state[msg.fileType].files = msg.files;
                const el = document.getElementById(msg.fileType+'-files');
                el.style.display='block';
                el.innerHTML = msg.files.map(f=>'<div class="file-item">'+f.split(/[\\\\/]/).pop()+'</div>').join('');
                updateBtn(msg.fileType);
            } else if(msg.type==='outputDirSelected') {
                state[currentTab].outputDir = msg.dir;
                const el = document.getElementById(currentTab+'-output-dir');
                el.style.display='block'; el.textContent=msg.dir;
                updateBtn(currentTab);
            } else if(msg.type==='convertComplete') {
                const r = document.getElementById(msg.category+'-results');
                const ok = msg.results.filter(x=>x.success).length, fail = msg.results.length - ok;
                r.className = 'results '+(fail?'error':'success');
                r.textContent = '完成: '+ok+' 成功, '+fail+' 失败';
                if(fail) r.textContent += '\\n' + msg.results.filter(x=>!x.success).map(x=>x.error).join('\\n');
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        ToolsPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
