/**
 * hg_window 事件代码生成器
 * 
 * 与 ViewEventGenerator 的区别：
 * - 不支持视图切换（switchView）
 * - 支持普通事件绑定（onClick, onLongPress 等）
 * - 支持消息订阅（onMessage）
 * - 支持按键事件（onKeyShortPress, onKeyLongPress）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, generateKeyEventCallbackImpl, getMessageCallbackName, generateEventCallbackName } from './EventCodeGenerator';

export class WindowEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs) return '';

    let code = '';
    const indentStr = '    '.repeat(indent);
    const eventTypeIndexMap = new Map<string, number>();
    const keyEventTypeMap = new Map<string, boolean>(); // 记录每种按键事件类型是否已绑定

    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 如果有 handler 属性，直接使用
        if (eventConfig.handler) {
          code += `${indentStr}gui_msg_subscribe((gui_obj_t *)GUI_BASE(${component.id}), "${eventConfig.message}", ${eventConfig.handler});\n`;
        }
        // 否则检查 actions 中的 callFunction
        else {
          eventConfig.actions.forEach(action => {
            if (action.type === 'callFunction' && action.functionName) {
              code += `${indentStr}gui_msg_subscribe((gui_obj_t *)GUI_BASE(${component.id}), "${eventConfig.message}", ${action.functionName});\n`;
            }
          });
        }
        return;
      }

      // 处理按键事件（同一类型只绑定一次）
      if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
        const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
        if (guiEvent && !keyEventTypeMap.has(eventConfig.type)) {
          const keyEventIndex = keyEventTypeMap.size;
          const callbackName = `${component.id}_key_${keyEventIndex}_cb`;
          keyEventTypeMap.set(eventConfig.type, true);
          code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        }
        return;
      }

      // 处理其他事件（onClick, onLongPress 等）
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (guiEvent) {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), ${action.functionName}, ${guiEvent}, NULL);\n`;
          } else if (action.type === 'sendMessage' && action.message) {
            // 生成内联回调发送消息
            const callbackName = `${component.id}_${eventConfig.type}_send_msg`;
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), ${callbackName}, ${guiEvent}, NULL);\n`;
          } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
            const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex);
            eventTypeIndexMap.set(eventConfig.type, currentIndex + 1);
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
          }
        });
      }
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    
    if (!component.eventConfigs) return functions;

    let msgIndex = 0;
    const eventTypeIndexMap = new Map<string, number>();
    const keyEventTypeMap = new Map<string, boolean>(); // 记录每种按键事件类型是否已收集
    
    component.eventConfigs.forEach(eventConfig => {
      // 收集 onMessage 的回调函数名
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 如果有 handler 属性，使用它
        if (eventConfig.handler) {
          functions.push(eventConfig.handler);
        } else {
          // 否则使用自动生成的名称
          functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
        }
        msgIndex++;
        return;
      }

      // 收集按键事件回调函数名（同一类型只收集一次）
      if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
        if (!keyEventTypeMap.has(eventConfig.type)) {
          const keyEventIndex = keyEventTypeMap.size;
          functions.push(`${component.id}_key_${keyEventIndex}_cb`);
          keyEventTypeMap.set(eventConfig.type, true);
        }
        return;
      }

      // 收集其他事件的回调函数名
      eventConfig.actions.forEach(action => {
        if (action.type === 'callFunction' && action.functionName) {
          functions.push(action.functionName);
        } else if (action.type === 'sendMessage' && action.message) {
          functions.push(`${component.id}_${eventConfig.type}_send_msg`);
        } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
          const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
          const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex);
          functions.push(callbackName);
          eventTypeIndexMap.set(eventConfig.type, currentIndex + 1);
        }
      });
    });
    
    return functions;
  }

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }

  getSwitchViewCallbackImpl(_component: Component, _componentMap: Map<string, Component>): string[] {
    // window 不支持视图切换
    return [];
  }

  getControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateControlTimerCallbackImpl(component, componentMap);
  }

  getKeyEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateKeyEventCallbackImpl(component, componentMap);
  }
}
