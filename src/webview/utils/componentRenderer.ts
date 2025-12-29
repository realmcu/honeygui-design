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
    // 检查是否有子组件超出容器范围
    const hasOverflowingChild = allComponents?.some(c => {
      if (c.parent !== component.id) return false;
      const childRight = c.position.x + c.position.width;
      const childBottom = c.position.y + c.position.height;
      return c.position.x < 0 || c.position.y < 0 || 
             childRight > component.position.width || 
             childBottom > component.position.height;
    });
    
    // 如果有溢出的子组件，在选中模式下显示溢出内容，方便用户操作
    overflowValue = (isDraggingChild || hasChildWithOverflow || (hasOverflowingChild && editingMode === 'select')) 
      ? 'visible' 
      : 'hidden';
  } else if (borderRadiusValue) {
    overflowValue = 'hidden';
  }

  // 拖拽时隐藏原组件（仅非容器组件，顶层会渲染副本）
  const isDragging = draggedComponentId === component.id && !isContainer;

  // 图像变换（仅用于预览，实际效果由 SDK 实现）
  let transformValue: string | undefined;
  if (component.type === 'hg_image' && component.style?.transform) {
    const t = component.style.transform;
    const transforms: string[] = [];
    
    // 平移
    if (t.translateX !== undefined || t.translateY !== undefined) {
      const tx = t.translateX ?? 0;
      const ty = t.translateY ?? 0;
      transforms.push(`translate(${tx}px, ${ty}px)`);
    }
    
    // 缩放
    if (t.scaleX !== undefined || t.scaleY !== undefined) {
      const sx = t.scaleX ?? 1.0;
      const sy = t.scaleY ?? 1.0;
      transforms.push(`scale(${sx}, ${sy})`);
    }
    
    // 旋转
    if (t.rotation !== undefined && t.rotation !== 0) {
      transforms.push(`rotate(${t.rotation}deg)`);
    }
    
    // 倾斜
    if (t.skewX !== undefined && t.skewX !== 0) {
      transforms.push(`skewX(${t.skewX}deg)`);
    }
    if (t.skewY !== undefined && t.skewY !== 0) {
      transforms.push(`skewY(${t.skewY}deg)`);
    }
    
    if (transforms.length > 0) {
      transformValue = transforms.join(' ');
    }
  }

  // 变换中心点
  let transformOriginValue: string | undefined;
  if (component.type === 'hg_image' && component.style?.transform) {
    const t = component.style.transform;
    if (t.focusX !== undefined && t.focusY !== undefined) {
      // 用户显式设置了变换中心
      transformOriginValue = `${t.focusX}px ${t.focusY}px`;
    } else {
      // 默认行为：
      // - 如果只有旋转，使用中心点（模拟 SDK 的 gui_img_rotation 行为）
      // - 如果有缩放，使用左上角（模拟 SDK 的 gui_img_scale 行为）
      const hasScale = (t.scaleX !== undefined && t.scaleX !== 1.0) || (t.scaleY !== undefined && t.scaleY !== 1.0);
      const hasRotation = t.rotation !== undefined && t.rotation !== 0;
      
      if (hasRotation && !hasScale) {
        // 只有旋转：使用中心点
        transformOriginValue = 'center center';
      } else if (hasScale) {
        // 有缩放：使用左上角（SDK 默认行为）
        transformOriginValue = 'top left';
      }
    }
  }

  return {
    position: 'absolute',
    left: component.position.x,
    top: component.position.y,
    width: component.position.width,
    height: component.position.height,
    display: component.visible ? 'flex' : 'none',
    opacity: isDragging ? 0 : (component.style?.transform?.opacity !== undefined ? component.style.transform.opacity / 255 : (component.enabled ? 1 : 0.6)),
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
    transform: transformValue,
    transformOrigin: transformOriginValue,
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
  onMouseDown: (e: React.MouseEvent) => {
    // 只响应鼠标左键
    if (e.button === 0) {
      onMouseDown(e, componentId);
    }
  },
  onMouseEnter,
  onMouseLeave,
  onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, componentId) : undefined,
});
