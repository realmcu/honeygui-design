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
 * 图像变换类型
 */
export interface ImageTransform {
  // 缩放
  scaleX?: number;      // 默认 1.0
  scaleY?: number;      // 默认 1.0
  
  // 旋转
  rotation?: number;    // 角度，默认 0
  
  // 平移
  translateX?: number;  // 默认 0
  translateY?: number;  // 默认 0
  
  // 倾斜
  skewX?: number;       // 角度，默认 0
  skewY?: number;       // 角度，默认 0
  
  // 变换中心点
  // 注意：SDK 默认行为不一致
  // - 旋转默认围绕图片中心
  // - 缩放默认以 (0,0) 为中心
  // 设置 focusX/focusY 可统一变换中心
  focusX?: number;      // 默认：旋转用图片中心，缩放用左上角
  focusY?: number;      // 默认：旋转用图片中心，缩放用左上角
  
  // 透明度
  opacity?: number;     // 0-255，默认 255
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
  
  // 图像变换（用于 hg_image 组件）
  transform?: ImageTransform;
  
  [key: string]: any;  // 允许其他样式属性
}

/**
 * 定时器动作类型
 */
export interface TimerAction {
  type: 'size' | 'position' | 'opacity';
  // 大小动作
  fromW?: number;
  fromH?: number;
  toW?: number;
  toH?: number;
  // 位置动作
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  // 透明度动作
  from?: number;
  to?: number;
}

/**
 * 定时器配置类型
 */
export interface TimerConfig {
  id: string;  // 定时器唯一标识
  name?: string;  // 定时器名称（用于注释）
  enabled: boolean;  // 是否绑定到组件（只有一个可以为 true）
  interval: number;  // 定时器间隔（毫秒）
  reload: boolean;  // 是否重复执行
  mode: 'preset' | 'custom';  // 定时器模式：预设动作或自定义函数
  actions?: TimerAction[];  // 预设动作列表
  callback?: string;  // 自定义回调函数名
  duration?: number;  // 总时间（毫秒）
  stopOnComplete?: boolean;  // 到达总时间后是否停止定时器
  delayStart?: number;  // 延时启动时间（毫秒），默认 0
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
  timeFormat?: string;  // 时间格式（用于 label 组件自动更新时间）
  residentMemory?: boolean;  // 常驻内存属性（用于 hg_view 组件）
  animateStep?: number;  // 动画步长（用于 hg_view 组件）
  opacity?: number;  // 透明度 0-255（用于 hg_view 组件）
  
  // 定时器配置（新版：支持多个定时器）
  timers?: TimerConfig[];  // 定时器列表
  
  // 定时器配置（旧版：保留兼容，将在加载时转换为新版）
  timerEnabled?: boolean;  // 是否启用定时器
  timerInterval?: number;  // 定时器间隔（毫秒）
  timerReload?: boolean;  // 是否重复执行
  timerMode?: 'preset' | 'custom';  // 定时器模式：预设动作或自定义函数
  timerActions?: TimerAction[];  // 预设动作列表
  timerCallback?: string;  // 自定义回调函数名
  timerDuration?: number;  // 总时间（毫秒）
  timerStopOnComplete?: boolean;  // 到达总时间后是否停止定时器
  
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
