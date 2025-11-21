import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/Logger';

/**
 * 项目配置加载器
 * 统一管理project.json的加载和解析
 */
export class ProjectConfigLoader {
    /**
     * 从指定路径加载项目配置
     * 支持从多个位置查找project.json文件
     */
    static loadConfig(filePath?: string): any {
        try {
            const configPaths = this.getConfigSearchPaths(filePath);
            
            for (const configPath of configPaths) {
                if (fs.existsSync(configPath)) {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configContent);
                    
                    logger.info(`成功加载项目配置文件: ${configPath}`);
                    logger.debug(`项目配置内容: ${JSON.stringify(config, null, 2)}`);
                    
                    return config;
                }
            }
            
            logger.debug(`未找到项目配置文件，搜索路径: ${configPaths.join(', ')}`);
            return null;
            
        } catch (error) {
            logger.error(`加载项目配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * 获取配置搜索路径列表（按优先级排序）
     */
    private static getConfigSearchPaths(filePath?: string): string[] {
        const paths: string[] = [];
        
        // 1. 如果提供了文件路径，优先从该文件所在目录查找
        if (filePath) {
            const hmlDir = path.dirname(filePath);
            paths.push(path.join(hmlDir, 'project.json'));
            
            // 2. 然后从项目根目录查找（上级目录）
            const projectRootDir = path.dirname(hmlDir);
            paths.push(path.join(projectRootDir, 'project.json'));
        }
        
        // 3. 从工作区根目录查找
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            paths.push(path.join(workspaceRoot, 'project.json'));
        }
        
        return paths;
    }

    /**
     * 获取设计器配置
     */
    static getDesignerConfig(config: any): any {
        return {
            canvasBackgroundColor: config?.designer?.canvasBackgroundColor || '#f0f0f0',
            gridSize: config?.designer?.gridSize || 10,
            showGrid: config?.designer?.showGrid !== false,
            snapToGrid: config?.designer?.snapToGrid !== false,
            ...config?.designer
        };
    }

    /**
     * 获取预览配置
     */
    static getPreviewConfig(config: any): any {
        return {
            runnerPath: config?.preview?.runnerPath || '',
            autoDownload: config?.preview?.autoDownload || false,
            timeoutMs: config?.preview?.timeoutMs || 10000,
            ...config?.preview
        };
    }
}