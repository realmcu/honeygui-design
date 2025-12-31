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
    romfsBaseAddr?: string;   // romfs 基地址（十六进制，如 "0x04400000"），用于嵌入式烧录
    
    // 屏幕形状配置（与 SDK DRV_LCD_CORNER_RADIUS 对应）
    // 0 = 矩形（默认）, -1 = 圆形, >0 = 圆角半径（像素）
    cornerRadius?: number;
    
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
    uart?: {
        port?: string;       // 串口号，如 "COM3" 或 "/dev/ttyUSB0"
        baudRate?: number;   // 波特率，默认 115200
        chipType?: string;   // 芯片类型: RTL87X3E, RTL87X3EP, RTL87X3D, RTL87X3G
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
    srcDir: 'src',
    romfsBaseAddr: '0x04400000',  // 默认 romfs 基地址
    cornerRadius: 0  // 默认矩形屏幕，-1 为圆形，>0 为圆角半径
};
