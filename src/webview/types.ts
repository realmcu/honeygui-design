/**
 * HoneyGUI Designer React Types
 * 定义所有组件的类型和接口
 */

import type {
  Component as HmlComponent,
  ComponentPosition as HmlComponentPosition,
  ComponentStyle as HmlComponentStyle,
  ComponentData as HmlComponentData
} from '../hml/types';

export type ComponentPosition = HmlComponentPosition;
export type ComponentStyle = HmlComponentStyle;
export type ComponentData = HmlComponentData;

export type Component = Omit<HmlComponent, 'type'> & { type: ComponentType };

export type ComponentType =
  | 'hg_button'
  | 'hg_label'
  | 'hg_text'
  | 'hg_input'
  | 'hg_textarea'
  | 'hg_checkbox'
  | 'hg_radio'
  | 'hg_switch'
  | 'hg_slider'
  | 'hg_image'
  | 'hg_view'
  | 'hg_window'
  | 'hg_canvas'
  | 'hg_list'
  | 'hg_list_item'
  | 'hg_video'
  | 'hg_3d'
  | 'hg_arc'
  | 'hg_rect'
  | 'hg_svg'
  | 'hg_lottie';

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
  allViews?: Array<{id: string, name: string, file: string}>; // 项目中所有 view
  allHmlFiles?: Array<{path: string, name: string, relativePath: string}>; // 项目中所有 HML 文件
  currentFilePath?: string; // 当前打开的文件路径
  selectedComponent: string | null;
  selectedComponents: string[];
  hoveredComponent: string | null;
  draggedComponent: string | null;
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasSize: { width: number; height: number };
  canvasBackgroundColor: string;
  editingMode: 'select' | 'move' | 'resize';
  undoStack: any[];
  redoStack: any[];
  projectConfig?: any; // Project configuration (resolution, etc.)
  assetCategory: 'all' | 'images' | 'videos' | 'models' | 'fonts'; // 资源面板分类
}

export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
    vscodeAPI?: VSCodeAPI;
  }
}

/**
 * 资源文件类型定义
 */
export interface AssetFile {
  name: string;
  path: string;
  relativePath?: string; // 相对于 assets 目录的路径
  type: 'image' | 'font' | 'model3d' | 'folder';
  size: number;
  children?: AssetFile[]; // 文件夹的子项
}
