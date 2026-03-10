import * as path from 'path';
import * as fs from 'fs';

/**
 * 目标格式枚举
 */
export type TargetFormat =
  | 'RGB565'
  | 'RGB888'
  | 'ARGB8565'
  | 'ARGB8888'
  | 'I8'
  | 'A8'
  | 'adaptive16'
  | 'adaptive24'
  | 'inherit';

/**
 * 视频目标格式枚举
 */
export type VideoFormat = 'MJPEG' | 'AVI' | 'H264' | 'inherit';

/**
 * 压缩方式枚举
 */
export type CompressionMethod =
  | 'none'
  | 'rle'
  | 'fastlz'
  | 'yuv'
  | 'adaptive'
  | 'inherit';

/**
 * YUV 采样方式
 */
export type YuvSampling = 'YUV444' | 'YUV422' | 'YUV411';

/**
 * YUV 模糊程度
 */
export type YuvBlur = 'none' | '1bit' | '2bit' | '4bit';

/**
 * YUV 压缩参数
 */
export interface YuvParams {
  sampling: YuvSampling;
  blur: YuvBlur;
  fastlzSecondary: boolean;
}

/**
 * 单个项目（文件夹或图片）的配置
 */
export interface ItemSettings {
  /** 图片目标格式 */
  format?: TargetFormat;
  /** 视频目标格式 */
  videoFormat?: VideoFormat;
  /** 视频质量（MJPEG/AVI: 1-31, H264: 0-51） */
  videoQuality?: number;
  /** 视频帧率 (FPS) */
  videoFrameRate?: number;
  /** 压缩方式 */
  compression?: CompressionMethod;
  /** 抖动处理 */
  dither?: boolean;
  /** YUV 压缩参数 */
  yuvParams?: YuvParams;  /** 字体：不转换格式，直接拷贝原文件 */
  fontCopyOnly?: boolean;}

/**
 * 完整配置文件结构
 */
export interface ConversionConfig {
  version: string;
  defaultSettings: ItemSettings;
  items: Record<string, ItemSettings>;
}


/**
 * 解析后的有效配置（已处理继承）
 */
export interface ResolvedConfig {
  format: Exclude<TargetFormat, 'inherit' | 'adaptive16' | 'adaptive24'>;
  compression: Exclude<CompressionMethod, 'inherit'>;
  yuvParams?: YuvParams;
  dither?: boolean;
  isInherited: boolean;
  inheritedFrom?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ConversionConfig = {
  version: '1.0',
  defaultSettings: {
    format: 'adaptive16',
    compression: 'adaptive',
    dither: false,
    videoFormat: 'MJPEG',
    videoQuality: 5,
    videoFrameRate: undefined
  },
  items: {}
};

/**
 * 默认 YUV 参数
 */
const DEFAULT_YUV_PARAMS: YuvParams = {
  sampling: 'YUV422',
  blur: 'none',
  fastlzSecondary: false
};

/**
 * 图片转换配置服务
 * 处理配置文件的读写和继承解析
 */
export class ConversionConfigService {
  private static instance: ConversionConfigService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ConversionConfigService {
    if (!ConversionConfigService.instance) {
      ConversionConfigService.instance = new ConversionConfigService();
    }
    return ConversionConfigService.instance;
  }

  /**
   * 获取配置文件路径
   * @param projectRoot 项目根目录
   * @returns 配置文件完整路径
   */
  getConfigPath(projectRoot: string): string {
    return path.join(projectRoot, 'assets', 'conversion.json');
  }

  /**
   * 加载配置文件
   * @param projectRoot 项目根目录
   * @returns 配置对象，如果文件不存在则返回默认配置
   */
  loadConfig(projectRoot: string): ConversionConfig {
    const configPath = this.getConfigPath(projectRoot);
    
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as ConversionConfig;
        return this.validateAndMergeConfig(config);
      }
    } catch (error) {
      console.error('Failed to load conversion config:', error);
    }
    
