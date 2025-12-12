import React from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { isContainerType } from '../../utils/componentUtils';

interface BasePropertiesProps extends PropertyPanelProps {
  disableSize?: boolean;
  sizeTooltip?: string;
  hideParent?: boolean;  // 是否隐藏父对象选择（用于 hg_view 等顶级容器）
  disableParent?: boolean;  // 是否禁用父对象选择（用于 hg_list_item）
}

export const BaseProperties: React.FC<BasePropertiesProps> = ({ 
  component, 
  onUpdate,
  components = [],
  disableSize = false,
  sizeTooltip,
  hideParent = false,
  disableParent = false,
}) => {
  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    // 对于 3D 组件，XY 必须是整数
    let finalValue = value;
    if (component.type === 'hg_3d' && (field === 'x' || field === 'y')) {
      finalValue = Math.round(value);
    }
    
    onUpdate({
      position: {
        ...component.position,
        [field]: finalValue,
      },
    });
  };

  // 获取可选的父容器列表（排除自己和自己的子孙）
  const getAvailableParents = () => {
    const descendants = new Set<string>();
    const findDescendants = (id: string) => {
      components.forEach(c => {
        if (c.parent === id) {
          descendants.add(c.id);
          findDescendants(c.id);
        }
      });
    };
    findDescendants(component.id);

    return components.filter(c => 
      c.id !== component.id && 
      !descendants.has(c.id) &&
      isContainerType(c.type)
    );
  };

  const availableParents = getAvailableParents();
  const currentParent = components.find(c => c.id === component.parent);

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

        {/* 父对象选择 */}
        {!hideParent && (
          <div className="property-item">
            <label>父对象</label>
            <select
              value={component.parent || ''}
              onChange={(e) => onUpdate({ parent: e.target.value || null })}
              disabled={disableParent}
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
              }}
            >
              <option value="">无</option>
              {availableParents.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>
        )}
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
