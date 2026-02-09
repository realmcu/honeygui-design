/**
 * hg_window 事件代码生成器
 * 
 * 与 ViewEventGenerator 的区别：
 * - 不支持视图切换（switchView）
 * - 支持普通事件绑定（onClick, onLongPress 等）
 * - 支持消息订阅（onMessage）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class WindowEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs) return '';

    let code = '';
    const indentStr = '    '.repeat(indent);
    let controlTimerIndex = 0;

    component.eventConfigs.forEach(eventConfig => {
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      
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
      }
      // 处理其他事件（onClick, onLongPress 等）
      else if (guiEvent) {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), ${action.functionName}, ${guiEvent}, NULL);\n`;
          } else if (action.type === 'sendMessage' && action.message) {
            // 生成内联回调发送消息
            const callbackName = `${component.id}_${eventConfig.type}_send_msg`;
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), ${callbackName}, ${guiEvent}, NULL);\n`;
          } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            const callbackName = `${component.id}_animation_set_${controlTimerIndex}_cb`;
            controlTimerIndex++;
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
    let controlTimerIndex = 0;
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
      }
      // 收集其他事件的回调函数名
      else {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            functions.push(action.functionName);
          } else if (action.type === 'sendMessage' && action.message) {
            functions.push(`${component.id}_${eventConfig.type}_send_msg`);
          } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            functions.push(`${component.id}_animation_set_${controlTimerIndex}_cb`);
            controlTimerIndex++;
          }
        });
      }
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
}
