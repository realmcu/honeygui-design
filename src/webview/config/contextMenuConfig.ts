import { Component } from '../types';

/**
 * 菜单项定义
 */
export interface MenuItem {
  id: string;
  label: string | ((component: Component) => string);
  icon?: string;
  danger?: boolean;
  dividerAfter?: boolean;
}

/**
 * 菜单项配置（按组件类型）
 */
const menuItemsByType: Record<string, MenuItem[]> = {
  // 图片控件菜单
  hg_image: [
    { id: 'gotoSlot', label: '跳转到槽函数', dividerAfter: true },
    { id: 'lock', label: (c) => c.locked ? '解锁' : '锁定' },
    { id: 'delete', label: '删除', danger: true },
  ],
  
  // 默认菜单（其他控件）
  default: [
    { id: 'lock', label: (c) => c.locked ? '解锁' : '锁定' },
    { id: 'delete', label: '删除', danger: true },
  ],
};

/**
 * 获取组件的菜单项
 */
export function getMenuItems(componentType: string): MenuItem[] {
  return menuItemsByType[componentType] || menuItemsByType.default;
}

/**
 * 获取菜单项的显示文本
 */
export function getMenuItemLabel(item: MenuItem, component: Component): string {
  return typeof item.label === 'function' ? item.label(component) : item.label;
}
