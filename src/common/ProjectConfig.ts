/**
 * HoneyGUI项目配置 - 统一定义
 */
export interface ProjectConfig {
    name?: string;
    version?: string;
    description?: string;
    author?: {
        name?: string;
        email?: string;
    };
    resolution?: string;
    assetsDir?: string;      // 资源目录，默认 "assets"
    uiDir?: string;          // UI目录，默认 "ui"
    srcDir?: string;         // 源码目录，默认 "src"
    honeyguiSdkPath?: string; // HoneyGUI SDK 路径（用于编译仿真）
    designer?: {
        canvasBackgroundColor?: string;
        gridSize?: number;
        showGrid?: boolean;
        snapToGrid?: boolean;
        [key: string]: any;
    };
    preview?: {
        runnerPath?: string;
        autoDownload?: boolean;
        timeoutMs?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * 项目配置默认值
 */
export const DEFAULT_PROJECT_CONFIG: Partial<ProjectConfig> = {
    assetsDir: 'assets',
    uiDir: 'ui',
    srcDir: 'src'
};
