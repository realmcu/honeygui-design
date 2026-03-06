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

  // 拖拽时提升原组件的 z-index（而不是隐藏并渲染副本）
  const isDragging = draggedComponentId === component.id && !isContainer;
  const draggingZIndex = isDragging ? 9999 : component.zIndex;

  // 图像变换（仅用于预览，实际效果由 SDK 实现）
  let transformValue: string | undefined;
  if ((component.type === 'hg_image' || component.type === 'hg_gif') && component.style?.transform) {
    const t = component.style.transform;
    const transforms: string[] = [];
    
    const hasRotation = t.rotation !== undefined && t.rotation !== 0;
    const hasScale = (t.scaleX !== undefined && t.scaleX !== 1.0) || (t.scaleY !== undefined && t.scaleY !== 1.0);
    const hasSkew = (t.skewX !== undefined && t.skewX !== 0) || (t.skewY !== undefined && t.skewY !== 0);
    const hasFocusX = t.focusX !== undefined;
    const hasFocusY = t.focusY !== undefined;
    const hasFocus = hasFocusX || hasFocusY;
    
    // 预览逻辑：
    // 1. 预览时图片保持在原位置（通过补偿 translate 实现）
    // 2. 代码生成时会添加 translate 来补偿 focus 的偏移
    // 3. 单独缩放不需要 focus，以左上角为基准
    // 4. 只有在有旋转时才应用 focus（单独设置 focus 没有意义）
    
    const { width, height } = component.position;
    
    // 判断是否需要应用 focus（只有旋转或倾斜时才需要）
    const needFocus = hasRotation || hasSkew;
    
    if (needFocus) {
      // 有 focus 设置或有旋转/倾斜
      const focusX = hasFocusX ? t.focusX! : width / 2;
      const focusY = hasFocusY ? t.focusY! : height / 2;
      
      // CSS transform 从右到左执行，所以顺序是：
      
      // 最后：补偿平移 + 用户平移
      // 补偿平移用于抵消 focus 导致的偏移，让预览时图片保持在原位
      let totalTx = focusX; // 补偿 focus 的偏移
      let totalTy = focusY;
      
      // 如果有缩放，补偿值需要乘以缩放系数
      if (hasScale) {
        const scaleX = t.scaleX ?? 1.0;
        const scaleY = t.scaleY ?? 1.0;
        totalTx = focusX * scaleX;
        totalTy = focusY * scaleY;
      }
      
      // 加上用户的平移
      if (t.translateX !== undefined || t.translateY !== undefined) {
        totalTx += (t.translateX ?? 0);
        totalTy += (t.translateY ?? 0);
      }
      
      transforms.push(`translate(${totalTx}px, ${totalTy}px)`);
      
      // 倾斜
      if (hasSkew) {
        const skewX = t.skewX ?? 0;
        const skewY = t.skewY ?? 0;
        transforms.push(`skew(${skewX}deg, ${skewY}deg)`);
      }
      
      // 旋转
      if (hasRotation) {
        transforms.push(`rotate(${t.rotation}deg)`);
      }
      
      // 缩放
      if (hasScale) {
        const scaleX = t.scaleX ?? 1.0;
        const scaleY = t.scaleY ?? 1.0;
        transforms.push(`scale(${scaleX}, ${scaleY})`);
      }
      
      // 最先：focus 导致的偏移（向左上角偏移）
      transforms.push(`translate(${-focusX}px, ${-focusY}px)`);
    } else {
      // 没有 focus 设置，也没有旋转/倾斜，只有缩放和/或平移
      
      // 缩放（以左上角为基准，不产生偏移）
      if (hasScale) {
        const scaleX = t.scaleX ?? 1.0;
        const scaleY = t.scaleY ?? 1.0;
        transforms.push(`scale(${scaleX}, ${scaleY})`);
      }
      
      // 平移
      if (t.translateX !== undefined || t.translateY !== undefined) {
        const tx = t.translateX ?? 0;
        const ty = t.translateY ?? 0;
        transforms.push(`translate(${tx}px, ${ty}px)`);
      }
    }
    
    if (transforms.length > 0) {
      transformValue = transforms.join(' ');
    }
  }

  // 变换中心点
  let transformOriginValue: string | undefined;
  if ((component.type === 'hg_image' || component.type === 'hg_gif') && component.style?.transform) {
    // 固件端的 focus 会导致图片偏移，所以我们使用 translate 来模拟
    // transformOrigin 始终保持在左上角（默认值）
    transformOriginValue = 'top left';
  }

  return {
    position: 'absolute',
    left: component.position.x,
    top: component.position.y,
    width: component.position.width,
    height: component.position.height,
    display: component.visible ? 'flex' : 'none',
    opacity: component.style?.transform?.opacity !== undefined 
      ? component.style.transform.opacity / 255 
      : (component.enabled ? 1 : 0.6),
    cursor: editingMode === 'move' ? 'move' : 'pointer',
    outline: border, // 使用 outline 不占用空间
    outlineOffset: '-1px',
    borderRadius: borderRadiusValue,
    overflow: overflowValue,
    background: component.type === 'hg_window' 
      ? (component.style?.showBackground ? (component.style?.backgroundColor || '#808080') : 'transparent')
      : (component.style?.backgroundColor || 'transparent'),
    color: component.style?.color || 'inherit',
    fontSize: component.style?.fontSize ? `${component.style.fontSize}px` : undefined,
    zIndex: draggingZIndex,
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
  onContextMenu?: (e: React.MouseEvent, id: string) => void,
  onDoubleClick?: (e: React.MouseEvent, id: string) => void
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
  onDoubleClick: onDoubleClick ? (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(e, componentId);
  } : undefined,
});
