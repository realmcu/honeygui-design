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
  { id: 'copy', label: '复制 (Ctrl+C)' },
  { id: 'cut', label: '剪切 (Ctrl+X)' },
  { id: 'paste', label: '粘贴 (Ctrl+V)' },
  { id: 'duplicate', label: '快速复制 (Ctrl+D)', dividerAfter: true },
  // 对齐菜单（多选时显示）
  { id: 'alignLeft', label: '左对齐 (Ctrl+Shift+L)' },
  { id: 'alignRight', label: '右对齐 (Ctrl+Shift+R)' },
  { id: 'alignTop', label: '顶对齐 (Ctrl+Shift+T)' },
  { id: 'alignBottom', label: '底对齐 (Ctrl+Shift+B)' },
  { id: 'alignCenterH', label: '水平居中 (Ctrl+Shift+H)' },
  { id: 'alignCenterV', label: '垂直居中', dividerAfter: true },
  { id: 'bringToFront', label: '置于顶层' },
  { id: 'sendToBack', label: '置于底层' },
  { id: 'bringForward', label: '上移一层' },
  { id: 'sendBackward', label: '下移一层', dividerAfter: true },
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
export function getMenuItems(
  componentType: string, 
  hasClipboard: boolean = false,
  multiSelectCount: number = 1
): MenuItem[] {
  const items = menuItemsByType[componentType] || commonMenuItems;
  
  return items.filter(item => {
    // 如果剪贴板为空，过滤掉"粘贴"菜单项
    if (item.id === 'paste' && !hasClipboard) {
      return false;
    }
    
    // 对齐菜单项只在多选时显示
    const alignItems = ['alignLeft', 'alignRight', 'alignTop', 'alignBottom', 'alignCenterH', 'alignCenterV'];
    if (alignItems.includes(item.id) && multiSelectCount < 2) {
      return false;
    }
    
    return true;
  });
}

/**
 * 获取菜单项的显示文本
 */
export function getMenuItemLabel(item: MenuItem, component: Component): string {
  return typeof item.label === 'function' ? item.label(component) : item.label;
}
