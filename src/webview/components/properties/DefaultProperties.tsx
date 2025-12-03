import React from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { componentDefinitions } from '../ComponentLibrary';

export const DefaultProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  const definition = componentDefinitions.find((d) => d.type === component.type);

  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    onUpdate({
      position: {
        ...component.position,
        [field]: value,
      },
    });
  };

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

  return (
    <div className="properties-content">
      {/* Name and ID */}
      <div className="property-group">
        <div className="property-item">
          <label>名称</label>
          <PropertyEditor
            type="string"
            value={component.name}
            onChange={(value) => onUpdate({ name: value })}
          />
        </div>

        <div className="property-item">
          <label>ID</label>
          <PropertyEditor
            type="string"
            value={component.id}
            onChange={() => {}}
            disabled
          />
        </div>
      </div>

      {/* Position and Size */}
      <div className="property-group">
        <div className="property-item">
          <label>位置与大小</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X</label>
              <PropertyEditor
                type="number"
                value={component.position.x}
                onChange={(value) => handlePositionChange('x', value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y</label>
              <PropertyEditor
                type="number"
                value={component.position.y}
                onChange={(value) => handlePositionChange('y', value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>宽度</label>
              <PropertyEditor
                type="number"
                value={component.position.width}
                onChange={(value) => handlePositionChange('width', value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>高度</label>
              <PropertyEditor
                type="number"
                value={component.position.height}
                onChange={(value) => handlePositionChange('height', value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visibility and State */}
      <div className="property-group">
        <div className="property-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>可见</label>
            <PropertyEditor
              type="boolean"
              value={component.visible}
              onChange={(value) => onUpdate({ visible: value })}
            />
          </div>
        </div>

        <div className="property-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>启用</label>
            <PropertyEditor
              type="boolean"
              value={component.enabled}
              onChange={(value) => onUpdate({ enabled: value })}
            />
          </div>
        </div>

        <div className="property-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>锁定</label>
            <PropertyEditor
              type="boolean"
              value={component.locked}
              onChange={(value) => onUpdate({ locked: value })}
            />
          </div>
        </div>
      </div>

      {/* Style Properties */}
      {definition && definition.properties.filter(p => p.group === 'style').length > 0 && (
        <div className="property-group">
          <div className="property-group-title">样式</div>
          {definition.properties
            .filter(p => p.group === 'style')
            .map((property) => (
              <div key={property.name} className="property-item">
                <label>{property.label}</label>
                <PropertyEditor
                  type={property.type as any}
                  value={(component.style as any)?.[property.name]}
                  onChange={(value) => handleStyleChange(property.name, value)}
                  options={property.options as string[]}
                />
              </div>
            ))}
        </div>
      )}

      {/* Data Properties */}
      {definition && definition.properties.filter(p => p.group === 'data').length > 0 && (
        <div className="property-group">
          <div className="property-group-title">数据</div>
          {definition.properties
            .filter(p => p.group === 'data')
            .map((property) => (
              <div key={property.name} className="property-item">
                <label>{property.label}</label>
                {property.name === 'src' && component.type === 'hg_image' ? (
                  renderImageProperty(
                    (component.data as any)?.[property.name],
                    (value) => handleDataChange(property.name, value)
                  )
                ) : (
                  <PropertyEditor
                    type={property.type as any}
                    value={(component.data as any)?.[property.name]}
                    onChange={(value) => handleDataChange(property.name, value)}
                    options={property.options as string[]}
                  />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
