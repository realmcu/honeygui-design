/**
 * ConversionConfigPanel - 图片转换配置面板
 * 用于配置文件夹和图片的目标格式、压缩方式等
 */

import React, { useCallback, useMemo } from 'react';
import { useDesignerStore } from '../store';
import { t } from '../i18n';
import {
  AssetFile,
  TargetFormat,
  VideoFormat,
  CompressionMethod,
  YuvSampling,
  YuvBlur,
  ItemSettings,
  ConversionConfig,
} from '../types';
import './ConversionConfigPanel.css';

// 视频文件扩展名
const VIDEO_EXTS = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

// 文件夹可用的格式选项
const FOLDER_FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'RGB565', label: 'RGB565' },
  { value: 'RGB888', label: 'RGB888' },
  { value: 'ARGB8565', label: 'ARGB8565' },
  { value: 'ARGB8888', label: 'ARGB8888' },
  { value: 'adaptive16', label: 'formatAdaptive16' },
  { value: 'adaptive24', label: 'formatAdaptive24' },
];

// 图片可用的格式选项（包含继承选项和 I8、A8）
const IMAGE_FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'inherit', label: 'formatInherit' },
  { value: 'RGB565', label: 'RGB565' },
  { value: 'RGB888', label: 'RGB888' },
  { value: 'ARGB8565', label: 'ARGB8565' },
  { value: 'ARGB8888', label: 'ARGB8888' },
  { value: 'I8', label: 'I8' },
  { value: 'A8', label: 'A8' },
];

// 文件夹可用的视频格式选项（不含继承）
const FOLDER_VIDEO_FORMAT_OPTIONS: { value: VideoFormat; label: string }[] = [
  { value: 'MJPEG', label: 'MJPEG' },
  { value: 'AVI', label: 'AVI' },
  { value: 'H264', label: 'H264' },
];

// 视频文件可用的格式选项（包含继承选项）
const VIDEO_FORMAT_OPTIONS: { value: VideoFormat; label: string }[] = [
  { value: 'inherit', label: 'formatInherit' },
  { value: 'MJPEG', label: 'MJPEG' },
  { value: 'AVI', label: 'AVI' },
  { value: 'H264', label: 'H264' },
];

// 压缩方式选项
const COMPRESSION_OPTIONS: { value: CompressionMethod; label: string }[] = [
  { value: 'none', label: 'compressionNone' },
  { value: 'rle', label: 'compressionRLE' },
  { value: 'fastlz', label: 'compressionFastLZ' },
  { value: 'yuv', label: 'compressionYUV' },
  { value: 'adaptive', label: 'compressionAdaptive' },
];

// YUV 采样方式选项
const YUV_SAMPLING_OPTIONS: { value: YuvSampling; label: string }[] = [
  { value: 'YUV444', label: 'YUV444' },
  { value: 'YUV422', label: 'YUV422' },
  { value: 'YUV411', label: 'YUV411' },
];

// YUV 模糊程度选项
const YUV_BLUR_OPTIONS: { value: YuvBlur; label: string }[] = [
  { value: 'none', label: 'blurNone' },
  { value: '1bit', label: '1bit' },
  { value: '2bit', label: '2bit' },
  { value: '4bit', label: '4bit' },
];


/**
 * 获取格式的显示标签
 */
const getFormatLabel = (format: TargetFormat): string => {
  switch (format) {
    case 'adaptive16':
      return t('formatAdaptive16');
    case 'adaptive24':
      return t('formatAdaptive24');
    case 'inherit':
      return t('formatInherit');
    default:
      return format;
  }
};

/**
 * 获取压缩方式的显示标签
 */
const getCompressionLabel = (compression: CompressionMethod): string => {
  switch (compression) {
    case 'none':
      return t('compressionNone');
    case 'rle':
      return t('compressionRLE');
    case 'fastlz':
      return t('compressionFastLZ');
    case 'yuv':
      return t('compressionYUV');
    case 'adaptive':
      return t('compressionAdaptive');
    default:
      return compression;
  }
};

/**
 * 获取 YUV 模糊程度的显示标签
 */
const getBlurLabel = (blur: YuvBlur): string => {
  if (blur === 'none') {
    return t('blurNone');
  }
  return blur;
};

interface ConversionConfigPanelProps {
  // Props can be extended if needed
}

