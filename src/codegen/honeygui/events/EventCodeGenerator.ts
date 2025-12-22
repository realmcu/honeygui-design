/**
 * 事件代码生成器基类接口
 */
import { Component } from '../../../hml/types';

export interface EventCodeGenerator {
  /**
   * 生成事件绑定代码
   */
  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string;

  /**
   * 收集需要生成的回调函数名
   */
  collectCallbackFunctions(component: Component): string[];

  /**
   * 获取 switchView 回调的实现代码（可选）
   */
  getSwitchViewCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];
}

/**
 * 事件类型到 GUI_EVENT 的映射
 */
export const EVENT_TYPE_TO_GUI_EVENT: Record<string, string> = {
  // 触摸事件
  'onClick': 'GUI_EVENT_TOUCH_CLICKED',
  'onLongPress': 'GUI_EVENT_TOUCH_LONG',
  'onTouchDown': 'GUI_EVENT_TOUCH_PRESSED',
  'onTouchUp': 'GUI_EVENT_TOUCH_RELEASED',
  // 滑动事件
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};
