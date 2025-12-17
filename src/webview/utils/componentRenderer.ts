import { Component } from '../types';

/**
 * 计算组件样式
 */
export const calculateComponentStyle = (
  component: Component,
  zoom: number,
  isSelected: boolean,
  isMultiSelected: boolean,
  isHovered: boolean,
  editingMode: 'select' | 'move' | 'resize',
  isListItem: boolean = false,
  projectConfig?: any
): React.CSSProperties => {
  // List 容器不显示边框
  let border = '1px solid transparent';
  if (component.type === 'hg_list') {
    border = 'none';
  } else if (isListItem && !isSelected && !isMultiSelected) {
    border = '1px dashed rgba(150, 150, 150, 0.5)';
  } else if (isSelected || isMultiSelected) {
    border = '2px solid #007ACC';
  } else if (isHovered) {
    border = '1px dashed #007ACC';
  }
  
  // 计算圆角：hg_view 使用项目配置，其他组件使用自身样式
  // -1 表示圆形（50%），0 表示矩形，>0 表示具体像素值
  let borderRadius: number | undefined;
  if (component.type === 'hg_view') {
    borderRadius = projectConfig?.cornerRadius;
  } else {
    borderRadius = component.style?.borderRadius;
  }
  
  let borderRadiusValue: string | undefined;
  if (borderRadius === -1) {
    borderRadiusValue = '50%';
  } else if (borderRadius && borderRadius > 0) {
    borderRadiusValue = `${borderRadius}px`;
  }

  return {
    position: 'absolute',
    left: component.position.x,
    top: component.position.y,
    width: component.position.width,
    height: component.position.height,
    display: component.visible ? 'flex' : 'none',
    opacity: component.enabled ? 1 : 0.6,
    cursor: editingMode === 'move' ? 'move' : 'pointer',
    border,
    borderRadius: borderRadiusValue,
    overflow: borderRadiusValue ? 'hidden' : undefined,
    background: component.style?.backgroundColor || 'transparent',
    color: component.style?.color || 'inherit',
    fontSize: component.style?.fontSize ? `${component.style.fontSize}px` : undefined,
    zIndex: component.zIndex,
    userSelect: 'none',
  };
};

/**
 * 创建通用的组件事件处理器
 */
export const createComponentHandlers = (
  componentId: string,
  onMouseDown: (e: React.MouseEvent, id: string) => void,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
  onContextMenu?: (e: React.MouseEvent, id: string) => void
) => ({
  onMouseDown: (e: React.MouseEvent) => onMouseDown(e, componentId),
  onMouseEnter,
  onMouseLeave,
  onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, componentId) : undefined,
});
