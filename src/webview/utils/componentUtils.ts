import { Component, ComponentType } from '../types';

/**
 * 可包含子组件的容器类型
 */
const CONTAINER_TYPES: ComponentType[] = ['hg_view', 'hg_window', 'hg_canvas', 'hg_list', 'hg_list_item'];

/**
 * 可作为拖放目标的容器类型（用户可拖入子组件）
 */
const DROP_TARGET_TYPES: ComponentType[] = ['hg_view', 'hg_window', 'hg_list_item'];

/**
 * 判断组件类型是否为容器（可包含子组件）
 */
export function isContainerType(type: ComponentType | string): boolean {
  return CONTAINER_TYPES.includes(type as ComponentType);
}

/**
 * 判断组件类型是否可作为拖放目标
 */
export function isDropTargetType(type: ComponentType | string): boolean {
  return DROP_TARGET_TYPES.includes(type as ComponentType);
}

/**
 * 获取组件的绝对位置（相对于画布）
 * 递归计算父组件的位置累加
 */
export const getAbsolutePosition = (
  comp: Component,
  components: Component[]
): { x: number; y: number } => {
  if (!comp.parent) {
    return { x: comp.position.x, y: comp.position.y };
  }
  
  const parentComp = components.find(c => c.id === comp.parent);
  if (!parentComp) {
    return { x: comp.position.x, y: comp.position.y };
  }
  
  const parentPos = getAbsolutePosition(parentComp, components);
  return {
    x: parentPos.x + comp.position.x,
    y: parentPos.y + comp.position.y
  };
};

/**
 * 查找指定位置的目标容器组件
 * 只返回容器类型（hg_view 或 hg_window）
 * 返回最小的包含该位置的容器
 * 当面积相同时，优先选择 z-index 更大或数组位置更靠后的组件
 */
export const findComponentAtPosition = (
  x: number,
  y: number,
  components: Component[]
): Component | null => {
  let targetContainer: Component | null = null;
  let targetArea = Infinity;
  let targetIndex = -1;
  
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    
    // 只查找容器类型
    if (!isContainerType(comp.type)) {
      continue;
    }
    
    const absPos = getAbsolutePosition(comp, components);
    const { width: cw, height: ch } = comp.position;
    
    if (x >= absPos.x && x <= absPos.x + cw && y >= absPos.y && y <= absPos.y + ch) {
      const area = cw * ch;
      
      // 选择面积更小的容器，或面积相同时选择数组位置更靠后的（渲染层级更高）
      if (!targetContainer || area < targetArea || (area === targetArea && i > targetIndex)) {
        targetContainer = comp;
        targetArea = area;
        targetIndex = i;
      }
    }
  }
  
  return targetContainer;
};
