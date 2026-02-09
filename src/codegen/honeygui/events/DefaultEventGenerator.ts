/**
 * 默认事件代码生成器（通用组件）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class DefaultEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);
    let msgIndex = 0;
    let controlTimerIndex = 0;

    component.eventConfigs.forEach((eventConfig) => {
      // 处理 onMessage 事件（消息订阅）
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        const callbackName = eventConfig.handler || getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe((gui_obj_t *)${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        return;
      }

      // 处理其他事件
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach((action) => {
        if (action.type === 'callFunction' && action.functionName) {
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${action.functionName}, ${guiEvent}, NULL);\n`;
        } else if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          code += `${indentStr}gui_obj_event_set(${component.id}, ${guiEvent});\n`;
          code += `${indentStr}gui_obj_click(${component.id}, (gui_event_cb_t)gui_switch_app, (void *)"${targetName}");\n`;
        } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
          const callbackName = `${component.id}_animation_set_${controlTimerIndex}_cb`;
          controlTimerIndex++;
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        }
      });
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    if (!component.eventConfigs) return functions;

    let msgIndex = 0;
    let controlTimerIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        if (eventConfig.handler) {
          functions.push(eventConfig.handler);
        } else {
          functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
        }
        msgIndex++;
      } else {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            functions.push(action.functionName);
          } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            functions.push(`${component.id}_animation_set_${controlTimerIndex}_cb`);
            controlTimerIndex++;
          }
        });
      }
    });

    return functions;
  }

  /**
   * 生成 onMessage 回调实现
   */
  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }

  /**
   * 生成 controlTimer 回调实现
   */
  getControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateControlTimerCallbackImpl(component, componentMap);
  }
}
