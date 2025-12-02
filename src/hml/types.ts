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
 * 事件处理器类型
 */
export interface ComponentEvents {
  [eventName: string]: string;
}

/**
 * 视图切换事件类型（仅用于 hg_view）
 * 对应 HoneyGUI SDK 的 gui_event_t 枚举
 */
export type ViewSwitchEventType = 
  | 'GUI_EVENT_TOUCH_MOVE_LEFT'
  | 'GUI_EVENT_TOUCH_MOVE_RIGHT'
  | 'GUI_EVENT_TOUCH_MOVE_UP'
  | 'GUI_EVENT_TOUCH_MOVE_DOWN';

/**
 * 视图切换样式（对应 HoneyGUI 的 VIEW_SWITCH_STYLE 枚举）
 */
export type ViewSwitchStyle = string; // 使用字符串类型，值为枚举名称

/**
 * 视图切换配置（用于 hg_view 的 view_switch）
 */
export interface ViewSwitchEvent {
  event: ViewSwitchEventType;
  target: string; // 目标 view 的 id
  switch_out_style: ViewSwitchStyle;
  switch_in_style: ViewSwitchStyle;
}

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
  view_switch?: ViewSwitchEvent[]; // 新增：视图切换配置（仅 hg_view）
  children?: string[];  // ID引用，避免循环引用
  parent?: string | null;
  visible: boolean;
  enabled: boolean;
  locked: boolean;
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
