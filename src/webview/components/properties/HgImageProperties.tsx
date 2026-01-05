import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';

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
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: component.id
    });
  };

  const renderImageProperty = (value: any, onChange: (value: any) => void) => {
    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
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
      {/* Tab 切换 */}
      <div className="properties-tabs">
        <button
          className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          属性
        </button>
        <button
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          事件
        </button>
      </div>

      {activeTab === 'properties' ? (
        <>
          {/* 基础属性 */}
          <BaseProperties component={component} onUpdate={onUpdate} components={components} disableSize={true} sizeTooltip="图片尺寸由源文件决定" />

          {/* 图片源 */}
          <div className="property-group">
            <div className="property-group-header">图片</div>
            <div className="property-item">
              <label>图片路径</label>
              {renderImageProperty(component.data?.src, (value) => handleDataChange('src', value))}
            </div>
          </div>

          {/* 变换属性 */}
          <div className="property-group">
            <div className="property-group-header">变换</div>
            
            {/* 缩放 */}
            <div className="property-item">
              <label>缩放</label>
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
              <label>旋转角度 (°)</label>
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
              <label>平移</label>
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
              <label>倾斜角度 (°)</label>
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
              <label>变换中心</label>
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
                留空则使用默认（旋转：图片中心，缩放：左上角）
              </div>
            </div>

            {/* 透明度 */}
            <div className="property-item">
              <label>透明度 (0-255)</label>
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
