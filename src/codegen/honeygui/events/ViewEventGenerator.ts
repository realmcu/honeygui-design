/**
 * hg_view 事件代码生成器
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, generateKeyEventCallbackImpl, getMessageCallbackName, generateEventCallbackName } from './EventCodeGenerator';

export class ViewEventGenerator implements EventCodeGenerator {

  /**
   * 生成 switch_in 中的视图切换事件
   */
  generateSwitchViewEvents(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs) return '';

    let code = '';
    const indentStr = '    '.repeat(indent);

    component.eventConfigs.forEach(eventConfig => {
      // onMessage 在 generateEventBindings 中处理
      if (eventConfig.type === 'onMessage') return;

      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
          const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
          code += `${indentStr}gui_view_switch_on_event(view, "${targetName}", ${switchOutStyle}, ${switchInStyle}, ${guiEvent});\n`;
        }
      });
    });

    return code;
  }

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs) return '';

    let code = '';
    const indentStr = '    '.repeat(indent);
    
    // 为每个事件类型维护独立的索引
    const eventTypeIndexMap = new Map<string, number>();
    const keyEventTypeMap = new Map<string, boolean>(); // 记录每种按键事件类型是否已绑定

    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 如果有 handler 属性，直接使用
        if (eventConfig.handler) {
          code += `${indentStr}gui_msg_subscribe((gui_obj_t *)${component.id}, "${eventConfig.message}", ${eventConfig.handler});\n`;
        }
        // 否则检查 actions 中的 callFunction
        else {
          eventConfig.actions.forEach(action => {
            if (action.type === 'callFunction' && action.functionName) {
              code += `${indentStr}gui_msg_subscribe((gui_obj_t *)${component.id}, "${eventConfig.message}", ${action.functionName});\n`;
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

      // 处理 controlTimer 事件
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (guiEvent) {
        const controlTimerActions = eventConfig.actions.filter(a => 
          a.type === 'controlTimer' && a.timerTargets && a.timerTargets.length > 0
        );
        
        if (controlTimerActions.length > 0) {
          const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
          
          controlTimerActions.forEach((_, actionIndex) => {
            const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex + actionIndex);
            code += `${indentStr}gui_obj_add_event_cb(GUI_BASE(${component.id}), (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
          });
          
          eventTypeIndexMap.set(eventConfig.type, currentIndex + controlTimerActions.length);
        }
      }
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    
    // 收集 onMessage 的回调函数名
    if (component.eventConfigs) {
      let msgIndex = 0;
      const eventTypeIndexMap = new Map<string, number>();
      const keyEventTypeMap = new Map<string, boolean>(); // 记录每种按键事件类型是否已收集
      
      component.eventConfigs.forEach(eventConfig => {
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

        // 收集按键事件回调函数名（同一类型只收集一次）
        if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
          if (!keyEventTypeMap.has(eventConfig.type)) {
            const keyEventIndex = keyEventTypeMap.size;
            functions.push(`${component.id}_key_${keyEventIndex}_cb`);
            keyEventTypeMap.set(eventConfig.type, true);
          }
        }

        // 收集 controlTimer 回调函数名
        const controlTimerActions = eventConfig.actions.filter(a => 
          a.type === 'controlTimer' && a.timerTargets && a.timerTargets.length > 0
        );
        
        if (controlTimerActions.length > 0) {
          const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
          
          controlTimerActions.forEach((_, actionIndex) => {
            const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex + actionIndex);
            functions.push(callbackName);
          });
          
          eventTypeIndexMap.set(eventConfig.type, currentIndex + controlTimerActions.length);
        }
      });
    }
    
    return functions;
  }

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }

  getControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateControlTimerCallbackImpl(component, componentMap);
  }

  /**
   * 生成按键事件回调实现
   */
  getKeyEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateKeyEventCallbackImpl(component, componentMap);
  }
}
