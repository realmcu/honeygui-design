import { Component, ComponentType } from '../types';

/**
 * 判断组件类型是否为容器
 * 只有 hg_view 和 hg_window 可以包含子组件
 */
export function isContainerType(type: ComponentType): boolean {
  return type === 'hg_view' || type === 'hg_window';
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
 */
export const findComponentAtPosition = (
  x: number,
  y: number,
  components: Component[]
): Component | null => {
  let targetContainer: Component | null = null;
  
  for (const comp of components) {
    // 只查找容器类型
    if (!isContainerType(comp.type)) {
      continue;
    }
    
    const absPos = getAbsolutePosition(comp, components);
    const { width: cw, height: ch } = comp.position;
    
    if (x >= absPos.x && x <= absPos.x + cw && y >= absPos.y && y <= absPos.y + ch) {
      if (!targetContainer || (cw * ch < targetContainer.position.width * targetContainer.position.height)) {
        targetContainer = comp;
      }
    }
  }
  
  return targetContainer;
};
