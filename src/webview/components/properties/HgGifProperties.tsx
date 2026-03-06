import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { t } from '../../i18n';

export const HgGifProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  
  // 保存当前正在编辑的组件 ID
  const componentIdRef = React.useRef(component.id);
  
  // 组件切换时更新 ref
  React.useEffect(() => {
    componentIdRef.current = component.id;
  }, [component.id]);

  const handleDataChange = (property: string, value: any) => {
    onUpdate({
      data: {
        ...component.data,
        [property]: value,
      },
    });
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

  const handleSelectGifPath = () => {
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: component.id,
      propertyName: 'src'
    });
  };

  const renderGifProperty = (value: any, onChange: (value: any) => void) => {
    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const val = e.target.value;
            if (val && val.startsWith('assets/')) {
              window.vscodeAPI?.postMessage({
                command: 'getImageSizeForComponent',
                componentId: componentIdRef.current,
                imagePath: val
              });
            }
          }}
          placeholder="GIF 路径"
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
          onClick={handleSelectGifPath}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
          title="选择 GIF 文件"
        >
          📁
        </button>
      </div>
    );
  };

  const transform = component.style?.transform || {};
  
  // 渲染模式选项
  const blendModeOptions = [
    { value: 'IMG_BYPASS_MODE', label: 'IMG_BYPASS_MODE' },
    { value: 'IMG_FILTER_BLACK', label: 'IMG_FILTER_BLACK' },
    { value: 'IMG_SRC_OVER_MODE', label: 'IMG_SRC_OVER_MODE' },
    { value: 'IMG_COVER_MODE', label: 'IMG_COVER_MODE' },
  ];

  const currentBlendMode = component.data?.blendMode || 'IMG_FILTER_BLACK';

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
          <BaseProperties component={component} onUpdate={onUpdate} components={components} disableSize={true} sizeTooltip="GIF 尺寸由源文件决定">
            {/* GIF 路径 */}
            <div className="property-item">
              <label>{t('GIF Path')}</label>
              {renderGifProperty(component.data?.src, (value) => handleDataChange('src', value))}
            </div>
          </BaseProperties>

          {/* Rendering 分组 */}
          <div className="property-group">
            <div className="property-group-header">{t('Rendering')}</div>
            
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
                    onChange={(e) => {
                      const val = e.target.value === '' ? 1.0 : parseFloat(e.target.value);
                      handleTransformChange('scaleX', isNaN(val) ? 1.0 : val);
                    }}
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
                    onChange={(e) => {
                      const val = e.target.value === '' ? 1.0 : parseFloat(e.target.value);
                      handleTransformChange('scaleY', isNaN(val) ? 1.0 : val);
                    }}
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
          </div>

          {/* Appearance 分组 */}
          <div className="property-group">
            <div className="property-group-header">{t('Appearance')}</div>
            
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
                  onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val)) {
                      val = 255;
                    } else if (val < 0) {
                      val = 0;
                    } else if (val > 255) {
                      val = 255;
                    }
                    handleTransformChange('opacity', val);
                  }}
                  onBlur={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val) || e.target.value === '') {
                      val = 255;
                    } else if (val < 0) {
                      val = 0;
                    } else if (val > 255) {
                      val = 255;
                    }
                    handleTransformChange('opacity', val);
                  }}
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
