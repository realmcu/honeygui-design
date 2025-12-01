import { useState, useCallback, useEffect } from 'react';
import { Component } from '../types';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  component: Component | null;
}

/**
 * 右键菜单 Hook
 * 管理右键菜单的状态和行为
 */
export function useContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    component: null,
  });

  /**
   * 显示右键菜单
   */
  const showMenu = useCallback((e: React.MouseEvent, component: Component) => {
    e.preventDefault();
    e.stopPropagation();
    
    setMenuState({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      component,
    });
  }, []);

  /**
   * 关闭右键菜单
   */
  const hideMenu = useCallback(() => {
    setMenuState(prev => ({ ...prev, visible: false, component: null }));
  }, []);

  /**
   * 点击其他地方关闭菜单
   */
  useEffect(() => {
    if (!menuState.visible) return;
    
    const handleClick = () => hideMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideMenu();
    };
    
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState.visible, hideMenu]);

  return {
    menuState,
    showMenu,
    hideMenu,
  };
}
