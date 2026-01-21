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
  | 'hg_time_label'
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
  | 'hg_circle'
  | 'hg_rect'
  | 'hg_svg'
  | 'hg_lottie'
  | 'hg_glass';

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
  group: 'general' | 'style' | 'data' | 'events' | 'font' | 'interaction' | 'scroll';
  min?: number;  // 数字类型的最小值
  max?: number;  // 数字类型的最大值
}

// 视图跳转边信息
export interface ViewEdgeInfo {
  target: string;        // 目标 view id
  event: string;         // 事件类型 (onSwipeLeft 等)
  switchOutStyle?: string;
  switchInStyle?: string;
}

// 项目中的视图信息（包含跳转关系）
export interface ViewInfo {
  id: string;
  name: string;
  file: string;          // 所属设计目录名
  edges: ViewEdgeInfo[]; // 该视图的所有跳转
}

export interface DesignerState {
  components: Component[];
  allViews?: ViewInfo[]; // 项目中所有 view（含跳转关系）
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
  assetCategory: 'all' | 'images' | 'svgs' | 'videos' | 'models' | 'fonts' | 'glass'; // 资源面板分类
  isSimulationRunning: boolean; // 仿真运行状态
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
