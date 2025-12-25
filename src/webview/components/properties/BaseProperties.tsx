import React, { useState, useEffect } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { isContainerType } from '../../utils/componentUtils';
import { validateComponentId } from '../../utils/validation';
import { useDesignerStore } from '../../store';

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

  // 获取当前组件所属的根 hg_view
  const getRootView = (comp: typeof component): typeof component | null => {
    if (comp.type === 'hg_view' || comp.type === 'hg_window') {
      return comp;
    }
    if (comp.parent) {
      const parent = components.find(c => c.id === comp.parent);
      if (parent) {
        return getRootView(parent);
      }
    }
    return null;
  };

  // 获取可选的父容器列表（只限当前 hg_view 内的容器，排除自己和自己的子孙）
  const getAvailableParents = () => {
    const rootView = getRootView(component);
    if (!rootView) return [];

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

    // 获取当前 view 下的所有组件
    const viewComponents = new Set<string>();
    const collectViewComponents = (id: string) => {
      viewComponents.add(id);
      components.forEach(c => {
        if (c.parent === id) {
          collectViewComponents(c.id);
        }
      });
    };
    collectViewComponents(rootView.id);

    return components.filter(c => 
      c.id !== component.id && 
      !descendants.has(c.id) &&
      viewComponents.has(c.id) &&
      isContainerType(c.type)
    );
  };

  const availableParents = getAvailableParents();
  const currentParent = components.find(c => c.id === component.parent);

  // ID 编辑状态
  const [editingId, setEditingId] = useState(component.id);
  const [idError, setIdError] = useState<string | null>(null);
  const renameComponent = useDesignerStore(state => state.renameComponent);

  // 组件切换时重置编辑状态
  useEffect(() => {
    setEditingId(component.id);
    setIdError(null);
  }, [component.id]);

  const handleIdChange = (value: string) => {
    setEditingId(value);
    // 实时校验
    const allIds = components.map(c => c.id);
    const result = validateComponentId(value, allIds, component.id);
    setIdError(result.valid ? null : result.error || null);
  };

  const handleIdBlur = () => {
    if (editingId === component.id) return; // 没有变化
    if (idError) {
      // 校验失败，恢复原值
      setEditingId(component.id);
      setIdError(null);
      return;
    }
    // 执行重命名
    const success = renameComponent(component.id, editingId);
    if (!success) {
      setEditingId(component.id);
      setIdError('重命名失败');
    }
  };

  return (
    <>
      {/* 名称（即 ID） */}
      <div className="property-group">
        <div className="property-item">
          <label>名称</label>
          <input
            type="text"
            value={editingId}
            onChange={(e) => handleIdChange(e.target.value)}
            onBlur={handleIdBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleIdBlur(); }}
            style={{
              width: '100%',
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: idError 
                ? '1px solid var(--vscode-inputValidation-errorBorder, #f44)' 
                : '1px solid var(--vscode-input-border)',
              borderRadius: '2px',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}
          />
          {idError && (
            <div style={{ 
              color: 'var(--vscode-inputValidation-errorForeground, #f44)', 
              fontSize: '11px', 
              marginTop: '4px' 
            }}>
              {idError}
            </div>
          )}
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

        {/* 只为非顶层容器（hg_list、hg_canvas、hg_list_item）显示超出父容器开关 */}
        {['hg_list', 'hg_canvas', 'hg_list_item'].includes(component.type) && (
          <div className="property-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>超出父容器</label>
              <PropertyEditor
                type="boolean"
                value={component.showOverflow ?? false}
                onChange={(value) => onUpdate({ showOverflow: value })}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
