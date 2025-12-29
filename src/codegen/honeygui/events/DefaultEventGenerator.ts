/**
 * 默认事件代码生成器（通用组件）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class DefaultEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);
    let msgIndex = 0;

    component.eventConfigs.forEach((eventConfig) => {
      // 处理 onMessage 事件（消息订阅）
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        const callbackName = getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe(${component.id}, "${eventConfig.message}", ${callbackName});\n`;
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
        }
      });
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    if (!component.eventConfigs) return functions;

    let msgIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // onMessage 生成统一回调名
        functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
        msgIndex++;
      } else {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            functions.push(action.functionName);
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
}
