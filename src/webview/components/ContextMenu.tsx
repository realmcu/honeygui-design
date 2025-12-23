import React from 'react';
import { Component } from '../types';
import { getMenuItems, getMenuItemLabel, MenuItem } from '../config/contextMenuConfig';

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  component: Component | null;
  hasClipboard?: boolean;
  multiSelectCount?: number;
  onAction: (actionId: string, component: Component) => void;
}

/**
 * 菜单项组件
 */
const MenuItemComponent: React.FC<{
  item: MenuItem;
  component: Component;
  onClick: () => void;
}> = ({ item, component, onClick }) => {
  const label = getMenuItemLabel(item, component);
  
  return (
    <>
      <div
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '13px',
          color: item.danger ? '#d32f2f' : '#333',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        onClick={onClick}
      >
        {label}
      </div>
      {item.dividerAfter && (
        <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }} />
      )}
    </>
  );
};

/**
 * 右键菜单组件
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  component,
  hasClipboard = false,
  multiSelectCount = 0,
  onAction,
}) => {
  if (!visible || !component) return null;

  const menuItems = getMenuItems(component.type, hasClipboard, multiSelectCount);
  
  // 多选时修改菜单项文本
  const getItemLabel = (item: MenuItem) => {
    const label = getMenuItemLabel(item, component);
    if (multiSelectCount > 1) {
      if (item.id === 'copy') return `复制 ${multiSelectCount} 个组件 (Ctrl+C)`;
      if (item.id === 'cut') return `剪切 ${multiSelectCount} 个组件 (Ctrl+X)`;
    }
    return label;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 10000,
        minWidth: '160px',
        padding: '4px 0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <MenuItemComponent
          key={item.id}
          item={{ ...item, label: getItemLabel(item) }}
          component={component}
          onClick={() => onAction(item.id, component)}
        />
      ))}
    </div>
  );
};
