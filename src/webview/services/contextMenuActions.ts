import { Component } from '../types';

/**
 * 菜单动作处理器类型
 */
export type MenuActionHandler = (
  component: Component,
  helpers: MenuActionHelpers
) => void;

/**
 * 菜单动作辅助函数
 */
export interface MenuActionHelpers {
  updateComponent: (id: string, updates: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  postMessage: (message: any) => void;
}

/**
 * 菜单动作处理器映射
 */
const actionHandlers: Record<string, MenuActionHandler> = {
  gotoSlot: (component, { postMessage }) => {
    postMessage({
      command: 'gotoSlot',
      componentId: component.id,
      componentType: component.type,
      componentName: component.name || component.id,
    });
  },

  delete: (component, { removeComponent, selectComponent }) => {
    removeComponent(component.id);
    selectComponent(null);
  },

  lock: (component, { updateComponent }) => {
    updateComponent(component.id, { locked: !component.locked });
  },

  duplicate: (component, helpers) => {
    // TODO: 实现复制功能
    console.log('Duplicate not implemented yet', component.id);
  },
};

/**
 * 执行菜单动作
 */
export function executeMenuAction(
  actionId: string,
  component: Component,
  helpers: MenuActionHelpers
): void {
  const handler = actionHandlers[actionId];
  if (handler) {
    handler(component, helpers);
  } else {
    console.warn(`Unknown menu action: ${actionId}`);
  }
}
