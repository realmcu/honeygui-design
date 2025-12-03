import React from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { componentDefinitions } from '../ComponentLibrary';

export const DefaultProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  const definition = componentDefinitions.find((d) => d.type === component.type);

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
      <BaseProperties component={component} onUpdate={onUpdate} />

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
