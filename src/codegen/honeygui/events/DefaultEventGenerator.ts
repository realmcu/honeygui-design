/**
 * 默认事件代码生成器（通用组件）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT } from './EventCodeGenerator';

export class DefaultEventGenerator implements EventCodeGenerator {

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

    component.eventConfigs.forEach(eventConfig => {
      eventConfig.actions.forEach(action => {
        if (action.type === 'callFunction' && action.functionName) {
          functions.push(action.functionName);
        }
      });
    });

    return functions;
  }
}
