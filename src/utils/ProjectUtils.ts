import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectConfig, DEFAULT_PROJECT_CONFIG } from '../common/ProjectConfig';
import { logger } from './Logger';

/**
 * 项目工具类
 */
export class ProjectUtils {
    /**
     * 获取默认 SDK 路径
     */
    /**
     * 从文件路径向上查找项目根目录（包含project.json的目录）
     * @param filePath 文件路径
     * @returns 项目根目录，如果未找到返回undefined
     */
    static findProjectRoot(filePath: string): string | undefined {
        // 如果传入的是目录且包含 project.json，直接返回
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            if (fs.existsSync(path.join(filePath, 'project.json'))) {
                return filePath;
            }
        }

        let dir = path.dirname(filePath);
        
        // 向上查找，直到找到包含project.json的目录
        while (dir !== path.dirname(dir)) { // 没到根目录
            const projectJsonPath = path.join(dir, 'project.json');
            if (fs.existsSync(projectJsonPath)) {
                return dir;
            }
            dir = path.dirname(dir);
        }
        
        return undefined;
    }

    /**
     * 读取项目配置
     * @param projectRoot 项目根目录
     * @returns 项目配置，如果读取失败返回默认配置
     */
    static loadProjectConfig(projectRoot: string): ProjectConfig {
        const projectJsonPath = path.join(projectRoot, 'project.json');
        
        try {
            const content = fs.readFileSync(projectJsonPath, 'utf-8');
            const config = JSON.parse(content) as ProjectConfig;
            
            // 合并默认配置
            return {
                ...DEFAULT_PROJECT_CONFIG,
                ...config
            } as ProjectConfig;
        } catch (error) {
            logger.error(`读取项目配置失败: ${error}`);
            return {
                name: path.basename(projectRoot),
                ...DEFAULT_PROJECT_CONFIG
            } as ProjectConfig;
        }
    }

    /**
     * 获取assets目录路径
     * @param projectRoot 项目根目录
     * @returns assets目录的绝对路径
     */
    static getAssetsDir(projectRoot: string): string {
        const config = this.loadProjectConfig(projectRoot);
        return path.join(projectRoot, config.assetsDir || 'assets');
    }

    /**
     * 获取UI目录路径
     * @param projectRoot 项目根目录
     * @returns UI目录的绝对路径
     */
    static getUiDir(projectRoot: string): string {
        const config = this.loadProjectConfig(projectRoot);
        return path.join(projectRoot, config.uiDir || 'ui');
    }

    /**
     * 获取源码目录路径
     * @param projectRoot 项目根目录
     * @returns 源码目录的绝对路径
     */
    static getSrcDir(projectRoot: string): string {
        const config = this.loadProjectConfig(projectRoot);
        return path.join(projectRoot, config.srcDir || 'src');
    }

    /**
     * 获取插件内置的 lib/sim 路径
     * @returns lib/sim 目录的绝对路径
     */
    static getLibSimPath(): string {
        // __dirname 在编译后指向 out/src/utils/，需要向上三级到达插件根目录
        const extensionPath = path.join(__dirname, '..', '..', '..');
        return path.join(extensionPath, 'lib', 'sim');
    }

    /**
     * 解析分辨率字符串
     * @param resolution 分辨率字符串，如 "480X272"
     * @returns 宽高对象，解析失败返回默认值 480x272
     */
    static parseResolution(resolution?: string): { width: number; height: number } {
        if (!resolution) {
            return { width: 480, height: 272 };
        }
        const parts = resolution.split('X');
        const width = parseInt(parts[0]);
        const height = parseInt(parts[1]);
        if (isNaN(width) || isNaN(height)) {
            return { width: 480, height: 272 };
        }
        return { width, height };
    }
}
