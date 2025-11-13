import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { Component } from '../types';
import { componentDefinitions } from './ComponentLibrary';
import './PropertiesPanel.css';

const PropertiesPanel: React.FC = () => {
  const { selectedComponent, updateComponent } = useDesignerStore();
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

  const selected = useDesignerStore.getState().getSelectedComponent();

  if (!selected) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <h3>属性</h3>
        </div>
        <div className="properties-content">
          <div className="no-selection">请选择一个组件</div>
        </div>
      </div>
    );
  }

  const definition = componentDefinitions.find((d) => d.type === selected.type);

  const handlePropertyChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    updateComponent(selectedComponent, {
      [property]: value,
    });
  };

  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      position: {
        ...current.position,
        [field]: value,
      },
    });
  };

  const handleStyleChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      style: {
        ...current.style,
        [property]: value,
      },
    });
  };

  const handleDataChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      data: {
        ...current.data,
        [property]: value,
      },
    });
  };

  const renderPropertyEditor = (property: any, value: any, onChange: (value: any) => void) => {
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '4px 6px',
      marginTop: '4px',
      backgroundColor: 'var(--vscode-input-background)',
      color: 'var(--vscode-input-foreground)',
      border: '1px solid var(--vscode-input-border)',
      borderRadius: '2px',
    };

    switch (property.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              marginTop: '4px',
            }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        );

      case 'color':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          >
            {property.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>属性</h3>
      </div>

      <div className="properties-tabs">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          属性
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          事件
        </button>
      </div>

      <div className="properties-content">
        {activeTab === 'properties' && (
          <>
            {/* Name and ID */}
            <div className="property-group">
              <div className="property-item">
                <label>名称</label>
                {renderPropertyEditor(
                  { type: 'string' },
                  selected.name,
                  (value) => handlePropertyChange('name', value)
                )}
              </div>

              <div className="property-item">
                <label>ID</label>
                <input
                  type="text"
                  value={selected.id}
                  disabled
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    marginTop: '4px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>

            {/* Position and Size */}
            <div className="property-group">
              <div className="property-item">
                <label>位置与大小</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '12px' }}>X</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.x,
                      (value) => handlePositionChange('x', value)
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>Y</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.y,
                      (value) => handlePositionChange('y', value)
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>宽度</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.width,
                      (value) => handlePositionChange('width', value)
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>高度</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.height,
                      (value) => handlePositionChange('height', value)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility and State */}
            <div className="property-group">
              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>可见</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.visible,
                    (value) => handlePropertyChange('visible', value)
                  )}
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>启用</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.enabled,
                    (value) => handlePropertyChange('enabled', value)
                  )}
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>锁定</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.locked,
                    (value) => handlePropertyChange('locked', value)
                  )}
                </div>
              </div>
            </div>

            {/* Style Properties */}
            {definition && (
              <>
                {definition.properties.filter(p => p.group === 'style').length > 0 && (
                  <div className="property-group">
                    <div className="property-group-title">样式</div>
                    {definition.properties
                      .filter(p => p.group === 'style')
                      .map((property) => (
                        <div key={property.name} className="property-item">
                          <label>{property.label}</label>
                          {renderPropertyEditor(
                            property,
                            (selected.style as any)?.[property.name],
                            (value) => handleStyleChange(property.name, value)
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Data Properties */}
                {definition.properties.filter(p => p.group === 'data').length > 0 && (
                  <div className="property-group">
                    <div className="property-group-title">数据</div>
                    {definition.properties
                      .filter(p => p.group === 'data')
                      .map((property) => (
                        <div key={property.name} className="property-item">
                          <label>{property.label}</label>
                          {renderPropertyEditor(
                            property,
                            (selected.data as any)?.[property.name],
                            (value) => handleDataChange(property.name, value)
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'events' && (
          <div className="events-panel">
            <div className="property-item">
              <label>事件处理器</label>
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '8px' }}>
                事件功能将在后续版本中实现
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