    return { ...DEFAULT_CONFIG, items: {} };
  }


  /**
   * 保存配置文件
   * @param projectRoot 项目根目录
   * @param config 配置对象
   */
  saveConfig(projectRoot: string, config: ConversionConfig): void {
    const configPath = this.getConfigPath(projectRoot);
    const configDir = path.dirname(configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');
  }

  /**
   * 验证并合并配置
   */
  private validateAndMergeConfig(config: Partial<ConversionConfig>): ConversionConfig {
    return {
      version: config.version || DEFAULT_CONFIG.version,
      defaultSettings: { ...DEFAULT_CONFIG.defaultSettings, ...config.defaultSettings },
      items: config.items || {}
    };
  }

  /**
   * 解析有效配置（处理继承）
   * @param assetPath 资源路径（相对于 assets 目录）
   * @param config 完整配置对象
   * @returns 解析后的有效配置
   */
  resolveEffectiveConfig(assetPath: string, config: ConversionConfig): ResolvedConfig {
    const normalizedPath = assetPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = config.items[normalizedPath];
    
    // 判断 format 和 compression 是否需要继承
    const formatNeedsInherit = !itemSettings || !itemSettings.format || itemSettings.format === 'inherit';
    const compressionNeedsInherit = !itemSettings || !itemSettings.compression || itemSettings.compression === 'inherit';
    
    // 如果两者都不需要继承，直接使用当前配置
    if (!formatNeedsInherit && !compressionNeedsInherit) {
      return this.buildResolvedConfig(itemSettings!, false);
    }
    
    // 需要继承：查找父级配置
    const pathParts = normalizedPath.split('/');
    let inheritedFrom: string | undefined;
    let inheritedSettings: ItemSettings | undefined;
    
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = config.items[parentPath];
      
      // 父级有任何有效配置（format 或 compression 不是 inherit）就匹配
      const parentHasFormat = parentSettings?.format && parentSettings.format !== 'inherit';
      const parentHasCompression = parentSettings?.compression && parentSettings.compression !== 'inherit';
      if (parentSettings && (parentHasFormat || parentHasCompression)) {
        inheritedSettings = parentSettings;
        inheritedFrom = parentPath || 'root';
        break;
      }
    }
    
    // 如果没有找到父级配置，使用默认配置
    if (!inheritedSettings) {
      inheritedSettings = config.defaultSettings;
      inheritedFrom = 'default';
    }
    
    // 合并配置：对需要继承的字段使用父级值，否则使用自身值
    const mergedSettings: ItemSettings = {
      ...inheritedSettings,
      ...itemSettings,
      format: formatNeedsInherit ? inheritedSettings.format : itemSettings!.format,
      compression: compressionNeedsInherit ? inheritedSettings.compression : itemSettings!.compression,
    };
    
    return this.buildResolvedConfig(mergedSettings, true, inheritedFrom);
  }


  /**
   * 根据图片是否有透明度解析自适应格式
   * @param format 原始格式设置
   * @param hasAlpha 图片是否包含透明度
   * @returns 解析后的具体格式
   */
  resolveAdaptiveFormat(
    format: TargetFormat,
    hasAlpha: boolean
  ): Exclude<TargetFormat, 'inherit' | 'adaptive16' | 'adaptive24'> {
    switch (format) {
      case 'adaptive16':
        return hasAlpha ? 'ARGB8565' : 'RGB565';
      case 'adaptive24':
        return hasAlpha ? 'ARGB8888' : 'RGB888';
      case 'inherit':
        return 'RGB565';
      default:
        return format;
    }
  }

  /**
   * 构建解析后的配置对象
   */
  private buildResolvedConfig(
    settings: ItemSettings,
    isInherited: boolean,
    inheritedFrom?: string
  ): ResolvedConfig {
    const format = settings.format || 'RGB565';
    const compression = settings.compression || 'adaptive';
    // inherit 不应该出现在这里（已在 resolveEffectiveConfig 中处理），防御性处理
    const resolvedCompression = compression === 'inherit' ? 'adaptive' : compression;
    const dither = settings.dither;
    
    let resolvedFormat: Exclude<TargetFormat, 'inherit' | 'adaptive16' | 'adaptive24'>;
    if (format === 'adaptive16' || format === 'adaptive24' || format === 'inherit') {
      resolvedFormat = 'RGB565';
    } else {
      resolvedFormat = format;
    }
    
    const result: ResolvedConfig = {
      format: resolvedFormat,
      compression: resolvedCompression,
      dither,
      isInherited
    };
    
    if (inheritedFrom) {
      result.inheritedFrom = inheritedFrom;
    }
    
    if (resolvedCompression === 'yuv' && settings.yuvParams) {
      result.yuvParams = { ...settings.yuvParams };
    } else if (resolvedCompression === 'yuv') {
      result.yuvParams = { ...DEFAULT_YUV_PARAMS };
    }
    
    return result;
  }

  /**
   * 更新单个项目的配置
   */
  updateItemConfig(projectRoot: string, assetPath: string, settings: ItemSettings): void {
    const config = this.loadConfig(projectRoot);
    const normalizedPath = assetPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    if (Object.keys(settings).length === 0) {
      delete config.items[normalizedPath];
    } else {
      config.items[normalizedPath] = settings;
    }
    
    this.saveConfig(projectRoot, config);
  }

  /**
   * 获取单个项目的原始配置（不处理继承）
   */
  getItemConfig(projectRoot: string, assetPath: string): ItemSettings | undefined {
    const config = this.loadConfig(projectRoot);
    const normalizedPath = assetPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return config.items[normalizedPath];
  }
}
