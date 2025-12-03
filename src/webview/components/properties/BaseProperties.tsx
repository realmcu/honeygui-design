import React from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';

interface BasePropertiesProps extends PropertyPanelProps {
  disableSize?: boolean;
  sizeTooltip?: string;
}

export const BaseProperties: React.FC<BasePropertiesProps> = ({ 
  component, 
  onUpdate,
  disableSize = false,
  sizeTooltip
}) => {
  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    onUpdate({
      position: {
        ...component.position,
        [field]: value,
      },
    });
  };

  return (
    <>
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
                disabled={disableSize}
                title={sizeTooltip}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>高度</label>
              <PropertyEditor
                type="number"
                value={component.position.height}
                onChange={(value) => handlePositionChange('height', value)}
                disabled={disableSize}
                title={sizeTooltip}
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
    </>
  );
};
