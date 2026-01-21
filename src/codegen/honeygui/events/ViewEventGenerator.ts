/**
 * hg_view 事件代码生成器
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

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
    let controlTimerIndex = 0;

    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            code += `${indentStr}gui_msg_subscribe(${component.id}, "${eventConfig.message}", ${action.functionName});\n`;
          }
        });
      }

      // 处理 controlTimer 事件
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (guiEvent) {
        eventConfig.actions.forEach(action => {
          if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
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
    
    // 收集 onMessage 的回调函数名
    if (component.eventConfigs) {
      let msgIndex = 0;
      let controlTimerIndex = 0;
      component.eventConfigs.forEach(eventConfig => {
        if (eventConfig.type === 'onMessage' && eventConfig.message) {
          functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
          msgIndex++;
        }

        // 收集 controlTimer 回调函数名
        eventConfig.actions.forEach(action => {
          if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            functions.push(`${component.id}_animation_set_${controlTimerIndex}_cb`);
            controlTimerIndex++;
          }
        });
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
}
