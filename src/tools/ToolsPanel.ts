import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { Model3DConverterService } from '../services/Model3DConverterService';
import { FontConverterService } from '../services/FontConverterService';

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
    private fontConverter: FontConverterService;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;

        const sdkPath = this.getSdkPath();
        this.imageConverter = new ImageConverterService(sdkPath);
        this.videoConverter = new VideoConverterService(sdkPath, msg => logger.info(msg));
        this.model3DConverter = new Model3DConverterService(sdkPath);
        this.fontConverter = new FontConverterService();

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
            case 'convertFonts':
                await this.convertFonts(message.files, message.outputDir, message.options);
                break;
        }
    }

    private async selectFiles(fileType: string): Promise<void> {
        const filters: Record<string, string[]> = {
            image: ['png', 'jpg', 'jpeg', 'bmp'],
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
            model: ['obj', 'gltf'],
            font: ['ttf', 'otf']
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

    private async convertFonts(files: string[], outputDir: string, options: any): Promise<void> {
        const results = await Promise.all(files.map(file => {
            return this.fontConverter.convert(file, outputDir, {
                fontSize: options.fontSize || 16,
                renderMode: options.renderMode || 4,
                outputFormat: options.outputFormat || 'bitmap',
                characterSets: options.characterSets || [{ type: 'range', value: '0x20-0x7E' }]
            });
        }));
        this.panel.webview.postMessage({ type: 'convertComplete', category: 'font', results });
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
        .tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:20px;flex-wrap:wrap}
        .tab{padding:10px 16px;cursor:pointer;border:none;background:transparent;color:var(--vscode-foreground);opacity:.7}
        .tab.active{opacity:1;border-bottom:2px solid var(--vscode-focusBorder)}
        .tab-content{display:none}.tab-content.active{display:block}
        .section{background:var(--vscode-input-background);border-radius:4px;padding:16px;margin-bottom:16px}
        .section-title{font-size:14px;font-weight:600;margin-bottom:12px}
        .form-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .form-row label{min-width:80px}
        select,input[type="number"],input[type="text"],textarea{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);color:var(--vscode-input-foreground);padding:6px 10px;border-radius:4px}
        input[type="text"]{flex:1}
        textarea{width:100%;min-height:60px;resize:vertical}
        button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 16px;border-radius:4px;cursor:pointer}
        button:hover{background:var(--vscode-button-hoverBackground)}
        button:disabled{opacity:.5;cursor:not-allowed}
        .file-list{max-height:150px;overflow-y:auto;border:1px solid var(--vscode-input-border);border-radius:4px;padding:8px;margin-top:8px}
        .file-item{padding:4px 0;font-size:12px;color:var(--vscode-descriptionForeground)}
        .output-dir{padding:8px;background:var(--vscode-textBlockQuote-background);border-radius:4px;font-size:12px;word-break:break-all;margin-top:8px}
        .results{margin-top:16px;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap}
        .results.success{background:#2e7d32;color:#fff}
        .results.error{background:#c62828;color:#fff}
        .results.info{background:var(--vscode-textBlockQuote-background)}
        .convert-btn{padding:10px 24px;font-size:14px}
        .hint{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px}
        .charset-tabs{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
        .charset-tab{padding:6px 12px;font-size:12px;border-radius:4px 4px 0 0;background:var(--vscode-tab-inactiveBackground);border:1px solid var(--vscode-panel-border);border-bottom:none;cursor:pointer;display:flex;align-items:center;gap:6px}
        .charset-tab.active{background:var(--vscode-tab-activeBackground);border-bottom:1px solid var(--vscode-tab-activeBackground)}
        .charset-tab .remove-btn{font-size:14px;line-height:1;opacity:.6;cursor:pointer}
        .charset-tab .remove-btn:hover{opacity:1;color:#f44}
        .add-charset-btn{padding:6px 10px;font-size:12px;background:transparent;border:1px dashed var(--vscode-panel-border);color:var(--vscode-descriptionForeground)}
        .add-charset-btn:hover{border-color:var(--vscode-focusBorder);color:var(--vscode-foreground)}
        .charset-content{border:1px solid var(--vscode-panel-border);border-radius:0 4px 4px 4px;padding:12px}
        .charset-panel{display:none}
        .charset-panel.active{display:block}
    </style>
</head>
<body>
    <h1>🔧 资源转换工具</h1>
    <div class="tabs">
        <button class="tab active" data-tab="image">🖼️ 图片</button>
        <button class="tab" data-tab="video">🎬 视频</button>
        <button class="tab" data-tab="model">📦 3D模型</button>
        <button class="tab" data-tab="font">🔤 字体</button>
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

    <div id="font" class="tab-content">
        <div class="section">
            <div class="section-title">1. 选择字体文件</div>
            <button onclick="selectFiles('font')">选择字体文件 (.ttf/.otf)</button>
            <div id="font-files" class="file-list" style="display:none"></div>
        </div>
        <div class="section">
            <div class="section-title">2. 输出格式</div>
            <div class="form-row">
                <label>字体类型:</label>
                <select id="font-outputFormat" onchange="onOutputFormatChange(this.value)">
                    <option value="bitmap" selected>位图字体 (Bitmap)</option>
                    <option value="vector">矢量字体 (Vector)</option>
                </select>
            </div>
        </div>
        <div class="section">
            <div class="section-title">3. 字体参数</div>
            <div class="form-row">
                <label>字体大小:</label>
                <input type="number" id="font-size" value="16" min="8" max="200" style="width:80px">
                <label style="margin-left:20px">渲染模式:</label>
                <select id="font-renderMode">
                    <option value="1">1-bit (黑白)</option>
                    <option value="2">2-bit (4级灰度)</option>
                    <option value="4" selected>4-bit (16级灰度)</option>
                    <option value="8">8-bit (256级灰度)</option>
                </select>
            </div>
            <div id="vector-hint" class="hint" style="display:none;color:var(--vscode-textLink-foreground)">矢量字体渲染支持字号调整，无需修改当前配置项</div>
        </div>
        <div class="section">
            <div class="section-title">4. 字符集 <span style="font-weight:normal;font-size:12px;color:var(--vscode-descriptionForeground)">(多个字符集取并集)</span></div>
            <div class="charset-tabs" id="charset-tabs">
                <div class="charset-tab active" data-idx="0" onclick="switchCharset(0)">
                    <span>字符集 1</span>
                </div>
                <button class="add-charset-btn" onclick="addCharset()">+ 添加</button>
            </div>
            <div class="charset-content" id="charset-content">
                <div class="charset-panel active" data-idx="0">
                    <div class="form-row">
                        <label>类型:</label>
                        <select onchange="onCharsetTypeChange(0, this.value)">
                            <option value="range" selected>Unicode 范围</option>
                            <option value="string">自定义字符</option>
                            <option value="file">Charset 文件</option>
                            <option value="codepage">CodePage</option>
                        </select>
                    </div>
                    <div class="charset-input" data-type="range">
                        <div class="form-row">
                            <label>范围:</label>
                            <input type="text" id="charset-0-value" value="0x20-0x7E" placeholder="如: 0x20-0x7E 或 0x4E00-0x9FFF">
                        </div>
                        <div class="hint">格式: 起始码-结束码，支持十六进制(0x)或十进制</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">5. 输出目录</div>
            <div class="form-row">
                <button onclick="selectOutputDir('font')">选择目录</button>
            </div>
            <div id="font-output-dir" class="output-dir" style="display:none"></div>
        </div>
        <button class="convert-btn" onclick="convert('font')" id="font-convert-btn" disabled>开始转换</button>
        <div id="font-results" class="results" style="display:none"></div>
    </div>


    <script>
        const vscode = acquireVsCodeApi();
        const state = {image:{files:[],outputDir:''},video:{files:[],outputDir:''},model:{files:[],outputDir:''},font:{files:[],outputDir:''}};
        let currentTab = 'image';
        let charsetCount = 1;
        let activeCharsetIdx = 0;
        const charsets = [{type:'range', value:'0x20-0x7E'}];

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

        function onOutputFormatChange(format) {
            const sizeInput = document.getElementById('font-size');
            const modeSelect = document.getElementById('font-renderMode');
            const hint = document.getElementById('vector-hint');
            if(format === 'vector') {
                sizeInput.value = 32;
                sizeInput.disabled = true;
                modeSelect.value = '8';
                modeSelect.disabled = true;
                hint.style.display = 'block';
            } else {
                sizeInput.disabled = false;
                modeSelect.disabled = false;
                hint.style.display = 'none';
            }
        }

        function switchCharset(idx) {
            saveCurrentCharsetValue();
            activeCharsetIdx = idx;
            document.querySelectorAll('.charset-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.charset-panel').forEach(p => p.classList.remove('active'));
            document.querySelector('.charset-tab[data-idx="'+idx+'"]').classList.add('active');
            document.querySelector('.charset-panel[data-idx="'+idx+'"]').classList.add('active');
        }

        function saveCurrentCharsetValue() {
            const input = document.getElementById('charset-'+activeCharsetIdx+'-value');
            if(input) charsets[activeCharsetIdx].value = input.value;
        }

        function addCharset() {
            saveCurrentCharsetValue();
            const idx = charsetCount++;
            charsets.push({type:'range', value:''});
            const tabsContainer = document.getElementById('charset-tabs');
            const addBtn = tabsContainer.querySelector('.add-charset-btn');
            const newTab = document.createElement('div');
            newTab.className = 'charset-tab';
            newTab.dataset.idx = idx;
            newTab.innerHTML = '<span>字符集 '+(idx+1)+'</span><span class="remove-btn" onclick="removeCharset('+idx+',event)">×</span>';
            newTab.onclick = (e) => { if(!e.target.classList.contains('remove-btn')) switchCharset(idx); };
            tabsContainer.insertBefore(newTab, addBtn);
            const content = document.getElementById('charset-content');
            const panel = document.createElement('div');
            panel.className = 'charset-panel';
            panel.dataset.idx = idx;
            panel.innerHTML = createCharsetPanelHTML(idx, 'range');
            content.appendChild(panel);
            switchCharset(idx);
        }

        function removeCharset(idx, e) {
            e.stopPropagation();
            if(charsets.length <= 1) return;
            charsets.splice(idx, 1);
            document.querySelector('.charset-tab[data-idx="'+idx+'"]').remove();
            document.querySelector('.charset-panel[data-idx="'+idx+'"]').remove();
            rebuildCharsetTabs();
        }

        function rebuildCharsetTabs() {
            const tabsContainer = document.getElementById('charset-tabs');
            const content = document.getElementById('charset-content');
            const addBtn = tabsContainer.querySelector('.add-charset-btn');
            tabsContainer.querySelectorAll('.charset-tab').forEach(t => t.remove());
            content.innerHTML = '';
            charsetCount = charsets.length;
            charsets.forEach((cs, i) => {
                const tab = document.createElement('div');
                tab.className = 'charset-tab' + (i === 0 ? ' active' : '');
                tab.dataset.idx = i;
                tab.innerHTML = '<span>字符集 '+(i+1)+'</span>' + (charsets.length > 1 ? '<span class="remove-btn" onclick="removeCharset('+i+',event)">×</span>' : '');
                tab.onclick = (e) => { if(!e.target.classList.contains('remove-btn')) switchCharset(i); };
                tabsContainer.insertBefore(tab, addBtn);
                const panel = document.createElement('div');
                panel.className = 'charset-panel' + (i === 0 ? ' active' : '');
                panel.dataset.idx = i;
                panel.innerHTML = createCharsetPanelHTML(i, cs.type, cs.value);
                content.appendChild(panel);
            });
            activeCharsetIdx = 0;
        }

        function createCharsetPanelHTML(idx, type, value) {
            value = value || '';
            let inputHTML = '';
            if(type === 'range') {
                inputHTML = '<div class="charset-input"><div class="form-row"><label>范围:</label><input type="text" id="charset-'+idx+'-value" value="'+value+'" placeholder="如: 0x20-0x7E"></div><div class="hint">格式: 起始码-结束码，支持十六进制(0x)或十进制</div></div>';
            } else if(type === 'string') {
                inputHTML = '<div class="charset-input"><div class="form-row"><label>字符:</label><input type="text" id="charset-'+idx+'-value" value="'+value+'" placeholder="直接输入字符"></div><div class="hint">直接输入需要包含的字符</div></div>';
            } else if(type === 'file') {
                inputHTML = '<div class="charset-input"><div class="form-row"><label>文件路径:</label><input type="text" id="charset-'+idx+'-value" value="'+value+'" placeholder="charset 文件路径"></div><div class="hint">指定 .cst 或 .txt 字符集文件</div></div>';
            } else if(type === 'codepage') {
                inputHTML = '<div class="charset-input"><div class="form-row"><label>CodePage:</label><input type="text" id="charset-'+idx+'-value" value="'+value+'" placeholder="如: CP936"></div><div class="hint">指定代码页名称</div></div>';
            }
            return '<div class="form-row"><label>类型:</label><select onchange="onCharsetTypeChange('+idx+', this.value)"><option value="range"'+(type==='range'?' selected':'')+'>Unicode 范围</option><option value="string"'+(type==='string'?' selected':'')+'>自定义字符</option><option value="file"'+(type==='file'?' selected':'')+'>Charset 文件</option><option value="codepage"'+(type==='codepage'?' selected':'')+'>CodePage</option></select></div>'+inputHTML;
        }

        function onCharsetTypeChange(idx, type) {
            charsets[idx].type = type;
            charsets[idx].value = '';
            const panel = document.querySelector('.charset-panel[data-idx="'+idx+'"]');
            panel.innerHTML = createCharsetPanelHTML(idx, type, '');
        }

        function getCharsetSets() {
            saveCurrentCharsetValue();
            return charsets.filter(cs => cs.value.trim()).map(cs => ({type: cs.type, value: cs.value.trim()}));
        }

        function convert(type) {
            const msg = {files:state[type].files, outputDir:state[type].outputDir};
            if(type==='image') { msg.type='convertImages'; msg.format=document.getElementById('image-format').value; }
            else if(type==='video') {
                msg.type='convertVideos';
                const fr = document.getElementById('video-framerate').value;
                msg.options = {format:document.getElementById('video-format').value, quality:+document.getElementById('video-quality').value||1, frameRate:fr?+fr:undefined};
            } else if(type==='font') {
                msg.type='convertFonts';
                msg.options = {
                    fontSize: +document.getElementById('font-size').value || 16,
                    renderMode: +document.getElementById('font-renderMode').value || 4,
                    outputFormat: document.getElementById('font-outputFormat').value,
                    characterSets: getCharsetSets()
                };
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
                let text = '完成: '+ok+' 成功, '+fail+' 失败';
                if(msg.category==='font' && ok > 0) {
                    const res = msg.results.find(x=>x.success);
                    if(res && res.processedCount !== undefined) {
                        text += '\\n已处理 '+res.processedCount+' 个字符';
                        if(res.failedCount > 0) text += ', '+res.failedCount+' 个字符渲染失败';
                    }
                }
                if(fail) text += '\\n' + msg.results.filter(x=>!x.success).map(x=>x.error).join('\\n');
                r.textContent = text;
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
