/**
 * HML组件类型定义
 */

/**
 * 组件属性类型
 */
export interface ComponentProperties {
  [key: string]: any;
}

/**
 * 事件处理器类型
 */
export interface ComponentEvents {
  [eventName: string]: string;
}

/**
 * 组件类型
 */
export interface Component {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties: ComponentProperties;
  events?: ComponentEvents;
  parentId?: string;
  children?: Component[];
}

/**
 * 元数据类型
 */
export interface Meta {
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  project?: any;
  author?: any;
  // 原始HML格式的属性
  id?: string;              // hml标签的id属性
  appId?: string;           // APP ID
  resolution?: string;      // 分辨率
  minSdk?: string;          // 最小SDK版本
  pixelMode?: string;       // 像素模式
}

/**
 * 视图类型
 */
export interface View {
  id?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  components?: Component[];
  root?: Component;
}

/**
 * 文档类型
 */
export interface Document {
  meta: Meta;
  view: View;
  components?: Component[];
}