const ConversionConfigPanel: React.FC<ConversionConfigPanelProps> = () => {
  const selectedAsset = useDesignerStore((state) => state.selectedAsset);
  const conversionConfig = useDesignerStore((state) => state.conversionConfig);
  const updateAssetConfig = useDesignerStore((state) => state.updateAssetConfig);

  // 判断是否是文件夹
  const isFolder = selectedAsset?.type === 'folder';
  
  // 判断是否是视频文件
  const isVideo = useMemo(() => {
    if (!selectedAsset || isFolder) return false;
    const ext = selectedAsset.name.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTS.includes(ext);
  }, [selectedAsset, isFolder]);

  // 获取当前资源的配置
  const currentSettings = useMemo((): ItemSettings => {
    if (!selectedAsset || !conversionConfig) {
      return {};
    }
    const assetPath = selectedAsset.relativePath || selectedAsset.name;
    return conversionConfig.items[assetPath] || {};
  }, [selectedAsset, conversionConfig]);

  // 获取有效配置（处理继承）- 图片格式
  const effectiveSettings = useMemo((): { settings: ItemSettings; isInherited: boolean; inheritedFrom?: string } => {
    if (!selectedAsset || !conversionConfig) {
      return { settings: {}, isInherited: false };
    }

    const assetPath = (selectedAsset.relativePath || selectedAsset.name).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = conversionConfig.items[assetPath];

    // 如果有明确配置且不是 inherit，直接使用
    if (itemSettings && itemSettings.format && itemSettings.format !== 'inherit') {
      return { settings: itemSettings, isInherited: false };
    }

    // 需要继承：查找父级配置
    const pathParts = assetPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? conversionConfig.items[parentPath] : undefined;

      if (parentSettings && parentSettings.format && parentSettings.format !== 'inherit') {
        return {
          settings: { ...parentSettings, ...itemSettings, format: parentSettings.format },
          isInherited: true,
          inheritedFrom: parentPath || t('Root'),
        };
      }
    }

    // 使用默认配置
    return {
      settings: { ...conversionConfig.defaultSettings, ...itemSettings },
      isInherited: true,
      inheritedFrom: t('defaultSettings'),
    };
  }, [selectedAsset, conversionConfig]);

  // 获取有效视频配置（处理继承）
  const effectiveVideoSettings = useMemo((): { videoFormat: VideoFormat; isInherited: boolean; inheritedFrom?: string } => {
    if (!selectedAsset || !conversionConfig) {
      return { videoFormat: 'MJPEG', isInherited: false };
    }

    const assetPath = (selectedAsset.relativePath || selectedAsset.name).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = conversionConfig.items[assetPath];

    // 如果有明确配置且不是 inherit，直接使用
    if (itemSettings && itemSettings.videoFormat && itemSettings.videoFormat !== 'inherit') {
      return { videoFormat: itemSettings.videoFormat, isInherited: false };
    }

    // 需要继承：查找父级配置
    const pathParts = assetPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? conversionConfig.items[parentPath] : undefined;

      if (parentSettings && parentSettings.videoFormat && parentSettings.videoFormat !== 'inherit') {
        return {
          videoFormat: parentSettings.videoFormat,
          isInherited: true,
          inheritedFrom: parentPath || t('Root'),
        };
      }
    }

    // 使用默认值 MJPEG
    return {
      videoFormat: 'MJPEG',
      isInherited: true,
      inheritedFrom: t('defaultSettings'),
    };
  }, [selectedAsset, conversionConfig]);

  // 获取有效视频质量（处理继承）
  const effectiveVideoQuality = useMemo((): { quality: number | undefined; isInherited: boolean; inheritedFrom?: string } => {
    if (!selectedAsset || !conversionConfig) {
      return { quality: undefined, isInherited: false };
    }

    const assetPath = (selectedAsset.relativePath || selectedAsset.name).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = conversionConfig.items[assetPath];

    // 如果有明确配置，直接使用
    if (itemSettings && itemSettings.videoQuality !== undefined) {
      return { quality: itemSettings.videoQuality, isInherited: false };
    }

    // 需要继承：查找父级配置
    const pathParts = assetPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? conversionConfig.items[parentPath] : undefined;

      if (parentSettings && parentSettings.videoQuality !== undefined) {
        return {
          quality: parentSettings.videoQuality,
          isInherited: true,
          inheritedFrom: parentPath || t('Root'),
        };
      }
    }

    // 没有配置，返回 undefined（使用默认值）
    return {
      quality: undefined,
      isInherited: false,
    };
  }, [selectedAsset, conversionConfig]);

  // 获取有效视频帧率（处理继承）
  const effectiveVideoFrameRate = useMemo((): { frameRate: number | undefined; isInherited: boolean; inheritedFrom?: string } => {
    if (!selectedAsset || !conversionConfig) {
      return { frameRate: undefined, isInherited: false };
    }

    const assetPath = (selectedAsset.relativePath || selectedAsset.name).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = conversionConfig.items[assetPath];

    // 如果有明确配置，直接使用
    if (itemSettings && itemSettings.videoFrameRate !== undefined) {
      return { frameRate: itemSettings.videoFrameRate, isInherited: false };
    }

    // 需要继承：查找父级配置
    const pathParts = assetPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? conversionConfig.items[parentPath] : undefined;

      if (parentSettings && parentSettings.videoFrameRate !== undefined) {
        return {
          frameRate: parentSettings.videoFrameRate,
          isInherited: true,
          inheritedFrom: parentPath || t('Root'),
        };
      }
    }

    // 没有配置，返回 undefined（使用默认值）
    return {
      frameRate: undefined,
      isInherited: false,
    };
  }, [selectedAsset, conversionConfig]);

  // 获取有效 Dither 配置（处理继承）
  const effectiveDither = useMemo((): { dither: boolean; isInherited: boolean; inheritedFrom?: string } => {
    if (!selectedAsset || !conversionConfig) {
      return { dither: false, isInherited: false };
    }

    const assetPath = (selectedAsset.relativePath || selectedAsset.name).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemSettings = conversionConfig.items[assetPath];

    // 如果有明确配置，直接使用
    if (itemSettings && itemSettings.dither !== undefined) {
      return { dither: itemSettings.dither, isInherited: false };
    }

    // 需要继承：查找父级配置
    const pathParts = assetPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? conversionConfig.items[parentPath] : undefined;

      if (parentSettings && parentSettings.dither !== undefined) {
        return {
          dither: parentSettings.dither,
          isInherited: true,
          inheritedFrom: parentPath || t('Root'),
        };
      }
    }

    // 使用默认配置
    return {
      dither: conversionConfig.defaultSettings.dither ?? false,
      isInherited: true,
      inheritedFrom: t('defaultSettings'),
    };
  }, [selectedAsset, conversionConfig]);

  // 处理格式变更
  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedAsset) return;
      const newFormat = e.target.value as TargetFormat;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        format: newFormat,
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理视频格式变更
  const handleVideoFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedAsset) return;
      const newFormat = e.target.value as VideoFormat;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        videoFormat: newFormat,
      }, 'videoFormat'); // 传递变更字段，触发代码生成
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理视频质量变更
  const handleVideoQualityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAsset) return;
      const value = e.target.value;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      // 允许空值（使用默认值）
      const quality = value === '' ? undefined : parseInt(value, 10);
      updateAssetConfig(assetPath, {
        ...currentSettings,
        videoQuality: quality,
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理视频帧率变更
  const handleVideoFrameRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAsset) return;
      const value = e.target.value;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      // 允许空值（使用默认值）
      const frameRate = value === '' ? undefined : parseInt(value, 10);
      updateAssetConfig(assetPath, {
        ...currentSettings,
        videoFrameRate: frameRate,
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理 Dither 变更
  const handleDitherChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAsset) return;
      const newValue = e.target.checked;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        dither: newValue,
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理压缩方式变更
  const handleCompressionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedAsset) return;
      const newCompression = e.target.value as CompressionMethod;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      const newSettings: ItemSettings = {
        ...currentSettings,
        compression: newCompression,
      };
      // 如果选择 YUV，添加默认 YUV 参数
      if (newCompression === 'yuv' && !newSettings.yuvParams) {
        newSettings.yuvParams = {
          sampling: 'YUV422',
          blur: 'none',
          fastlzSecondary: false,
        };
      }
      // 如果不是 YUV，移除 YUV 参数
      if (newCompression !== 'yuv') {
        delete newSettings.yuvParams;
      }
      updateAssetConfig(assetPath, newSettings);
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理 YUV 采样方式变更
  const handleYuvSamplingChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedAsset) return;
      const newSampling = e.target.value as YuvSampling;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        yuvParams: {
          ...(currentSettings.yuvParams || { sampling: 'YUV422', blur: 'none', fastlzSecondary: false }),
          sampling: newSampling,
        },
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理 YUV 模糊程度变更
  const handleYuvBlurChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedAsset) return;
      const newBlur = e.target.value as YuvBlur;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        yuvParams: {
          ...(currentSettings.yuvParams || { sampling: 'YUV422', blur: 'none', fastlzSecondary: false }),
          blur: newBlur,
        },
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 处理 FastLZ 二次压缩变更
  const handleFastlzSecondaryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAsset) return;
      const newValue = e.target.checked;
      const assetPath = selectedAsset.relativePath || selectedAsset.name;
      updateAssetConfig(assetPath, {
        ...currentSettings,
        yuvParams: {
          ...(currentSettings.yuvParams || { sampling: 'YUV422', blur: 'none', fastlzSecondary: false }),
          fastlzSecondary: newValue,
        },
      });
    },
    [selectedAsset, currentSettings, updateAssetConfig]
  );

  // 如果没有选中资源，显示提示
  if (!selectedAsset) {
    return (
      <div className="conversion-config-panel">
        <div className="conversion-config-header">
          <h3>{t('Conversion Settings')}</h3>
        </div>
        <div className="conversion-config-content">
          <div className="no-selection">{t('selectAssetToConfig')}</div>
        </div>
      </div>
    );
  }

  const formatOptions = isFolder ? FOLDER_FORMAT_OPTIONS : IMAGE_FORMAT_OPTIONS;
  const videoFormatOptions = isFolder ? FOLDER_VIDEO_FORMAT_OPTIONS : VIDEO_FORMAT_OPTIONS;
  const currentFormat = currentSettings.format || (isFolder ? 'adaptive16' : 'inherit');
  const currentVideoFormat = currentSettings.videoFormat || (isFolder ? 'MJPEG' : 'inherit');
  const currentCompression = currentSettings.compression || 'adaptive';
  const showYuvParams = currentCompression === 'yuv' || effectiveSettings.settings.compression === 'yuv';

  // 渲染图片设置区域
  const renderImageSettings = () => (
    <div className="config-group">
      <div className="config-group-title">🖼️ {t('Image Settings')}</div>
      <div className="config-item">
        <label>{t('Target Format')}</label>
        <select value={currentFormat} onChange={handleFormatChange}>
          {formatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label.startsWith('format') || option.label.startsWith('compression') || option.label.startsWith('blur')
                ? t(option.label as any)
                : option.label}
            </option>
          ))}
        </select>
        {/* 继承状态指示器 */}
        {effectiveSettings.isInherited && currentFormat === 'inherit' && (
          <div className="inherited-indicator">
            <span className="icon">↩️</span>
            <span>
              {t('inheritedFrom')}: {effectiveSettings.inheritedFrom} (
              {getFormatLabel(effectiveSettings.settings.format || 'RGB565')})
            </span>
          </div>
        )}
      </div>
      <div className="config-item">
        <label>{t('Compression Method')}</label>
        <select value={currentCompression} onChange={handleCompressionChange}>
          {COMPRESSION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label as any)}
            </option>
          ))}
        </select>
        {currentCompression === 'adaptive' && (
          <div className="config-hint">{t('adaptiveCompressionHint')}</div>
        )}
      </div>

      <div className="config-item checkbox-item">
        <div className="checkbox-wrapper">
          <input
            type="checkbox"
            id="dither"
            checked={currentSettings.dither ?? effectiveDither.dither}
            onChange={handleDitherChange}
          />
          <label htmlFor="dither">{t('Enable Dither')}</label>
        </div>
        <div className="config-hint">{t('ditherHint')}</div>
        {/* Dither 继承状态指示器 */}
        {effectiveDither.isInherited && currentSettings.dither === undefined && (
          <div className="inherited-indicator">
            <span className="icon">↩️</span>
            <span>
              {t('inheritedFrom')}: {effectiveDither.inheritedFrom} ({effectiveDither.dither ? t('Enabled') : t('Disabled')})
            </span>
          </div>
        )}
      </div>

      {/* YUV 参数配置 */}
      {showYuvParams && (
        <div className="yuv-params-section">
          <div className="yuv-params-title">{t('YUV Parameters')}</div>
          <div className="yuv-params-grid">
            <div className="yuv-param-item">
              <label>{t('Sampling')}</label>
              <select
                value={currentSettings.yuvParams?.sampling || effectiveSettings.settings.yuvParams?.sampling || 'YUV422'}
                onChange={handleYuvSamplingChange}
              >
                {YUV_SAMPLING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="yuv-param-item">
              <label>{t('Blur')}</label>
              <select
                value={currentSettings.yuvParams?.blur || effectiveSettings.settings.yuvParams?.blur || 'none'}
                onChange={handleYuvBlurChange}
              >
                {YUV_BLUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getBlurLabel(option.value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="fastlzSecondary"
                checked={
                  currentSettings.yuvParams?.fastlzSecondary ??
                  effectiveSettings.settings.yuvParams?.fastlzSecondary ??
                  false
                }
                onChange={handleFastlzSecondaryChange}
              />
              <label htmlFor="fastlzSecondary">{t('FastLZ Secondary Compression')}</label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染视频设置区域
  const renderVideoSettings = () => {
    // 获取有效的视频格式（用于确定质量范围）
    const effectiveFormat = currentVideoFormat === 'inherit' 
      ? effectiveVideoSettings.videoFormat 
      : currentVideoFormat;
    
    // 根据格式确定质量范围和默认值
    const isH264 = effectiveFormat === 'H264';
    const qualityMin = isH264 ? 0 : 1;
    const qualityMax = isH264 ? 51 : 31;
    const qualityDefault = isH264 ? 23 : 1;
    const qualityLabel = isH264 ? t('CRF Quality (0-51)') : t('Quality (1-31)');
    const qualityHint = isH264 ? t('H.264 CRF value, 0=lossless, 23=default, 51=lowest') : t('JPEG compression quality, 1=highest, 31=lowest');
    
    // 当前质量值和帧率值
    const currentQuality = currentSettings.videoQuality;
    const currentFrameRate = currentSettings.videoFrameRate;
    
    return (
      <div className="config-group">
        <div className="config-group-title">🎬 {t('Video Settings')}</div>
        <div className="config-item">
          <label>{t('Target Format')}</label>
          <select value={currentVideoFormat} onChange={handleVideoFormatChange}>
            {videoFormatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label === 'formatInherit' ? t('formatInherit') : option.label}
              </option>
            ))}
          </select>
          {/* 视频格式继承状态指示器 */}
          {effectiveVideoSettings.isInherited && currentVideoFormat === 'inherit' && (
            <div className="inherited-indicator">
              <span className="icon">↩️</span>
              <span>
                {t('inheritedFrom')}: {effectiveVideoSettings.inheritedFrom} ({effectiveVideoSettings.videoFormat})
              </span>
            </div>
          )}
        </div>
        <div className="config-item">
          <label>{qualityLabel}</label>
          <input
            type="number"
            min={qualityMin}
            max={qualityMax}
            value={currentQuality ?? ''}
            placeholder={String(qualityDefault)}
            onChange={handleVideoQualityChange}
          />
          <div className="config-hint">{qualityHint}</div>
          {/* 视频质量继承状态指示器 */}
          {effectiveVideoQuality.isInherited && currentQuality === undefined && (
            <div className="inherited-indicator">
              <span className="icon">↩️</span>
              <span>
                {t('inheritedFrom')}: {effectiveVideoQuality.inheritedFrom} ({effectiveVideoQuality.quality})
              </span>
            </div>
          )}
        </div>
        <div className="config-item">
          <label>{t('Frame Rate (FPS)')}</label>
          <input
            type="number"
            min={1}
            max={60}
            value={currentFrameRate ?? ''}
            placeholder="30"
            onChange={handleVideoFrameRateChange}
          />
          <div className="config-hint">{t('Output video frame rate')}</div>
          {/* 视频帧率继承状态指示器 */}
          {effectiveVideoFrameRate.isInherited && currentFrameRate === undefined && (
            <div className="inherited-indicator">
              <span className="icon">↩️</span>
              <span>
                {t('inheritedFrom')}: {effectiveVideoFrameRate.inheritedFrom} ({effectiveVideoFrameRate.frameRate})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="conversion-config-panel">
      <div className="conversion-config-header">
        <h3>{t('Conversion Settings')}</h3>
      </div>
      <div className="conversion-config-content">
        {/* 资源信息 */}
        <div className="asset-info-section">
          <div className="asset-name">
            <span className="asset-icon">{isFolder ? '📁' : isVideo ? '🎬' : '🖼️'}</span>
            <span>{selectedAsset.name}</span>
          </div>
          {selectedAsset.relativePath && (
            <div className="asset-path">{selectedAsset.relativePath}</div>
          )}
        </div>

        {/* 根据资源类型显示不同的配置区域 */}
        {isFolder ? (
          <>
            {/* 文件夹：同时显示图片和视频设置 */}
            {renderImageSettings()}
            {renderVideoSettings()}
          </>
        ) : isVideo ? (
          /* 视频文件：只显示视频设置 */
          renderVideoSettings()
        ) : (
          /* 图片文件：只显示图片设置 */
          renderImageSettings()
        )}
      </div>
    </div>
  );
};

export default ConversionConfigPanel;
