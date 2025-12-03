import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * 资源管理器 - 处理资源文件的扫描、添加、删除等操作
 */
export class AssetManager {
    private readonly _panel: vscode.WebviewPanel;

    constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
    }

    /**
     * 加载资源文件列表
     */
    public async handleLoadAssets(currentFilePath: string | undefined): Promise<void> {
        try {
            if (!currentFilePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                logger.warn('[Assets] 未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 递归扫描assets目录
            const assets = this.scanAssetsDirectory(assetsDir, assetsDir);

            // 发送资源列表到webview
            this._panel.webview.postMessage({
                command: 'assetsLoaded',
                assets
            });
        } catch (error) {
            logger.error(`加载资源列表失败: ${error}`);
        }
    }

    /**
     * 递归扫描资源目录
     */
    private scanAssetsDirectory(dirPath: string, rootPath: string): any[] {
        const assets: any[] = [];
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
                // 递归扫描子目录
                const children = this.scanAssetsDirectory(filePath, rootPath);
                if (children.length > 0) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(filePath));
                    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                    assets.push({
                        name: file,
                        path: webviewUri.toString(),
                        relativePath: relativePath,
                        type: 'folder',
                        size: 0,
                        children
                    });
                }
            } else if (stats.isFile()) {
                const ext = path.extname(file).toLowerCase();
                const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
                
                if (imageExts.includes(ext)) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(filePath));
                    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                    assets.push({
                        name: file,
                        path: webviewUri.toString(),
                        relativePath: relativePath,
                        type: 'image',
                        size: stats.size
                    });
                }
            }
        }
        
        return assets;
    }

    /**
     * 删除资源文件
     */
    public async handleDeleteAsset(fileName: string, currentFilePath: string | undefined): Promise<void> {
        try {
            logger.info(`[删除资源] 收到删除请求: ${fileName}`);
            
            if (!currentFilePath) {
                logger.error('[删除资源] 文件路径未初始化');
                return;
            }
            
            // 构建完整的文件路径
            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                logger.error('[删除资源] 无法找到项目根目录');
                return;
            }
            
            const assetsDir = path.join(projectRoot, 'assets');
            const filePath = path.join(assetsDir, fileName);
            
            logger.info(`[删除资源] 完整路径: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
                const relativePath = `assets/${fileName}`;
                
                logger.info(`[删除资源] 删除文件: ${filePath}, 相对路径: ${relativePath}`);
                
                // 删除文件
                fs.unlinkSync(filePath);
                
                // 通知前端删除引用此资源的组件
                this._panel.webview.postMessage({
                    command: 'deleteComponentsByImagePath',
                    imagePath: relativePath
                });
                
                vscode.window.showInformationMessage('资源文件已删除');
                // 重新加载资源列表
                this.handleLoadAssets(currentFilePath);
            } else {
                logger.warn(`[删除资源] 文件不存在: ${filePath}`);
                vscode.window.showErrorMessage('资源文件不存在');
            }
        } catch (error) {
            logger.error(`删除资源文件失败: ${error}`);
            vscode.window.showErrorMessage('删除资源文件失败');
        }
    }

    /**
     * 重命名资源文件
     */
    public async handleRenameAsset(oldPath: string, newName: string, currentFilePath: string | undefined): Promise<void> {
        try {
            const dir = path.dirname(oldPath);
            const newPath = path.join(dir, newName);
            
            if (fs.existsSync(newPath)) {
                vscode.window.showErrorMessage('文件名已存在');
                return;
            }
            
            fs.renameSync(oldPath, newPath);
            vscode.window.showInformationMessage('资源文件已重命名');
            // 重新加载资源列表
            this.handleLoadAssets(currentFilePath);
        } catch (error) {
            logger.error(`重命名资源文件失败: ${error}`);
            vscode.window.showErrorMessage('重命名资源文件失败');
        }
    }

    /**
     * 打开assets文件夹
     */
    public async handleOpenAssetsFolder(currentFilePath: string | undefined): Promise<void> {
        try {
            if (!currentFilePath) {
                vscode.window.showErrorMessage('请先保存设计稿');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 在系统文件管理器中打开
            const uri = vscode.Uri.file(assetsDir);
            await vscode.commands.executeCommand('revealFileInOS', uri);
        } catch (error) {
            logger.error(`打开assets文件夹失败: ${error}`);
            vscode.window.showErrorMessage('打开assets文件夹失败');
        }
    }

    /**
     * 保存图片到assets目录并可选创建图片控件
     */
    public async handleSaveImageToAssets(
        fileName: string,
        fileData: number[],
        currentFilePath: string | undefined,
        dropPosition?: { x: number; y: number },
        targetContainerId?: string,
        relativePath?: string
    ): Promise<void> {
        try {
            if (!currentFilePath) {
                vscode.window.showErrorMessage('请先保存设计稿');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            
            // 确保assets目录存在
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // 构建完整路径（支持子文件夹）
            let targetDir = assetsDir;
            let assetRelativePath = fileName;
            
            if (relativePath) {
                targetDir = path.join(assetsDir, relativePath);
                // 确保子目录存在
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                assetRelativePath = `${relativePath}/${fileName}`;
            }

            // 保存文件
            const filePath = path.join(targetDir, fileName);
            const buffer = Buffer.from(fileData);
            fs.writeFileSync(filePath, buffer);

            // 计算相对路径（保存到 HML 文件）
            const hmlRelativePath = `assets/${assetRelativePath}`;

            // 如果提供了位置和容器ID，则创建图片控件
            if (dropPosition && targetContainerId) {
                const imageSize = this.getImageSize(filePath);
                
                this._panel.webview.postMessage({
                    command: 'createImageComponent',
                    imagePath: hmlRelativePath,
                    dropPosition,
                    targetContainerId,
                    imageSize
                });
            }

            // 重新加载资源列表
            this.handleLoadAssets(currentFilePath);

            vscode.window.showInformationMessage(`图片已保存到 ${hmlRelativePath}`);
        } catch (error) {
            logger.error(`保存图片到assets失败: ${error}`);
            vscode.window.showErrorMessage('保存图片失败');
        }
    }
    
    /**
     * 处理选择图片路径
     */
    public async handleSelectImagePath(componentId: string, currentFilePath: string | undefined): Promise<void> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp']
                },
                openLabel: '选择图片'
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri.length > 0) {
                const filePath = fileUri[0].fsPath;
                
                let relativePath = filePath;
                let rootPath: string | undefined;

                // 尝试使用项目根目录
                if (currentFilePath) {
                    rootPath = ProjectUtils.findProjectRoot(currentFilePath);
                }

                // 如果没找到项目根目录，使用工作区目录
                if (!rootPath && vscode.workspace.workspaceFolders?.[0]) {
                    rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                }
                
                if (rootPath) {
                    // 转换为相对路径
                    relativePath = path.relative(rootPath, filePath);
                    // 统一使用正斜杠
                    relativePath = relativePath.replace(/\\/g, '/');
                }
                
                // 发送路径到webview
                this._panel.webview.postMessage({
                    command: 'updateImagePath',
                    componentId: componentId,
                    path: relativePath
                });
                
                logger.info(`[DesignerPanel] 选择图片路径: ${relativePath}`);
            }
        } catch (error) {
            logger.error(`[DesignerPanel] 选择图片路径失败: ${error}`);
            vscode.window.showErrorMessage('选择图片失败');
        }
    }

    /**
     * 处理获取图片尺寸请求
     */
    public handleGetImageSize(
        imagePath: string,
        dropPosition: { x: number; y: number },
        targetContainerId: string,
        currentFilePath: string | undefined
    ): void {
        try {
            if (!currentFilePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                return;
            }

            const absolutePath = path.join(projectRoot, imagePath);
            const imageSize = this.getImageSize(absolutePath);

            this._panel.webview.postMessage({
                command: 'createImageComponent',
                imagePath,
                dropPosition,
                targetContainerId,
                imageSize
            });
        } catch (error) {
            logger.error(`[AssetManager] 获取图片尺寸失败: ${error}`);
        }
    }

    /**
     * 获取图片尺寸
     */
    private getImageSize(filePath: string): { width: number; height: number } {
        try {
            const buffer = fs.readFileSync(filePath);
            
            // PNG
            if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                return { width, height };
            }
            
            // JPEG
            if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                let offset = 2;
                while (offset < buffer.length) {
                    if (buffer[offset] !== 0xFF) break;
                    const marker = buffer[offset + 1];
                    if (marker === 0xC0 || marker === 0xC2) {
                        const height = buffer.readUInt16BE(offset + 5);
                        const width = buffer.readUInt16BE(offset + 7);
                        return { width, height };
                    }
                    offset += 2 + buffer.readUInt16BE(offset + 2);
                }
            }
            
            // BMP
            if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
                const width = buffer.readInt32LE(18);
                const height = Math.abs(buffer.readInt32LE(22)); // 高度可能为负（表示自上而下）
                return { width, height };
            }
            
            // GIF
            if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
                const width = buffer.readUInt16LE(6);
                const height = buffer.readUInt16LE(8);
                return { width, height };
            }
            
            return { width: 100, height: 100 };
        } catch (error) {
            logger.error(`[AssetManager] 读取图片尺寸失败: ${error}`);
            return { width: 100, height: 100 };
        }
    }

    /**
     * 处理转换路径为 webview URI 的请求
     */
    public handleConvertPathToWebviewUri(relativePath: string, requestId: string, currentFilePath: string | undefined): void {
        try {
            if (!currentFilePath) {
                this._panel.webview.postMessage({
                    command: 'webviewUriConverted',
                    requestId,
                    uri: relativePath,
                    error: '没有文件路径'
                });
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                this._panel.webview.postMessage({
                    command: 'webviewUriConverted',
                    requestId,
                    uri: relativePath,
                    error: '未找到项目根目录'
                });
                return;
            }

            // 转换相对路径为绝对路径
            const absolutePath = path.join(projectRoot, relativePath);
            const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));

            this._panel.webview.postMessage({
                command: 'webviewUriConverted',
                requestId,
                uri: webviewUri.toString()
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'webviewUriConverted',
                requestId,
                uri: relativePath,
                error: error instanceof Error ? error.message : '转换失败'
            });
        }
    }
}
