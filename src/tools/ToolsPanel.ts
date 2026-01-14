import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';
import { ImageConverterService } from '../services/ImageConverterService';
import { VideoConverterService } from '../services/VideoConverterService';
import { Model3DConverterService } from '../services/Model3DConverterService';
import { FontConverterService } from '../services/FontConverterService';
import { GlassConverterService } from '../services/GlassConverterService';
import { getToolsPanelHtml } from './ToolsPanelHtml';

interface FileItem {
    id: string;
    name: string;
    relativePath: string;
    type: 'image' | 'video' | 'model' | 'font' | 'glass' | 'unknown';
    data: number[];
    settings?: any;
}

export class ToolsPanel {
    public static currentPanel: ToolsPanel | undefined;
    private static readonly viewType = 'honeygui.toolsPanel';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private imageConverter: ImageConverterService;
    private videoConverter: VideoConverterService;
    private model3DConverter: Model3DConverterService;
    private fontConverter: FontConverterService;
    private glassConverter: GlassConverterService;

    private files: Map<string, FileItem> = new Map();
    private folderSettings: Map<string, any> = new Map();
    private outputDir: string = '';

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.imageConverter = new ImageConverterService();
        this.videoConverter = new VideoConverterService(msg => logger.info(msg));
        this.model3DConverter = new Model3DConverterService();
        this.fontConverter = new FontConverterService();
        this.glassConverter = new GlassConverterService();

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

    private getFileType(fileName: string): 'image' | 'video' | 'model' | 'font' | 'glass' | 'unknown' {
        const ext = path.extname(fileName).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.bmp'].includes(ext)) return 'image';
        if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) return 'video';
        if (['.obj', '.gltf'].includes(ext)) return 'model';
        if (['.ttf', '.otf'].includes(ext)) return 'font';
        if (['.glass'].includes(ext)) return 'glass';
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
            case 'selectCharsetFile':
                await this.selectCharsetFile(message.charsetIdx, message.charsetType);
                break;
            case 'startConvert':
                await this.startConvert();
                break;
            case 'previewGlass':
                await this.previewGlass(message.id, message.data, message.settings);
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

    private async selectCharsetFile(charsetIdx: number, charsetType: string): Promise<void> {
        // 获取扩展所在目录
        const extensionPath = this.extensionUri.fsPath;
        
        let defaultUri: vscode.Uri | undefined;
        let filters: Record<string, string[]> | undefined;
        let title: string;

        if (charsetType === 'codepage') {
            // CodePage 文件：默认路径 tools/font-converter/CodePage，无后缀限制
            const codepagePath = path.join(extensionPath, 'tools', 'font-converter', 'CodePage');
            if (fs.existsSync(codepagePath)) {
                defaultUri = vscode.Uri.file(codepagePath);
            }
            title = '选择 CodePage 文件';
            // 不设置 filters，允许选择所有文件
        } else {
            // Charset 文件：默认路径 tools/font-converter/charset
            const charsetPath = path.join(extensionPath, 'tools', 'font-converter', 'charset');
            if (fs.existsSync(charsetPath)) {
                defaultUri = vscode.Uri.file(charsetPath);
            }
            filters = { '字符集文件': ['cst', 'txt'] };
            title = '选择字符集文件';
        }

        const result = await vscode.window.showOpenDialog({
            canSelectMany: false,
            defaultUri,
            filters,
            openLabel: title
        });

        if (result?.[0]) {
            this.panel.webview.postMessage({
                type: 'charsetFileSelected',
                charsetIdx,
                filePath: result[0].fsPath
            });
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
        // 字体文件使用原始文件名（因为转换器会用文件名生成输出名）
        // 其他类型使用带 ID 的名称避免冲突
        const tempFileName = file.type === 'font' ? file.name : `honeygui_${file.id}_${file.name}`;
        const tempInput = path.join(tempDir, tempFileName);
        
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
                    outputPath = outputSubDir;
                    result = await this.fontConverter.convert(tempInput, outputPath, {
                        fontSize: settings.fontSize || 32,
                        renderMode: settings.renderMode || 4,
                        outputFormat: settings.outputFormat || 'bitmap',
                        characterSets: settings.characterSets || [{ type: 'range', value: '0x20-0x7E' }],
                        crop: settings.crop
                    });
                    break;
                case 'glass':
                    outputPath = path.join(outputSubDir, file.name.replace(/\.[^.]+$/, '.bin'));
                    result = await this.glassConverter.convert(tempInput, outputPath, {
                        blurRadius: settings.blurRadius || 50,
                        blurIntensity: settings.blurIntensity || 50
                    });
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

    /**
     * 预览玻璃效果
     */
    private async previewGlass(id: string, data: number[], settings: any): Promise<void> {
        try {
            const svgData = Buffer.from(data);
            const result = await this.glassConverter.generatePreview(svgData, {
                blurRadius: settings?.blurRadius || 50,
                blurIntensity: settings?.blurIntensity || 50
            });

            if (result.success && result.base64) {
                this.panel.webview.postMessage({
                    type: 'glassPreviewResult',
                    id,
                    success: true,
                    base64: result.base64,
                    width: result.width,
                    height: result.height
                });
            } else {
                this.panel.webview.postMessage({
                    type: 'glassPreviewResult',
                    id,
                    success: false,
                    error: result.error || '预览生成失败'
                });
            }
        } catch (error: any) {
            this.panel.webview.postMessage({
                type: 'glassPreviewResult',
                id,
                success: false,
                error: error.message
            });
        }
    }

    public dispose(): void {
        ToolsPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
