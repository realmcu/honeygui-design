/**
 * HML组件类型定义
 * 统一格式：与前端保持一致的格式
 */

/**
 * 组件位置类型
 */
export interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 组件样式类型
 */
export interface ComponentStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  border?: string;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  overflow?: string;
  title?: string;
  titleBarHeight?: number;
  titleBarColor?: string;
  [key: string]: any;  // 允许其他样式属性
}

/**
 * 组件数据类型
 */
export interface ComponentData {
  text?: string;
  src?: string;
  value?: string | number | boolean;
  placeholder?: string;
  options?: string[];
  [key: string]: any;  // 允许其他数据属性
}

/**
 * 事件处理器类型（旧版，保留兼容）
 */
export interface ComponentEvents {
  [eventName: string]: string;
}

// 导入 Event-Action 类型
export type { EventConfig, Action, EventType, ActionType } from './eventTypes';

/**
 * 组件类型 - 统一格式（与前端一致）
 */
export interface Component {
  id: string;
  type: string;
  name: string;
  position: ComponentPosition;
  style?: ComponentStyle;
  data?: ComponentData;
  events?: ComponentEvents;
  eventConfigs?: import('./eventTypes').EventConfig[]; // Event-Action 配置
  children?: string[];  // ID引用，避免循环引用
  parent?: string | null;
  visible: boolean;
  enabled: boolean;
  locked: boolean;
  showOverflow?: boolean;  // 在设计器中显示溢出内容
  zIndex: number;
}

/**
 * 元数据类型
 */
export interface Meta {
  title?: string;
  description?: string;
  project?: {
    name?: string;
    appId?: string;
    resolution?: string;
    minSdk?: string;
    pixelMode?: string;
    [key: string]: any;
  };
  author?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
}

/**
 * 视图类型
 */
export interface View {
  id?: string;
  components?: Component[];
}

/**
 * 文档类型
 */
export interface Document {
  meta: Meta;
  view: View;
}
