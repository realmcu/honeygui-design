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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        window.vscodeAPI?.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(uint8Array),
          relativePath: '',
          componentId: component.id
        });
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
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
