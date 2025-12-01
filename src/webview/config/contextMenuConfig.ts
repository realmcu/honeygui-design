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
 * 通用菜单项
 */
const commonMenuItems: MenuItem[] = [
  { id: 'gotoSlot', label: '跳转到槽函数', dividerAfter: true },
  { id: 'lock', label: (c) => c.locked ? '解锁' : '锁定' },
  { id: 'delete', label: '删除', danger: true },
];

/**
 * 菜单项配置（按组件类型）
 * 如果没有特定配置，使用通用菜单
 */
const menuItemsByType: Record<string, MenuItem[]> = {
  // 可以为特定组件类型定义不同的菜单
  // hg_button: [...commonMenuItems, { id: 'editText', label: '编辑文本' }],
};

/**
 * 获取组件的菜单项
 */
export function getMenuItems(componentType: string): MenuItem[] {
  return menuItemsByType[componentType] || commonMenuItems;
}

/**
 * 获取菜单项的显示文本
 */
export function getMenuItemLabel(item: MenuItem, component: Component): string {
  return typeof item.label === 'function' ? item.label(component) : item.label;
}
