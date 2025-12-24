import { Component } from '../types';
import { isContainerType } from './componentUtils';

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
  projectConfig?: any,
  allComponents?: Component[],
  draggedComponentId?: string | null
): React.CSSProperties => {
  // List 容器不显示边框（除非选中）
  let border = '1px solid transparent';
  if (component.type === 'hg_list') {
    if (isSelected || isMultiSelected) {
      border = '2px solid #007ACC';
    } else {
      border = 'none';
    }
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

  // 容器组件的 overflow 处理
  const isContainer = isContainerType(component.type);
  const isGeometryWidget = ['hg_arc', 'hg_circle', 'hg_rect'].includes(component.type);
  let overflowValue: string | undefined;
  
  if (isContainer) {
    // 拖拽时：如果被拖拽的组件是当前容器的子组件，则 overflow: visible
    const isDraggingChild = draggedComponentId && allComponents?.some(
      c => c.id === draggedComponentId && c.parent === component.id
    );
    // 检查是否有子组件设置了 showOverflow
    const hasChildWithOverflow = allComponents?.some(
      c => c.parent === component.id && c.showOverflow
    );
    overflowValue = (isDraggingChild || hasChildWithOverflow) ? 'visible' : 'hidden';
  } else if (borderRadiusValue) {
    overflowValue = 'hidden';
  }

  // 拖拽时隐藏原组件（仅非容器组件，顶层会渲染副本）
  const isDragging = draggedComponentId === component.id && !isContainer;

  return {
    position: 'absolute',
    left: component.position.x,
    top: component.position.y,
    width: component.position.width,
    height: component.position.height,
    display: component.visible ? 'flex' : 'none',
    opacity: isDragging ? 0 : (component.enabled ? 1 : 0.6),
    cursor: editingMode === 'move' ? 'move' : 'pointer',
    outline: border, // 使用 outline 不占用空间
    outlineOffset: '-1px',
    borderRadius: borderRadiusValue,
    overflow: overflowValue,
    background: component.style?.backgroundColor || 'transparent',
    color: component.style?.color || 'inherit',
    fontSize: component.style?.fontSize ? `${component.style.fontSize}px` : undefined,
    zIndex: component.zIndex,
    userSelect: 'none',
    boxSizing: 'border-box',
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
