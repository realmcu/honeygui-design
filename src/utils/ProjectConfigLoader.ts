import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ProjectConfig, DEFAULT_PROJECT_CONFIG } from '../common/ProjectConfig';

// Re-export for backward compatibility
export { ProjectConfig } from '../common/ProjectConfig';

/**
 * 项目配置加载器
 * 统一管理project.json的加载和解析
 * 采用单例模式，提供缓存和异步IO支持
 */
export class ProjectConfigLoader {
    private static _cache: Map<string, ProjectConfig> = new Map();

    /**
     * 从指定路径加载项目配置（异步版本，推荐）
     * 支持从多个位置查找project.json文件
     */
    static async loadConfigAsync(filePath?: string): Promise<ProjectConfig | null> {
        try {
            const configPaths = this.getConfigSearchPaths(filePath);

            logger.debug(`开始搜索项目配置文件，搜索路径优先级: [${configPaths.join('] > [')}]`);

            for (let i = 0; i < configPaths.length; i++) {
                const configPath = configPaths[i];
                logger.debug(`[${i + 1}/${configPaths.length}] 检查路径: ${configPath}`);

                // 检查缓存
                if (this._cache.has(configPath)) {
                    logger.debug(`[${i + 1}/${configPaths.length}] 从缓存加载: ${configPath}`);
                    return this._cache.get(configPath)!;
                }

                // 检查文件是否存在（异步）
                try {
                    await fs.promises.access(configPath, fs.constants.F_OK);
                    logger.info(`✓ 找到项目配置文件: ${configPath}`);

                    // 读取并解析配置文件（异步）
                    const configContent = await fs.promises.readFile(configPath, 'utf8');
                    const config = JSON.parse(configContent);

                    // 基本类型校验
                    if (!this.validateConfig(config)) {
                        logger.warn(`[${i + 1}/${configPaths.length}] 配置文件格式警告: ${configPath}`);
                    }

                    logger.info(`成功加载项目配置: ${configPath}`);
                    logger.debug(`项目配置内容: ${JSON.stringify(config, null, 2)}`);

                    // 存入缓存
                    this._cache.set(configPath, config);

                    return config;
                } catch (err) {
                    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                        logger.debug(`✗ 配置文件不存在: ${configPath}`);
                    } else {
                        logger.error(`配置文件解析失败 ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
                    }
                    // 继续尝试下一个配置文件
                }
            }

            logger.warn(`未找到项目配置文件，已搜索 ${configPaths.length} 个路径`);
            return null;

        } catch (error) {
            logger.error(`加载项目配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * 从指定路径加载项目配置（同步版本，兼容旧代码）
     * @deprecated 推荐使用 loadConfigAsync
     */
    static loadConfig(filePath?: string): ProjectConfig | null {
        try {
            const configPaths = this.getConfigSearchPaths(filePath);

            logger.debug(`开始搜索项目配置文件（同步），搜索路径: [${configPaths.join('] > [')}]`);

            for (let i = 0; i < configPaths.length; i++) {
                const configPath = configPaths[i];

                // 检查缓存
                if (this._cache.has(configPath)) {
                    logger.debug(`[${i + 1}/${configPaths.length}] 从缓存加载: ${configPath}`);
                    return this._cache.get(configPath)!;
                }

                if (fs.existsSync(configPath)) {
                    logger.info(`✓ 找到项目配置文件: ${configPath}`);

                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configContent);

                    // 基本类型校验
                    if (!this.validateConfig(config)) {
                        logger.warn(`[${i + 1}/${configPaths.length}] 配置文件格式警告: ${configPath}`);
                    }

                    logger.info(`成功加载项目配置: ${configPath}`);
                    logger.debug(`项目配置内容: ${JSON.stringify(config, null, 2)}`);

                    // 存入缓存
                    this._cache.set(configPath, config);

                    return config;
                } else {
                    logger.debug(`✗ 配置文件不存在: ${configPath}`);
                }
            }

            logger.warn(`未找到项目配置文件，已搜索 ${configPaths.length} 个路径`);
            return null;

        } catch (error) {
            logger.error(`加载项目配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * 验证配置对象的基本结构和类型
     */
    private static validateConfig(config: any): config is ProjectConfig {
        if (!config || typeof config !== 'object') {
            logger.warn('配置格式错误：配置必须是对象');
            return false;
        }

        // 检查必要的字段（根据项目需求调整）
        if (config.designer && typeof config.designer !== 'object') {
            logger.warn('配置格式错误：designer 必须是对象');
            return false;
        }

        if (config.preview && typeof config.preview !== 'object') {
            logger.warn('配置格式错误：preview 必须是对象');
            return false;
        }

        if (config.author && typeof config.author !== 'object') {
            logger.warn('配置格式错误：author 必须是对象');
            return false;
        }

        return true;
    }

    /**
     * 获取配置搜索路径列表（按优先级排序）
     * 优先级从高到低：
     * 1. 当前HML文件所在目录
     * 2. 项目根目录（ui目录的父目录）
     * 3. 工作区根目录
     */
    private static getConfigSearchPaths(filePath?: string): string[] {
        const paths: string[] = [];
        const seen = new Set<string>(); // 用于去重

        // 1. 如果提供了文件路径，优先从该文件所在目录查找
        if (filePath) {
            const hmlDir = path.dirname(filePath);
            const hmlDirConfig = path.join(hmlDir, 'project.json');
            paths.push(hmlDirConfig);
            seen.add(hmlDirConfig);

            // 2. 然后从项目根目录查找（上级目录）
            const projectRootDir = path.dirname(hmlDir);
            const projectRootConfig = path.join(projectRootDir, 'project.json');
            if (!seen.has(projectRootConfig)) {
                paths.push(projectRootConfig);
                seen.add(projectRootConfig);
            }
        }

        // 3. 从工作区根目录查找
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const workspaceConfig = path.join(workspaceRoot, 'project.json');
            if (!seen.has(workspaceConfig)) {
                paths.push(workspaceConfig);
                // 如果当前打开的是工作区根目录，这里会重复，但我们已经去重了
            }
        }

        if (paths.length === 0) {
            logger.warn('没有可用的配置搜索路径，可能未打开工作区');
        }

        return paths;
    }

    /**
     * 获取设计器配置
     */
    static getDesignerConfig(config: ProjectConfig | null): Partial<ProjectConfig['designer']> {
        if (!config) {
            return {
                canvasBackgroundColor: '#f0f0f0',
                gridSize: 10,
                showGrid: true,
                snapToGrid: true
            };
        }

        return {
            canvasBackgroundColor: config.designer?.canvasBackgroundColor || '#f0f0f0',
            gridSize: config.designer?.gridSize || 10,
            showGrid: config.designer?.showGrid !== false,
            snapToGrid: config.designer?.snapToGrid !== false,
            ...config.designer
        };
    }

    /**
     * 获取预览配置
     */
    static getPreviewConfig(config: ProjectConfig | null): Partial<ProjectConfig['preview']> {
        if (!config) {
            return {
                runnerPath: '',
                autoDownload: false,
                timeoutMs: 10000
            };
        }

        return {
            runnerPath: config.preview?.runnerPath || '',
            autoDownload: config.preview?.autoDownload || false,
            timeoutMs: config.preview?.timeoutMs || 10000,
            ...config.preview
        };
    }

    /**
     * 清理缓存
     */
    static clearCache(): void {
        const cacheSize = this._cache.size;
        this._cache.clear();
        logger.info(`ProjectConfigLoader 缓存已清理，移除 ${cacheSize} 个条目`);
    }

    /**
     * 获取缓存统计
     */
    static getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this._cache.size,
            entries: Array.from(this._cache.keys())
        };
    }
}