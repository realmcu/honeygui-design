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

  /**
   * 获取 onMessage 回调的实现代码（可选）
   */
  getMessageCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];
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

/**
 * 生成 onMessage 回调实现的公共函数
 */
export function generateMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
  const impls: string[] = [];
  if (!component.eventConfigs) return impls;

  component.eventConfigs.forEach(eventConfig => {
    if (eventConfig.type !== 'onMessage' || !eventConfig.message) return;

    const callbackName = `${component.id}_on_msg_${eventConfig.message.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let body = '';

    eventConfig.actions.forEach(action => {
      if (action.type === 'callFunction' && action.functionName) {
        body += `    ${action.functionName}(obj, topic, data, len);\n`;
      } else if (action.type === 'switchView' && action.target) {
        const targetComponent = componentMap.get(action.target);
        const targetName = targetComponent?.name || action.target;
        const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
        const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
        body += `    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
      } else if (action.type === 'sendMessage' && action.message) {
        body += `    gui_msg_publish("${action.message}", data, len);\n`;
      }
    });

    if (body) {
      impls.push(`void ${callbackName}(gui_obj_t *obj, const char *topic, void *data, uint16_t len)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(topic);
    GUI_UNUSED(data);
    GUI_UNUSED(len);
${body}}`);
    }
  });

  return impls;
}
