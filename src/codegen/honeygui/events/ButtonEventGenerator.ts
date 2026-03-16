/**
 * hg_button 事件代码生成器
 * 双态按钮的 onClick 事件不单独绑定（toggle_cb 已占用 GUI_EVENT_TOUCH_CLICKED），
 * 而是将 onClick actions 合并进 toggle_cb 中统一执行。
 */
import { Component } from '../../../hml/types';
import { DefaultEventGenerator } from './DefaultEventGenerator';
import { EVENT_TYPE_TO_GUI_EVENT, getMessageCallbackName } from './EventCodeGenerator';

export class ButtonEventGenerator extends DefaultEventGenerator {

  /**
   * 双态模式下跳过 onClick 的独立绑定（toggle_cb 已处理 GUI_EVENT_TOUCH_CLICKED）
   */
  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    const isToggle = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!isToggle) {
      return super.generateEventBindings(component, indent, componentMap);
    }

    // 双态模式：跳过 onClick，其余事件正常绑定
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);
    let msgIndex = 0;
    const eventTypeMap = new Map<string, boolean>();

    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        const callbackName = eventConfig.handler || getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe((gui_obj_t *)${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        return;
      }

      // 双态模式下跳过 onClick（已由 toggle_cb 处理）
      if (isToggle && eventConfig.type === 'onClick') {
        return;
      }

      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      if (!eventTypeMap.has(eventConfig.type)) {
        const callbackName = this.getCallbackName(component.id, eventConfig.type);
        code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        eventTypeMap.set(eventConfig.type, true);
      }
    });

    return code;
  }

  /**
   * 双态模式下跳过 onClick 的回调实现（actions 已合并进 toggle_cb）
   */
  getEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const isToggle = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!isToggle) {
      return super.getEventCallbackImpl(component, componentMap);
    }

    // 双态模式：过滤掉 onClick，其余事件正常生成
    const filtered = { ...component, eventConfigs: (component.eventConfigs || []).filter(e => e.type !== 'onClick') };
    return super.getEventCallbackImpl(filtered as Component, componentMap);
  }

  collectCallbackFunctions(component: Component): string[] {
    const isToggle = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!isToggle) {
      return super.collectCallbackFunctions(component);
    }

    // 双态模式：过滤掉 onClick
    const filtered = { ...component, eventConfigs: (component.eventConfigs || []).filter(e => e.type !== 'onClick') };
    return super.collectCallbackFunctions(filtered as Component);
  }

  private getCallbackName(componentId: string, eventType: string): string {
    const suffixMap: Record<string, string> = {
      'onLongPress': 'long_pressed',
      'onTouchDown': 'pressed',
      'onTouchUp': 'released',
      'onKeyShortPress': 'key',
      'onKeyLongPress': 'key_long',
      'onSwipeLeft': 'swiped_left',
      'onSwipeRight': 'swiped_right',
      'onSwipeUp': 'swiped_up',
      'onSwipeDown': 'swiped_down',
    };
    const suffix = suffixMap[eventType] || 'event';
    return `${componentId}_${suffix}_cb`;
  }
}
