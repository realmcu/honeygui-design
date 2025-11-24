/**
 * HoneyGUI项目配置
 */
export interface ProjectConfig {
    name: string;
    version?: string;
    assetsDir?: string;  // 资源目录，默认 "assets"
    uiDir?: string;      // UI目录，默认 "ui"
    srcDir?: string;     // 源码目录，默认 "src"
}

/**
 * 项目配置默认值
 */
export const DEFAULT_PROJECT_CONFIG: Partial<ProjectConfig> = {
    assetsDir: 'assets',
    uiDir: 'ui',
    srcDir: 'src'
};
