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
  editingMode: 'select' | 'move' | 'resize'
): React.CSSProperties => {
  return {
    position: 'absolute',
    left: component.position.x * zoom,
    top: component.position.y * zoom,
    width: component.position.width * zoom,
    height: component.position.height * zoom,
    display: component.visible ? 'flex' : 'none',
    opacity: component.enabled ? 1 : 0.6,
    cursor: editingMode === 'move' ? 'move' : 'pointer',
    border: isSelected || isMultiSelected 
      ? '2px solid #007ACC' 
      : isHovered 
        ? '1px dashed #007ACC' 
        : '1px solid transparent',
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
