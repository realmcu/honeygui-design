/**
 * HoneyGUI Designer React Types
 * 定义所有组件的类型和接口
 */

export interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  border?: string;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  
  // 视图组件属性
  overflow?: 'auto' | 'hidden' | 'scroll' | 'visible';
  
  // 窗口组件属性
  title?: string;
  titleBarHeight?: number;
  titleBarColor?: string;
}

export interface ComponentData {
  text?: string;
  src?: string;
  value?: string | number | boolean;
  placeholder?: string;
  options?: string[];
}

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  position: ComponentPosition;
  style?: ComponentStyle;
  data?: ComponentData;
  children?: string[];
  parent?: string | null;
  visible: boolean;
  enabled: boolean;
  locked: boolean;
  zIndex: number;
}

export type ComponentType =
  | 'button'
  | 'label'
  | 'text'
  | 'input'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'slider'
  | 'image'
  | 'panel'
  | 'view'
  | 'window';

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  properties: PropertyDefinition[];
}

export interface PropertyDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'options';
  defaultValue?: any;
  options?: string[] | any[];
  group: 'general' | 'style' | 'data' | 'events';
}

export interface DesignerState {
  components: Component[];
  selectedComponent: string | null;
  hoveredComponent: string | null;
  draggedComponent: string | null;
  zoom: number;
  gridSize: number;
  snapToGrid: boolean;
  canvasOffset: { x: number; y: number };
  canvasSize: { width: number; height: number };
  canvasBackgroundColor: string;
  editingMode: 'select' | 'move' | 'resize';
  undoStack: any[];
  redoStack: any[];
}

export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}
