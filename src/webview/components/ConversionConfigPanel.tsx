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
  CompressionMethod,
  YuvSampling,
  YuvBlur,
  ItemSettings,
  ConversionConfig,
} from '../types';
import './ConversionConfigPanel.css';

// 文件夹可用的格式选项
const FOLDER_FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'RGB565', label: 'RGB565' },
  { value: 'RGB888', label: 'RGB888' },
  { value: 'ARGB8565', label: 'ARGB8565' },
  { value: 'ARGB8888', label: 'ARGB8888' },
  { value: 'adaptive16', label: 'formatAdaptive16' },
  { value: 'adaptive24', label: 'formatAdaptive24' },
];

// 图片可用的格式选项（包含继承选项和 I8）
const IMAGE_FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'inherit', label: 'formatInherit' },
  { value: 'RGB565', label: 'RGB565' },
  { value: 'RGB888', label: 'RGB888' },
  { value: 'ARGB8565', label: 'ARGB8565' },
  { value: 'ARGB8888', label: 'ARGB8888' },
  { value: 'I8', label: 'I8' },
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

  // 获取当前资源的配置
  const currentSettings = useMemo((): ItemSettings => {
    if (!selectedAsset || !conversionConfig) {
      return {};
    }
    const assetPath = selectedAsset.relativePath || selectedAsset.name;
    return conversionConfig.items[assetPath] || {};
  }, [selectedAsset, conversionConfig]);

  // 获取有效配置（处理继承）
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
  const currentFormat = currentSettings.format || (isFolder ? 'adaptive16' : 'inherit');
  const currentCompression = currentSettings.compression || 'adaptive';
  const showYuvParams = currentCompression === 'yuv' || effectiveSettings.settings.compression === 'yuv';

  return (
    <div className="conversion-config-panel">
      <div className="conversion-config-header">
        <h3>{t('Conversion Settings')}</h3>
      </div>
      <div className="conversion-config-content">
        {/* 资源信息 */}
        <div className="asset-info-section">
          <div className="asset-name">
            <span className="asset-icon">{isFolder ? '📁' : '🖼️'}</span>
            <span>{selectedAsset.name}</span>
          </div>
          {selectedAsset.relativePath && (
            <div className="asset-path">{selectedAsset.relativePath}</div>
          )}
        </div>

        {/* 格式配置 */}
        <div className="config-group">
          <div className="config-group-title">{t('Target Format')}</div>
          <div className="config-item">
            <label>{t('Format')}</label>
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
        </div>

        {/* 压缩配置 */}
        <div className="config-group">
          <div className="config-group-title">{t('Compression')}</div>
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
      </div>
    </div>
  );
};

export default ConversionConfigPanel;
