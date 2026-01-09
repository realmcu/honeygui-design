import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as MP4Box from 'mp4box';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';
import { FontMetricsAnalyzer } from './FontMetricsAnalyzer';

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
                const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
                const svgExts = ['.svg'];
                const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
                const modelExts = ['.gltf', '.glb', '.obj'];
                const modelDepExts = ['.mtl', '.bin'];  // 3D 模型依赖文件（不显示在资源栏）
                const fontExts = ['.ttf', '.otf', '.woff', '.woff2'];
                
                // 跳过 3D 模型依赖文件，不显示在资源栏
                if (modelDepExts.includes(ext)) {
                    continue;
                }
                
                let assetType: string | null = null;
                if (imageExts.includes(ext)) {
                    assetType = 'image';
                } else if (svgExts.includes(ext)) {
                    assetType = 'svg';
                } else if (videoExts.includes(ext)) {
                    assetType = 'video';
                } else if (modelExts.includes(ext)) {
                    assetType = 'model3d';
                } else if (fontExts.includes(ext)) {
                    assetType = 'font';
                }
                
                if (assetType) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(filePath));
                    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                    assets.push({
                        name: file,
                        path: webviewUri.toString(),
                        relativePath: relativePath,
                        type: assetType,
                        size: stats.size
                    });
                }
            }
        }
        
        return assets;
    }

    /**
     * 获取所有字体文件列表
     */
    public async handleGetFontFiles(currentFilePath: string | undefined): Promise<void> {
        try {
            if (!currentFilePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            const fontExts = ['.ttf', '.otf', '.woff', '.woff2'];
            const fonts: string[] = [];

            // 递归扫描字体文件
            const scanFonts = (dirPath: string, relativePath: string) => {
                if (!fs.existsSync(dirPath)) return;
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        scanFonts(filePath, relativePath ? `${relativePath}/${file}` : file);
                    } else {
                        const ext = path.extname(file).toLowerCase();
                        if (fontExts.includes(ext)) {
                            // 返回VFS路径格式
                            const vfsPath = relativePath ? `/${relativePath}/${file}` : `/${file}`;
                            fonts.push(vfsPath);
                        }
                    }
                }
            };

            scanFonts(assetsDir, '');

            this._panel.webview.postMessage({
                command: 'fontFilesLoaded',
                fonts
            });
        } catch (error) {
            logger.error(`获取字体文件列表失败: ${error}`);
        }
    }

    /**
     * 获取字体度量信息
     */
    public async handleGetFontMetrics(fontPath: string, currentFilePath: string | undefined): Promise<void> {
        try {
            if (!currentFilePath || !fontPath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                return;
            }

            const assetsDir = ProjectUtils.getAssetsDir(projectRoot);
            // 移除开头的斜杠，构建完整路径
            const cleanPath = fontPath.startsWith('/') ? fontPath.substring(1) : fontPath;
            const fullFontPath = path.join(assetsDir, cleanPath);

            // 分析字体度量
            const metrics = await FontMetricsAnalyzer.analyzeFontMetrics(fullFontPath);
            
            if (metrics) {
                const warningInfo = FontMetricsAnalyzer.getWarningInfo(metrics);
                
                this._panel.webview.postMessage({
                    command: 'fontMetricsLoaded',
                    fontPath,
                    metrics: {
                        needsWarning: warningInfo.needsWarning,
                        message: warningInfo.message,
                        example: warningInfo.example,
                        scaleFactor: metrics.scaleFactor,
                        suggestedMultiplier: metrics.suggestedMultiplier
                    }
                });
            }
        } catch (error) {
            logger.error(`获取字体度量信息失败: ${error}`);
        }
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
                const ext = path.extname(fileName).toLowerCase();
                
                // 检查是否是 3D 模型文件
                const is3DModel = ['.obj', '.gltf', '.glb'].includes(ext);
                
                if (is3DModel) {
                    // 删除 3D 模型及其配套文件
                    await this.delete3DModelWithDependencies(filePath, fileName, assetsDir);
                } else {
                    // 普通文件直接删除
                    logger.info(`[删除资源] 删除文件: ${filePath}, 相对路径: ${relativePath}`);
                    fs.unlinkSync(filePath);
                    
                    // 通知前端删除引用此资源的组件
                    this._panel.webview.postMessage({
                        command: 'deleteComponentsByImagePath',
                        imagePath: relativePath
                    });
                }
                
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
     * 删除 3D 模型及其依赖文件（MTL、贴图等）
     */
    private async delete3DModelWithDependencies(
        modelPath: string,
        fileName: string,
        assetsDir: string
    ): Promise<void> {
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, ext);
        const modelDir = path.dirname(modelPath);
        const deletedFiles: string[] = [];

        try {
            // 1. 先收集所有需要删除的文件（在删除之前）
            const filesToDelete: string[] = [modelPath];
            
            // 2. 如果是 OBJ 文件，收集 MTL 和贴图
            if (ext === '.obj') {
                const mtlPath = path.join(modelDir, `${baseName}.mtl`);
                if (fs.existsSync(mtlPath)) {
                    // 先解析 MTL 文件获取贴图列表
                    const textures = this.extractTexturesFromMtlFile(mtlPath);
                    
                    // 添加 MTL 文件到删除列表
                    filesToDelete.push(mtlPath);
                    
                    // 添加贴图文件到删除列表
                    for (const textureName of textures) {
                        const texturePath = path.join(modelDir, textureName);
                        if (fs.existsSync(texturePath)) {
                            filesToDelete.push(texturePath);
                        }
                    }
                }
            }
            
            // 3. 如果是 GLTF，收集关联的 .bin 文件和贴图
            else if (ext === '.gltf') {
                if (fs.existsSync(modelPath)) {
                    const gltfContent = fs.readFileSync(modelPath, 'utf-8');
                    const relatedFiles = this.extractGltfDependencies(gltfContent, modelDir);
                    
                    for (const relatedFile of relatedFiles) {
                        if (fs.existsSync(relatedFile)) {
                            filesToDelete.push(relatedFile);
                        }
                    }
                }
            }

            // 4. 执行删除操作
            for (const fileToDelete of filesToDelete) {
                if (fs.existsSync(fileToDelete)) {
                    logger.info(`[删除3D模型] 删除文件: ${fileToDelete}`);
                    fs.unlinkSync(fileToDelete);
                    
                    const relativeFilePath = path.relative(assetsDir, fileToDelete).replace(/\\/g, '/');
                    deletedFiles.push(relativeFilePath);
                }
            }

            // 5. 通知前端删除引用这些资源的组件
            for (const deletedFile of deletedFiles) {
                const relativePath = `assets/${deletedFile}`;
                this._panel.webview.postMessage({
                    command: 'deleteComponentsByImagePath',
                    imagePath: relativePath
                });
            }

            logger.info(`[删除3D模型] 共删除 ${deletedFiles.length} 个文件: ${deletedFiles.join(', ')}`);
            
        } catch (error) {
            logger.error(`[删除3D模型] 删除过程出错: ${error}`);
            throw error;
        }
    }

    /**
     * 从 MTL 文件中提取贴图文件名
     */
    private extractTexturesFromMtlFile(mtlPath: string): string[] {
        try {
            const mtlContent = fs.readFileSync(mtlPath, 'utf-8');
            const textures = new Set<string>();
            const lines = mtlContent.split('\n');
            
            // 支持常见的贴图类型
            const mapTypes = ['map_Kd', 'map_Ka', 'map_Ks', 'map_Ns', 'map_d', 'map_bump', 'bump'];
            
            for (const line of lines) {
                const trimmed = line.trim();
                for (const mapType of mapTypes) {
                    if (trimmed.startsWith(mapType + ' ')) {
                        const texturePath = trimmed.substring(mapType.length + 1).trim();
                        // 移除可能的选项参数（如 -blendu on）
                        const parts = texturePath.split(/\s+/);
                        const filename = parts[parts.length - 1];
                        if (filename && !filename.startsWith('-')) {
                            textures.add(filename);
                        }
                    }
                }
            }
            
            return Array.from(textures);
        } catch (error) {
            logger.error(`[删除3D模型] 解析 MTL 文件失败: ${error}`);
            return [];
        }
    }

    /**
     * 从 GLTF 文件中提取依赖文件路径
     */
    private extractGltfDependencies(gltfContent: string, modelDir: string): string[] {
        try {
            const gltf = JSON.parse(gltfContent);
            const dependencies: string[] = [];
            
            // 提取 .bin 文件
            if (gltf.buffers) {
                for (const buffer of gltf.buffers) {
                    if (buffer.uri && !buffer.uri.startsWith('data:')) {
                        dependencies.push(path.join(modelDir, buffer.uri));
                    }
                }
            }
            
            // 提取贴图文件
            if (gltf.images) {
                for (const image of gltf.images) {
                    if (image.uri && !image.uri.startsWith('data:')) {
                        dependencies.push(path.join(modelDir, image.uri));
                    }
                }
            }
            
            return dependencies;
        } catch (error) {
            logger.error(`[删除3D模型] 解析 GLTF 文件失败: ${error}`);
            return [];
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
        relativePath?: string,
        componentId?: string
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
            } else if (componentId) {
                // 如果提供了 componentId，则更新现有组件的图片路径
                this._panel.webview.postMessage({
                    command: 'updateImagePath',
                    componentId: componentId,
                    path: hmlRelativePath
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
                const fileName = path.basename(filePath);
                
                if (!currentFilePath) {
                    vscode.window.showErrorMessage('无法确定项目路径');
                    return;
                }

                const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
                if (!projectRoot) {
                    vscode.window.showErrorMessage('无法找到项目根目录');
                    return;
                }

                const assetsDir = path.join(projectRoot, 'assets');
                const targetPath = path.join(assetsDir, fileName);

                // 复制文件到 assets 目录
                await fs.promises.copyFile(filePath, targetPath);
                
                // 发送相对路径到webview
                const relativePath = `assets/${fileName}`;
                this._panel.webview.postMessage({
                    command: 'updateImagePath',
                    componentId: componentId,
                    path: relativePath
                });
                
                logger.info(`[AssetManager] 图片已复制到: ${relativePath}`);
            }
        } catch (error) {
            logger.error(`[AssetManager] 选择图片失败: ${error}`);
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
     * 处理创建3D组件请求
     */
    public handleCreate3DComponent(
        modelPath: string,
        dropPosition: { x: number; y: number },
        targetContainerId: string,
        currentFilePath: string | undefined
    ): void {
        try {
            if (!currentFilePath) {
                return;
            }

            this._panel.webview.postMessage({
                command: 'create3DComponent',
                modelPath,
                dropPosition,
                targetContainerId
            });
        } catch (error) {
            logger.error(`[AssetManager] 创建3D组件失败: ${error}`);
        }
    }

    /**
     * 处理获取视频尺寸请求
     */
    public async handleGetVideoSize(
        videoPath: string,
        dropPosition: { x: number; y: number },
        targetContainerId: string,
        currentFilePath: string | undefined
    ): Promise<void> {
        try {
            if (!currentFilePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                return;
            }

            const absolutePath = path.join(projectRoot, videoPath);
            const videoSize = await this.getVideoSizeAsync(absolutePath);

            this._panel.webview.postMessage({
                command: 'createVideoComponent',
                videoPath,
                dropPosition,
                targetContainerId,
                videoSize
            });
        } catch (error) {
            logger.error(`[AssetManager] 获取视频尺寸失败: ${error}`);
        }
    }

    /**
     * 处理属性面板获取视频尺寸请求
     */
    public async handleGetVideoSizeForProperty(
        videoPath: string,
        componentId: string,
        currentFilePath: string | undefined
    ): Promise<void> {
        try {
            if (!currentFilePath) {
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                return;
            }

            const absolutePath = path.join(projectRoot, videoPath);
            const videoSize = await this.getVideoSizeAsync(absolutePath);

            this._panel.webview.postMessage({
                command: 'updateVideoSize',
                componentId,
                videoSize
            });
        } catch (error) {
            logger.error(`[AssetManager] 获取视频尺寸失败: ${error}`);
        }
    }

    /**
     * 处理创建视频组件请求（已废弃，使用 handleGetVideoSize）
     */
    public handleCreateVideoComponent(
        videoPath: string,
        dropPosition: { x: number; y: number },
        targetContainerId: string,
        currentFilePath: string | undefined
    ): void {
        try {
            if (!currentFilePath) {
                return;
            }

            this._panel.webview.postMessage({
                command: 'createVideoComponent',
                videoPath,
                dropPosition,
                targetContainerId
            });
        } catch (error) {
            logger.error(`[AssetManager] 创建视频组件失败: ${error}`);
        }
    }

    /**
     * 处理创建 SVG 组件请求
     */
    public handleCreateSvgComponent(
        svgPath: string,
        dropPosition: { x: number; y: number },
        targetContainerId: string,
        currentFilePath: string | undefined
    ): void {
        try {
            if (!currentFilePath) {
                return;
            }

            // 获取 SVG 尺寸
            const projectRoot = path.dirname(path.dirname(currentFilePath));
            const fullPath = path.join(projectRoot, svgPath);
            const size = this.getSvgSize(fullPath);

            this._panel.webview.postMessage({
                command: 'createSvgComponent',
                svgPath,
                dropPosition,
                targetContainerId,
                size
            });
        } catch (error) {
            logger.error(`[AssetManager] 创建 SVG 组件失败: ${error}`);
        }
    }

    /**
     * 获取 SVG 尺寸
     */
    private getSvgSize(filePath: string): { width: number; height: number } {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // 匹配 width 和 height 属性
            const widthMatch = content.match(/width\s*=\s*["']?(\d+)/);
            const heightMatch = content.match(/height\s*=\s*["']?(\d+)/);
            
            const width = widthMatch ? parseInt(widthMatch[1], 10) : 100;
            const height = heightMatch ? parseInt(heightMatch[1], 10) : 100;
            
            return { width, height };
        } catch (error) {
            return { width: 100, height: 100 };
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
     * 获取视频尺寸（异步）
     */
    private async getVideoSizeAsync(filePath: string): Promise<{ width: number; height: number }> {
        try {
            // 检查文件扩展名
            const ext = path.extname(filePath).toLowerCase();
            
            // 只处理 MP4 格式
            if (ext !== '.mp4') {
                logger.info(`[AssetManager] 非 MP4 格式视频，使用默认尺寸: ${ext}`);
                return { width: 320, height: 240 };
            }

            // 读取文件
            const buffer = fs.readFileSync(filePath);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            // 创建 MP4Box 文件对象
            const mp4boxfile = MP4Box.createFile();
            
            return new Promise((resolve) => {
                let resolved = false;

                // 设置回调
                mp4boxfile.onReady = (info: any) => {
                    if (!resolved) {
                        resolved = true;
                        if (info.videoTracks && info.videoTracks.length > 0) {
                            const track = info.videoTracks[0];
                            resolve({
                                width: track.track_width || 320,
                                height: track.track_height || 240
                            });
                        } else {
                            resolve({ width: 320, height: 240 });
                        }
                    }
                };

                mp4boxfile.onError = (e: any) => {
                    if (!resolved) {
                        resolved = true;
                        logger.warn(`[AssetManager] MP4Box 解析失败: ${e}`);
                        resolve({ width: 320, height: 240 });
                    }
                };

                // 添加 buffer（需要添加 fileStart 属性）
                const mp4Buffer = arrayBuffer as any;
                mp4Buffer.fileStart = 0;
                mp4boxfile.appendBuffer(mp4Buffer);
                mp4boxfile.flush();

                // 超时保护
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        logger.warn(`[AssetManager] MP4Box 解析超时`);
                        resolve({ width: 320, height: 240 });
                    }
                }, 3000);
            });
        } catch (error) {
            logger.warn(`[AssetManager] 读取视频尺寸失败: ${error}`);
            return { width: 320, height: 240 };
        }
    }

    /**
     * 获取视频尺寸（同步版本，用于兼容）
     */
    private getVideoSize(filePath: string): { width: number; height: number } {
        try {
            // 检查文件扩展名
            const ext = path.extname(filePath).toLowerCase();
            
            // 只处理 MP4 格式
            if (ext !== '.mp4') {
                logger.info(`[AssetManager] 非 MP4 格式视频，使用默认尺寸: ${ext}`);
                return { width: 320, height: 240 };
            }

            // 读取文件
            const buffer = fs.readFileSync(filePath);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            // 创建 MP4Box 文件对象
            const mp4boxfile = MP4Box.createFile();
            
            let videoSize = { width: 320, height: 240 };

            // 设置回调
            mp4boxfile.onReady = (info: any) => {
                if (info.videoTracks && info.videoTracks.length > 0) {
                    const track = info.videoTracks[0];
                    videoSize = {
                        width: track.track_width || 320,
                        height: track.track_height || 240
                    };
                }
            };

            mp4boxfile.onError = (e: any) => {
                logger.warn(`[AssetManager] MP4Box 解析失败: ${e}`);
            };

            // 添加 buffer（需要添加 fileStart 属性）
            const mp4Buffer = arrayBuffer as any;
            mp4Buffer.fileStart = 0;
            mp4boxfile.appendBuffer(mp4Buffer);
            mp4boxfile.flush();

            return videoSize;
        } catch (error) {
            logger.warn(`[AssetManager] 读取视频尺寸失败: ${error}`);
            return { width: 320, height: 240 };
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

    /**
     * 检测字体是否支持指定文本中的所有字符
     * 通过解析 TTF/OTF 文件的 cmap 表获取支持的字符集
     */
    public async handleCheckFontGlyphs(
        fontPath: string,
        text: string,
        requestId: string,
        currentFilePath: string | undefined
    ): Promise<void> {
        try {
            if (!currentFilePath || !fontPath || !text) {
                this._panel.webview.postMessage({
                    command: 'fontGlyphCheckResult',
                    requestId,
                    supported: true,
                    missingChars: []
                });
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                this._panel.webview.postMessage({
                    command: 'fontGlyphCheckResult',
                    requestId,
                    supported: true,
                    missingChars: []
                });
                return;
            }

            // fontPath 格式为 /font/xxx.ttf，需要转换为 assets/font/xxx.ttf
            const absolutePath = path.join(projectRoot, 'assets', fontPath.replace(/^\//, ''));
            
            if (!fs.existsSync(absolutePath)) {
                logger.warn(`[字形检测] 字体文件不存在: ${absolutePath}`);
                this._panel.webview.postMessage({
                    command: 'fontGlyphCheckResult',
                    requestId,
                    supported: true,
                    missingChars: []
                });
                return;
            }

            // 解析字体文件获取支持的字符集
            const supportedChars = this.parseFontCmap(absolutePath);
            
            // 检测文本中哪些字符不被支持
            const uniqueChars = [...new Set(text)];
            const missingChars: string[] = [];
            
            for (const char of uniqueChars) {
                // 跳过空白字符
                if (/\s/.test(char)) continue;
                
                const codePoint = char.codePointAt(0);
                if (codePoint !== undefined && !supportedChars.has(codePoint)) {
                    missingChars.push(char);
                }
            }

            this._panel.webview.postMessage({
                command: 'fontGlyphCheckResult',
                requestId,
                supported: missingChars.length === 0,
                missingChars
            });
        } catch (error) {
            logger.error(`[字形检测] 检测失败: ${error}`);
            this._panel.webview.postMessage({
                command: 'fontGlyphCheckResult',
                requestId,
                supported: true,
                missingChars: []
            });
        }
    }

    /**
     * 解析 TTF/OTF 字体文件的 cmap 表，获取支持的字符码点集合
     */
    private parseFontCmap(fontPath: string): Set<number> {
        const supportedChars = new Set<number>();
        
        try {
            const buffer = fs.readFileSync(fontPath);
            
            // 读取字体文件头
            const sfntVersion = buffer.readUInt32BE(0);
            // 0x00010000 = TrueType, 0x4F54544F = 'OTTO' (OpenType with CFF)
            if (sfntVersion !== 0x00010000 && sfntVersion !== 0x4F54544F) {
                logger.warn(`[字形检测] 不支持的字体格式: ${sfntVersion.toString(16)}`);
                return supportedChars;
            }

            const numTables = buffer.readUInt16BE(4);
            
            // 查找 cmap 表
            let cmapOffset = 0;
            for (let i = 0; i < numTables; i++) {
                const tableOffset = 12 + i * 16;
                const tag = buffer.toString('ascii', tableOffset, tableOffset + 4);
                if (tag === 'cmap') {
                    cmapOffset = buffer.readUInt32BE(tableOffset + 8);
                    break;
                }
            }

            if (cmapOffset === 0) {
                logger.warn(`[字形检测] 未找到 cmap 表`);
                return supportedChars;
            }

            // 解析 cmap 表
            const cmapVersion = buffer.readUInt16BE(cmapOffset);
            const numSubtables = buffer.readUInt16BE(cmapOffset + 2);

            // 查找最佳的子表（优先 Unicode BMP 或 Full Unicode）
            let bestSubtableOffset = 0;
            let bestPriority = -1;

            for (let i = 0; i < numSubtables; i++) {
                const subtableOffset = cmapOffset + 4 + i * 8;
                const platformID = buffer.readUInt16BE(subtableOffset);
                const encodingID = buffer.readUInt16BE(subtableOffset + 2);
                const offset = buffer.readUInt32BE(subtableOffset + 4);

                // 优先级：Unicode Full (0,4) > Unicode BMP (0,3) > Windows Unicode BMP (3,1) > Windows Unicode Full (3,10)
                let priority = -1;
                if (platformID === 0 && encodingID === 4) priority = 4; // Unicode Full
                else if (platformID === 0 && encodingID === 3) priority = 3; // Unicode BMP
                else if (platformID === 3 && encodingID === 10) priority = 2; // Windows Unicode Full
                else if (platformID === 3 && encodingID === 1) priority = 1; // Windows Unicode BMP

                if (priority > bestPriority) {
                    bestPriority = priority;
                    bestSubtableOffset = cmapOffset + offset;
                }
            }

            if (bestSubtableOffset === 0) {
                logger.warn(`[字形检测] 未找到合适的 cmap 子表`);
                return supportedChars;
            }

            // 解析子表
            const format = buffer.readUInt16BE(bestSubtableOffset);
            
            if (format === 4) {
                // Format 4: Segment mapping to delta values (BMP only)
                this.parseCmapFormat4(buffer, bestSubtableOffset, supportedChars);
            } else if (format === 12) {
                // Format 12: Segmented coverage (Full Unicode)
                this.parseCmapFormat12(buffer, bestSubtableOffset, supportedChars);
            } else {
                logger.warn(`[字形检测] 不支持的 cmap 格式: ${format}`);
            }

        } catch (error) {
            logger.error(`[字形检测] 解析字体文件失败: ${error}`);
        }

        return supportedChars;
    }

    /**
     * 解析 cmap Format 4 子表（BMP 字符）
     */
    private parseCmapFormat4(buffer: Buffer, offset: number, supportedChars: Set<number>): void {
        const segCountX2 = buffer.readUInt16BE(offset + 6);
        const segCount = segCountX2 / 2;

        const endCodeOffset = offset + 14;
        const startCodeOffset = endCodeOffset + segCountX2 + 2; // +2 for reservedPad
        const idDeltaOffset = startCodeOffset + segCountX2;
        const idRangeOffsetOffset = idDeltaOffset + segCountX2;

        for (let i = 0; i < segCount; i++) {
            const endCode = buffer.readUInt16BE(endCodeOffset + i * 2);
            const startCode = buffer.readUInt16BE(startCodeOffset + i * 2);
            const idDelta = buffer.readInt16BE(idDeltaOffset + i * 2);
            const idRangeOffset = buffer.readUInt16BE(idRangeOffsetOffset + i * 2);

            if (startCode === 0xFFFF) break;

            for (let charCode = startCode; charCode <= endCode; charCode++) {
                let glyphIndex: number;
                
                if (idRangeOffset === 0) {
                    glyphIndex = (charCode + idDelta) & 0xFFFF;
                } else {
                    const glyphIndexOffset = idRangeOffsetOffset + i * 2 + idRangeOffset + (charCode - startCode) * 2;
                    glyphIndex = buffer.readUInt16BE(glyphIndexOffset);
                    if (glyphIndex !== 0) {
                        glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
                    }
                }

                if (glyphIndex !== 0) {
                    supportedChars.add(charCode);
                }
            }
        }
    }

    /**
     * 解析 cmap Format 12 子表（Full Unicode）
     */
    private parseCmapFormat12(buffer: Buffer, offset: number, supportedChars: Set<number>): void {
        const numGroups = buffer.readUInt32BE(offset + 12);

        for (let i = 0; i < numGroups; i++) {
            const groupOffset = offset + 16 + i * 12;
            const startCharCode = buffer.readUInt32BE(groupOffset);
            const endCharCode = buffer.readUInt32BE(groupOffset + 4);
            const startGlyphID = buffer.readUInt32BE(groupOffset + 8);

            for (let charCode = startCharCode; charCode <= endCharCode; charCode++) {
                const glyphID = startGlyphID + (charCode - startCharCode);
                if (glyphID !== 0) {
                    supportedChars.add(charCode);
                }
            }
        }
    }
}
