/**
 * hg_image 事件代码生成器
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT } from './EventCodeGenerator';

export class ImageEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);

    component.eventConfigs.forEach((eventConfig) => {
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach((action) => {
        if (action.type === 'callFunction' && action.functionName) {
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${action.functionName}, ${guiEvent}, NULL);\n`;
        } else if (action.type === 'switchView' && action.target) {
          // switchView 也通过回调实现
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

    component.eventConfigs.forEach(eventConfig => {
      eventConfig.actions.forEach(action => {
        if (action.type === 'callFunction' && action.functionName) {
          functions.push(action.functionName);
        } else if (action.type === 'switchView' && action.target) {
          // switchView 需要生成回调函数
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
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});
}`;
          callbacks.push(impl);
        }
      });
    });

    return callbacks;
  }
}
