import React, { useState, useRef } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { t } from '../../i18n';

export const HgImageProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

  const handleStyleChange = (property: string, value: any) => {
    onUpdate({
      style: {
        ...component.style,
        [property]: value,
      },
    });
  };

  const handleDataChange = (property: string, value: any) => {
    onUpdate({
      data: {
        ...component.data,
        [property]: value,
      },
    });
  };

  // 当图片路径变更时，请求后端获取图片尺寸并更新组件
  const handleImageSrcChange = (value: string) => {
    handleDataChange('src', value);
    // 如果路径有效，请求后端获取尺寸
    if (value && value.startsWith('assets/')) {
      window.vscodeAPI?.postMessage({
        command: 'getImageSizeForComponent',
        componentId: component.id,
        imagePath: value
      });
    }
  };

  const handleTransformChange = (property: string, value: any) => {
    const transform = component.style?.transform || {};
    onUpdate({
      style: {
        ...component.style,
        transform: {
          ...transform,
          [property]: value,
        },
      },
    });
  };

  const handleSelectImagePath = () => {
    // 直接使用后端的 selectImagePath 命令，让后端处理路径检测和复制
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: component.id,
      propertyName: 'src'
    });
  };

  const renderImageProperty = (value: any, onChange: (value: any) => void) => {
    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            // 失去焦点时获取图片尺寸
            const val = e.target.value;
            if (val && val.startsWith('assets/')) {
              window.vscodeAPI?.postMessage({
                command: 'getImageSizeForComponent',
                componentId: component.id,
                imagePath: val
              });
            }
          }}
          placeholder="图片路径"
          style={{
            flex: 1,
            padding: '4px 6px',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
          }}
        />
        <button
          onClick={handleSelectImagePath}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
          title="选择图片文件"
        >
          📁
        </button>
      </div>
    );
  };

  const transform = component.style?.transform || {};
  
  // 渲染模式选项（对应 BLEND_MODE_TYPE 枚举）
  const blendModeOptions = [
    { value: 'IMG_BYPASS_MODE', label: 'IMG_BYPASS_MODE' },
    { value: 'IMG_FILTER_BLACK', label: 'IMG_FILTER_BLACK' },
    { value: 'IMG_SRC_OVER_MODE', label: 'IMG_SRC_OVER_MODE' },
    { value: 'IMG_COVER_MODE', label: 'IMG_COVER_MODE' },
    { value: 'IMG_RECT', label: 'IMG_RECT' },
    { value: 'IMG_2D_SW_RGB565_ONLY', label: 'IMG_2D_SW_RGB565_ONLY' },
    { value: 'IMG_2D_SW_SRC_OVER_MODE', label: 'IMG_2D_SW_SRC_OVER_MODE' },
    { value: 'IMG_2D_SW_FIX_A8_FG', label: 'IMG_2D_SW_FIX_A8_FG' },
    { value: 'IMG_2D_SW_FIX_A8_BGFG', label: 'IMG_2D_SW_FIX_A8_BGFG' },
  ];

  // 获取当前渲染模式，默认为 IMG_FILTER_BLACK
  const currentBlendMode = component.data?.blendMode || 'IMG_FILTER_BLACK';
  
  // 判断是否需要显示前景色和背景色设置
  const showFgColor = currentBlendMode === 'IMG_2D_SW_FIX_A8_FG' || currentBlendMode === 'IMG_2D_SW_FIX_A8_BGFG';
  const showBgColor = currentBlendMode === 'IMG_2D_SW_FIX_A8_BGFG';

  // 颜色转换函数：将 #RRGGBB 转换为 0xFFRRGGBB 格式
  const hexToArgb = (hex: string): string => {
    if (!hex || !hex.startsWith('#')) return '0xFFFFFFFF';
    const r = hex.substring(1, 3);
    const g = hex.substring(3, 5);
    const b = hex.substring(5, 7);
    return `0xFF${r}${g}${b}`.toUpperCase();
  };

  // 颜色转换函数：将 0xFFRRGGBB 转换为 #RRGGBB 格式
  const argbToHex = (argb: string): string => {
    if (!argb || !argb.startsWith('0x')) return '#FFFFFF';
    const hex = argb.substring(4); // 去掉 0xFF
    return `#${hex}`;
  };

  return (
    <div className="properties-content">
      <div className="properties-tabs">
        <button
          className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          {t('Properties')}
        </button>
        <button
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          {t('Events')}
        </button>
      </div>

      {activeTab === 'properties' ? (
        <>
          <BaseProperties component={component} onUpdate={onUpdate} components={components} disableSize={true} sizeTooltip="图片尺寸由源文件决定" />

          <div className="property-group">
            <div className="property-group-header">{t('Image')}</div>
            <div className="property-item">
              <label>{t('Image Path')}</label>
              {renderImageProperty(component.data?.src, (value) => handleDataChange('src', value))}
            </div>
            
            {/* 渲染模式 */}
            <div className="property-item">
              <label>{t('Blend Mode')}</label>
              <select
                value={currentBlendMode}
                onChange={(e) => handleDataChange('blendMode', e.target.value)}
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  marginTop: '4px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                }}
              >
                {blendModeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 前景色设置（仅在 IMG_2D_SW_FIX_A8_FG 或 IMG_2D_SW_FIX_A8_BGFG 模式下显示） */}
            {showFgColor && (
              <div className="property-item">
                <label>{t('Foreground Color')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="color"
                    value={argbToHex(component.data?.fgColor || '0xFFFFFFFF')}
                    onChange={(e) => handleDataChange('fgColor', hexToArgb(e.target.value))}
                    style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
                  />
                  <input
                    type="text"
                    value={component.data?.fgColor || '0xFFFFFFFF'}
                    onChange={(e) => handleDataChange('fgColor', e.target.value)}
                    placeholder="0xFFRRGGBB"
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 背景色设置（仅在 IMG_2D_SW_FIX_A8_BGFG 模式下显示） */}
            {showBgColor && (
              <div className="property-item">
                <label>{t('Background Color')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="color"
                    value={argbToHex(component.data?.bgColor || '0xFFFFFFFF')}
                    onChange={(e) => handleDataChange('bgColor', hexToArgb(e.target.value))}
                    style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
                  />
                  <input
                    type="text"
                    value={component.data?.bgColor || '0xFFFFFFFF'}
                    onChange={(e) => handleDataChange('bgColor', e.target.value)}
                    placeholder="0xFFRRGGBB"
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 高质量渲染开关 */}
            <div className="property-item">
              <label>{t('High Quality Rendering')}</label>
              <input
                type="checkbox"
                checked={component.data?.highQuality === true}
                onChange={(e) => handleDataChange('highQuality', e.target.checked)}
                style={{ marginTop: '4px' }}
              />
            </div>

            {/* 裁剪开关 */}
            <div className="property-item">
              <label>{t('Enable Clipping')}</label>
              <input
                type="checkbox"
                checked={component.data?.needClip === true}
                onChange={(e) => handleDataChange('needClip', e.target.checked)}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {/* 变换属性 */}
          <div className="property-group">
            <div className="property-group-header">{t('Transform')}</div>
            
            {/* 缩放 */}
            <div className="property-item">
              <label>{t('Scale')}</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={transform.scaleX ?? 1.0}
                    onChange={(e) => handleTransformChange('scaleX', parseFloat(e.target.value) || 1.0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={transform.scaleY ?? 1.0}
                    onChange={(e) => handleTransformChange('scaleY', parseFloat(e.target.value) || 1.0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 旋转 */}
            <div className="property-item">
              <label>{t('Rotation Angle (°)')}</label>
              <input
                type="number"
                step="1"
                value={transform.rotation ?? 0}
                onChange={(e) => handleTransformChange('rotation', parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  marginTop: '4px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                }}
              />
            </div>

            {/* 平移 */}
            <div className="property-item">
              <label>{t('Translation')}</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>X</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.translateX ?? 0}
                    onChange={(e) => handleTransformChange('translateX', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>Y</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.translateY ?? 0}
                    onChange={(e) => handleTransformChange('translateY', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 倾斜 */}
            <div className="property-item">
              <label>{t('Skew Angle (°)')}</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>X</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.skewX ?? 0}
                    onChange={(e) => handleTransformChange('skewX', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>Y</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.skewY ?? 0}
                    onChange={(e) => handleTransformChange('skewY', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 变换中心点 */}
            <div className="property-item">
              <label>{t('Transform Center')}</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>X</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.focusX ?? ''}
                    placeholder="auto"
                    onChange={(e) => handleTransformChange('focusX', e.target.value ? parseFloat(e.target.value) : undefined)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>Y</label>
                  <input
                    type="number"
                    step="1"
                    value={transform.focusY ?? ''}
                    placeholder="auto"
                    onChange={(e) => handleTransformChange('focusY', e.target.value ? parseFloat(e.target.value) : undefined)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                {t('Leave empty to use default (rotation: image center, scale: top-left)')}
              </div>
            </div>

            {/* 透明度 */}
            <div className="property-item">
              <label>{t('Opacity (0-255)')}</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={transform.opacity ?? 255}
                  onChange={(e) => handleTransformChange('opacity', parseInt(e.target.value))}
                  style={{
                    flex: 1,
                  }}
                />
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={transform.opacity ?? 255}
                  onChange={(e) => handleTransformChange('opacity', parseInt(e.target.value) || 255)}
                  style={{
                    width: '60px',
                    padding: '4px 6px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <EventsPanel component={component} onUpdate={onUpdate} />
      )}
    </div>
  );
};
