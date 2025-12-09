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
    targetEngine?: 'honeygui' | 'lvgl';  // 目标GUI引擎，默认honeygui
    assetsDir?: string;      // 资源目录，默认 "assets"
    uiDir?: string;          // UI目录，默认 "ui"
    srcDir?: string;         // 源码目录，默认 "src"
    honeyguiSdkPath?: string; // HoneyGUI SDK 路径（用于编译仿真）
    
    // 视频转换配置
    videoFormat?: 'mjpeg' | 'avi' | 'h264';  // 默认视频输出格式
    videoQuality?: number;    // 视频质量 (0-100)，默认 85
    videoFrameRate?: number;  // 视频帧率，默认 30
    
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
    targetEngine: 'honeygui',
    assetsDir: 'assets',
    uiDir: 'ui',
    srcDir: 'src'
};
