import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { Model3DConverterService } from '../services/Model3DConverterService';
// import { FontConverterService } from '../services/FontConverterService';  // TODO: 等字体转换工具准备好
import { getToolsPanelHtml } from './ToolsPanelHtml';

interface FileItem {
    id: string;
    name: string;
    relativePath: string;
    type: 'image' | 'video' | 'model' | 'font' | 'unknown';
    data: number[];
    settings?: any;
}

export class ToolsPanel {
    public static currentPanel: ToolsPanel | undefined;
    private static readonly viewType = 'honeygui.toolsPanel';

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private imageConverter: ImageConverterService;
    private videoConverter: VideoConverterService;
    private model3DConverter: Model3DConverterService;
    // private fontConverter: FontConverterService;

    private files: Map<string, FileItem> = new Map();
    private folderSettings: Map<string, any> = new Map();
    private outputDir: string = '';

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        const sdkPath = this.getSdkPath();
        this.imageConverter = new ImageConverterService(sdkPath);
        this.videoConverter = new VideoConverterService(sdkPath, msg => logger.info(msg));
        this.model3DConverter = new Model3DConverterService(sdkPath);
        // this.fontConverter = new FontConverterService();

        this.panel.webview.html = getToolsPanelHtml();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri): void {
        if (ToolsPanel.currentPanel) {
            ToolsPanel.currentPanel.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            ToolsPanel.viewType, '资源转换工具', vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        ToolsPanel.currentPanel = new ToolsPanel(panel, extensionUri);
    }

    private getSdkPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('honeygui');
        return config.get<string>('sdk.path') || process.env.HOME + '/.HoneyGUI-SDK';
    }

    private getFileType(fileName: string): 'image' | 'video' | 'model' | 'font' | 'unknown' {
        const ext = path.extname(fileName).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.bmp'].includes(ext)) return 'image';
        if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) return 'video';
        if (['.obj', '.gltf'].includes(ext)) return 'model';
        if (['.ttf', '.otf'].includes(ext)) return 'font';
        return 'unknown';
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'addFile':
                this.addFile(message.id, message.name, message.relativePath, message.data);
                break;
            case 'removeFile':
                this.files.delete(message.id);
                break;
            case 'clearFiles':
                this.files.clear();
                this.folderSettings.clear();
                break;
            case 'updateFileSettings':
                this.updateFileSettings(message.id, message.settings);
                break;
            case 'updateFolderSettings':
                this.folderSettings.set(message.folderPath, message.settings);
                break;
            case 'selectOutputDir':
                await this.selectOutputDir();
                break;
            case 'startConvert':
                await this.startConvert();
                break;
        }
    }

    private addFile(id: string, name: string, relativePath: string, data: number[]): void {
        const type = this.getFileType(name);
        if (type === 'unknown') return;
        this.files.set(id, { id, name, relativePath, type, data });
    }

    private updateFileSettings(id: string, settings: any): void {
        const file = this.files.get(id);
        if (file) file.settings = settings;
    }

    private async selectOutputDir(): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: '选择输出目录'
        });
        if (result?.[0]) {
            this.outputDir = result[0].fsPath;
            this.panel.webview.postMessage({ type: 'outputDirSelected', dir: this.outputDir });
        }
    }

    private async startConvert(): Promise<void> {
        if (!this.outputDir || this.files.size === 0) return;

        const results: any[] = [];
        let completed = 0;
        const total = this.files.size;

        for (const file of this.files.values()) {
            this.panel.webview.postMessage({ 
                type: 'progress', current: completed, total, fileName: file.name 
            });

            const result = await this.convertFile(file);
            results.push(result);
            completed++;
        }

        this.panel.webview.postMessage({ type: 'convertComplete', results });
    }

    private async convertFile(file: FileItem): Promise<any> {
        const tempDir = require('os').tmpdir();
        const tempInput = path.join(tempDir, `honeygui_${file.id}_${file.name}`);
        const fs = require('fs');
        
        try {
            fs.writeFileSync(tempInput, Buffer.from(file.data));
            const settings = this.getEffectiveSettings(file);
            let outputPath: string;
            let result: any;

            // 确保输出子目录存在
            const outputSubDir = path.join(this.outputDir, file.relativePath);
            if (!fs.existsSync(outputSubDir)) {
                fs.mkdirSync(outputSubDir, { recursive: true });
            }

            switch (file.type) {
                case 'image':
                    outputPath = path.join(outputSubDir, file.name.replace(/\.[^.]+$/, '.bin'));
                    result = await this.imageConverter.convert(tempInput, outputPath, settings.format || 'auto');
                    break;
                case 'video':
                    const extMap: Record<string, string> = { avi: '.avi', h264: '.h264', mjpeg: '.mjpeg' };
                    outputPath = path.join(outputSubDir, file.name.replace(/\.[^.]+$/, extMap[settings.format] || '.mjpeg'));
                    result = await this.videoConverter.convert(tempInput, outputPath, {
                        format: settings.format || 'mjpeg',
                        quality: settings.quality || 1,
                        frameRate: settings.frameRate
                    });
                    break;
                case 'model':
                    const ext = path.extname(file.name).toLowerCase();
                    const prefix = ext === '.gltf' ? 'gltf_desc_' : 'desc_';
                    outputPath = path.join(outputSubDir, prefix + file.name.replace(/\.[^.]+$/, '.bin'));
                    result = await this.model3DConverter.convert(tempInput, outputPath, this.outputDir);
                    break;
                case 'font':
                    // TODO: 等字体转换工具准备好
                    outputPath = path.join(outputSubDir, file.name.replace(/\.[^.]+$/, '.bin'));
                    result = { success: false, inputPath: tempInput, outputPath, error: '字体转换功能开发中' };
                    break;
                default:
                    result = { success: false, error: 'Unknown file type' };
            }

            return { ...result, fileName: file.name };
        } finally {
            try { fs.unlinkSync(tempInput); } catch {}
        }
    }

    private getEffectiveSettings(file: FileItem): any {
        if (file.settings && Object.keys(file.settings).length > 0) {
            return file.settings;
        }
        
        // 查找继承的文件夹设置
        if (file.relativePath) {
            const parts = file.relativePath.split('/');
            for (let i = parts.length; i > 0; i--) {
                const folderPath = parts.slice(0, i).join('/');
                const folderSetting = this.folderSettings.get(folderPath);
                if (folderSetting) {
                    const typeSetting = folderSetting[file.type];
                    if (typeSetting) return typeSetting;
                }
            }
        }
        
        return {};
    }

    public dispose(): void {
        ToolsPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
