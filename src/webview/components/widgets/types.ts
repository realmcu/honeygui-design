import { Component } from '../../types';

/**
 * 控件组件的通用 Props
 */
export interface WidgetProps {
  component: Component;
  style: React.CSSProperties;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };
  children?: React.ReactNode;
}
