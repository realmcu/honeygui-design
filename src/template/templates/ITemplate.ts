/**
 * 项目模板接口
 */

export interface ITemplate {
    /** 模板唯一标识 */
    id: string;
    
    /** 模板显示名称 */
    name: string;
    
    /** 模板描述 */
    description: string;
    
    /** 模板分类 */
    category: string;
    
    /** 推荐分辨率 */
    recommendedResolution: string;
    
    /**
     * 生成 HML 内容（保留兼容性）
     */
    generateHml(config: TemplateConfig): string;
    
    /**
     * 创建项目（拷贝完整模板项目）
     */
    createProject(
        targetPath: string,
        projectName: string,
        appId: string,
        sdkPath: string
    ): Promise<void>;
    
    /**
     * 获取模板资源列表
     */
    getAssets(): TemplateAsset[];
    
    /**
     * 拷贝资源到项目
     */
    copyAssets(projectPath: string): Promise<void>;
    
    /**
     * 获取预览图路径（可选）
     */
    getPreviewImage(): string | null;
}

/**
 * 模板配置
 */
export interface TemplateConfig {
    projectName: string;
    resolution: string;
    appId: string;
    minSdk: string;
    pixelMode: string;
}

/**
 * 模板资源
 */
export interface TemplateAsset {
    /** 模板中的源路径 */
    sourcePath: string;
    
    /** 项目中的目标路径 */
    targetPath: string;
    
    /** 资源类型 */
    type: 'image' | 'font' | 'data';
}

/**
 * 模板信息（用于列表显示）
 */
export interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    recommendedResolution: string;
    category: string;
    previewImage?: string;
}
