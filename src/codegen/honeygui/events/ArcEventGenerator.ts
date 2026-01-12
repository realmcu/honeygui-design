/**
 * hg_arc 事件代码生成器
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class ArcEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);
    let msgIndex = 0;

    component.eventConfigs.forEach((eventConfig) => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        const callbackName = getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe(${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        return;
      }

      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach((action) => {
        if (action.type === 'callFunction' && action.functionName) {
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${action.functionName}, ${guiEvent}, NULL);\n`;
        } else if (action.type === 'switchView' && action.target) {
          const callbackName = `${component.id}_switch_view_cb`;
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
    component.eventConfigs.forEach(eventConfig => {
      // onMessage 生成统一回调名
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
        msgIndex++;
        return;
      }

      eventConfig.actions.forEach(action => {
        if (action.type === 'callFunction' && action.functionName) {
          functions.push(action.functionName);
        } else if (action.type === 'switchView' && action.target) {
          functions.push(`${component.id}_switch_view_cb`);
        }
      });
    });

    return functions;
  }

  /**
   * 获取 switchView 回调的实现代码
   */
  getSwitchViewCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const callbacks: string[] = [];
    if (!component.eventConfigs) return callbacks;

    component.eventConfigs.forEach(eventConfig => {
      // onMessage 的 switchView 在 getMessageCallbackImpl 中处理
      if (eventConfig.type === 'onMessage') return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          const callbackName = `${component.id}_switch_view_cb`;
          const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
          const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';

          const impl = `void ${callbackName}(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(param);
    GUI_UNUSED(event);
    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});
}`;
          callbacks.push(impl);
        }
      });
    });

    return callbacks;
  }

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }
}
