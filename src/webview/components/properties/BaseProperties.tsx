import React, { useState, useEffect, useCallback } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { isContainerType } from '../../utils/componentUtils';
import { validateComponentId } from '../../utils/validation';
import { useDesignerStore } from '../../store';
import { t } from '../../i18n';
import { TimerAction, TimerConfig } from '../../../hml/types';

interface BasePropertiesProps extends PropertyPanelProps {
  disableSize?: boolean;
  sizeTooltip?: string;
  disablePosition?: boolean;  // 是否禁用 x/y 编辑（固定为 0）
  positionTooltip?: string;   // x/y 禁用时的提示文字
  hideParent?: boolean;  // 是否隐藏父对象选择（用于 hg_view 等顶级容器）
  disableParent?: boolean;  // 是否禁用父对象选择（用于 hg_list_item）
  children?: React.ReactNode;  // 允许插入自定义内容
}

export const BaseProperties: React.FC<BasePropertiesProps> = ({ 
  component, 
  onUpdate,
  components = [],
  disableSize = false,
  sizeTooltip,
  disablePosition = false,
  positionTooltip,
  hideParent = false,
  disableParent = false,
  children,
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
    if (comp.type === 'hg_view') {
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

  // 获取 moveComponent 函数
  const moveComponent = useDesignerStore(state => state.moveComponent);

  // 处理父对象变更
  const handleParentChange = useCallback((newParentId: string | null) => {
    if (newParentId === component.parent) return;
    moveComponent(component.id, newParentId);
  }, [component.id, component.parent, moveComponent]);

  // ID 编辑状态
  const [editingId, setEditingId] = useState(component.id);
  const [idError, setIdError] = useState<string | null>(null);
  const renameComponent = useDesignerStore(state => state.renameComponent);
  
  // 保存当前正在编辑的组件 ID（用于确保修改应用到正确的组件）
  const editingComponentIdRef = React.useRef(component.id);

  // 组件切换时重置编辑状态
  useEffect(() => {
    // 如果组件切换了，先提交之前的更改
    if (editingComponentIdRef.current !== component.id && editingId !== editingComponentIdRef.current) {
      handleIdCommit();
    }
    
    setEditingId(component.id);
    setIdError(null);
    editingComponentIdRef.current = component.id;
  }, [component.id]);

  const handleIdChange = (value: string) => {
    setEditingId(value);
    
    // 实时校验
    const allIds = components.map(c => c.id);
    const result = validateComponentId(value, allIds, editingComponentIdRef.current);
    setIdError(result.valid ? null : result.error || null);
  };

  const handleIdCommit = () => {
    const originalId = editingComponentIdRef.current;
    if (editingId === originalId) return; // 没有变化
    if (idError) {
      // 校验失败，恢复原值
      setEditingId(originalId);
      setIdError(null);
      return;
    }
    
    // 执行重命名（使用保存的原始 ID）
    const success = renameComponent(originalId, editingId);
    if (!success) {
      setEditingId(originalId);
      setIdError(t('Rename failed'));
    } else {
      // 更新引用为新的 ID
      editingComponentIdRef.current = editingId;
    }
  };

  const handleIdBlur = () => {
    handleIdCommit();
  };

  return (
    <>
      {/* Name (ID) */}
      <div className="property-group">
        <div className="property-item">
          <label>{t('Name')}</label>
          <input
            type="text"
            value={editingId}
            onChange={(e) => handleIdChange(e.target.value)}
            onBlur={handleIdBlur}
            onKeyDown={(e) => { 
              if (e.key === 'Enter') {
                e.preventDefault();
                handleIdCommit();
              }
            }}
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

        {/* Parent selection */}
        {!hideParent && (
          <div className="property-item">
            <label>{t('Parent')}</label>
            <select
              value={component.parent || ''}
              onChange={(e) => handleParentChange(e.target.value || null)}
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
              <option value="">{t('None')}</option>
              {/* If current parent is not in available list, show it anyway */}
              {currentParent && !availableParents.find(p => p.id === currentParent.id) && (
                <option key={currentParent.id} value={currentParent.id}>
                  {currentParent.name} ({currentParent.type})
                </option>
              )}
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
          <label>{t('Position & Size')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X</label>
              <PropertyEditor
                type="number"
                value={component.position.x}
                onChange={(value) => handlePositionChange('x', value)}
                disabled={disablePosition}
                title={positionTooltip}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y</label>
              <PropertyEditor
                type="number"
                value={component.position.y}
                onChange={(value) => handlePositionChange('y', value)}
                disabled={disablePosition}
                title={positionTooltip}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>{t('Width')}</label>
              <PropertyEditor
                type="number"
                value={component.position.width}
                onChange={(value) => handlePositionChange('width', value)}
                disabled={disableSize}
                title={sizeTooltip}
                min={0}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>{t('Height')}</label>
              <PropertyEditor
                type="number"
                value={component.position.height}
                onChange={(value) => handlePositionChange('height', value)}
                disabled={disableSize}
                title={sizeTooltip}
                min={0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visibility and State */}
      <div className="property-group">
        <div className="property-item">
          <label>{t('State')}</label>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PropertyEditor
                type="boolean"
                value={component.visible}
                onChange={(value) => onUpdate({ visible: value })}
              />
              <span style={{ fontSize: '12px' }}>{t('Visible')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PropertyEditor
                type="boolean"
                value={component.enabled}
                onChange={(value) => onUpdate({ enabled: value })}
              />
              <span style={{ fontSize: '12px' }}>{t('Enabled')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PropertyEditor
                type="boolean"
                value={component.locked}
                onChange={(value) => onUpdate({ locked: value })}
              />
              <span style={{ fontSize: '12px' }}>{t('Locked')}</span>
            </div>
          </div>
        </div>

        {/* Show overflow toggle for non-top-level containers */}
        {['hg_list', 'hg_canvas', 'hg_list_item'].includes(component.type) && (
          <div className="property-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>{t('Show Overflow')}</label>
              <PropertyEditor
                type="boolean"
                value={component.showOverflow ?? false}
                onChange={(value) => onUpdate({ showOverflow: value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* 插入自定义内容 */}
      {children}
    </>
  );
};
