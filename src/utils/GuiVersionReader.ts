import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';

/**
 * GUI 库版本信息
 */
export interface GuiVersionInfo {
    /** 引擎名称: "HoneyGUI" 或 "LVGL" */
    engine: string;
    /** 版本标签，如 "v2.1.1.0" 或 "9.4.0" */
    tag: string;
    /** 分支名（仅 HoneyGUI） */
    branch: string;
    /** 提交哈希（仅 HoneyGUI） */
    commit: string;
    /** 构建日期（仅 HoneyGUI） */
    buildDate: string;
}

/**
 * 读取 GUI 库的版本信息
 * 根据目标引擎读取对应的版本头文件
 */
export class GuiVersionReader {
    private static _cachedHoneyGuiVersion: GuiVersionInfo | null = null;
    private static _cachedLvglVersion: GuiVersionInfo | null = null;

    /**
     * 获取 GUI 库版本信息
     * @param targetEngine 目标引擎，默认 'honeygui'
     */
    static getVersion(targetEngine: 'honeygui' | 'lvgl' = 'honeygui'): GuiVersionInfo | null {
        if (targetEngine === 'lvgl') {
            return this.getLvglVersion();
        }
        return this.getHoneyGuiVersion();
    }

    /**
     * 获取 HoneyGUI 版本信息
     */
    private static getHoneyGuiVersion(): GuiVersionInfo | null {
        if (this._cachedHoneyGuiVersion) {
            return this._cachedHoneyGuiVersion;
        }

        try {
            // __dirname 编译后指向 out/src/utils/，向上三级到插件根目录
            const extensionRoot = path.join(__dirname, '..', '..', '..');
            const versionFile = path.join(extensionRoot, 'lib', 'sim', 'include', 'gui_version.h');

            if (!fs.existsSync(versionFile)) {
                logger.warn(`[GuiVersionReader] gui_version.h not found: ${versionFile}`);
                return null;
            }

            const content = fs.readFileSync(versionFile, 'utf-8');
            const tag = this.extractDefine(content, 'VERSION_TAG');
            const branch = this.extractDefine(content, 'VERSION_BRANCH');
            const commit = this.extractDefine(content, 'VERSION_COMMIT');
            const buildDate = this.extractDefine(content, 'VERSION_BUILD_DATE');

            if (!tag) {
                return null;
            }

            this._cachedHoneyGuiVersion = {
                engine: 'HoneyGUI',
                tag,
                branch: branch || '',
                commit: commit || '',
                buildDate: buildDate || '',
            };

            logger.info(`[GuiVersionReader] HoneyGUI version: ${tag} (${commit})`);
            return this._cachedHoneyGuiVersion;
        } catch (error) {
            logger.error(`[GuiVersionReader] Failed to read HoneyGUI version: ${error}`);
            return null;
        }
    }

    /**
     * 获取 LVGL 版本信息
     */
    private static getLvglVersion(): GuiVersionInfo | null {
        if (this._cachedLvglVersion) {
            return this._cachedLvglVersion;
        }

        try {
            const extensionRoot = path.join(__dirname, '..', '..', '..');
            const versionFile = path.join(extensionRoot, 'lvgl-pc', 'lvgl-lib', 'include', 'lvgl', 'lv_version.h');

            if (!fs.existsSync(versionFile)) {
                logger.warn(`[GuiVersionReader] lv_version.h not found: ${versionFile}`);
                return null;
            }

            const content = fs.readFileSync(versionFile, 'utf-8');
            const major = this.extractNumericDefine(content, 'LVGL_VERSION_MAJOR');
            const minor = this.extractNumericDefine(content, 'LVGL_VERSION_MINOR');
            const patch = this.extractNumericDefine(content, 'LVGL_VERSION_PATCH');

            if (major === null) {
                return null;
            }

            const tag = `v${major}.${minor ?? 0}.${patch ?? 0}`;

            this._cachedLvglVersion = {
                engine: 'LVGL',
                tag,
                branch: '',
                commit: '',
                buildDate: '',
            };

            logger.info(`[GuiVersionReader] LVGL version: ${tag}`);
            return this._cachedLvglVersion;
        } catch (error) {
            logger.error(`[GuiVersionReader] Failed to read LVGL version: ${error}`);
            return null;
        }
    }

    /**
     * 从 #define 宏中提取字符串值
     */
    private static extractDefine(content: string, name: string): string | null {
        const regex = new RegExp(`#define\\s+${name}\\s+"([^"]*)"`, 'm');
        const match = content.match(regex);
        return match ? match[1] : null;
    }

    /**
     * 从 #define 宏中提取数字值
     */
    private static extractNumericDefine(content: string, name: string): number | null {
        const regex = new RegExp(`#define\\s+${name}\\s+(\\d+)`, 'm');
        const match = content.match(regex);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * 清除缓存
     */
    static clearCache(): void {
        this._cachedHoneyGuiVersion = null;
        this._cachedLvglVersion = null;
    }
}
