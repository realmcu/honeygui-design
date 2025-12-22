/**
 * hg_button 事件代码生成器
 * TODO: 实现按钮特定的事件处理逻辑
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT } from './EventCodeGenerator';

export class ButtonEventGenerator implements EventCodeGenerator {
  generateEventBindings(component: Component, indent: number, _componentMap: Map<string, Component>): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    if (!component.eventConfigs) return code;

    component.eventConfigs.forEach(eventConfig => {
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const callbackName = `${component.id}_switch_view_cb`;
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        }
        // TODO: 添加其他 action 类型支持
      });
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const callbacks: string[] = [];

    if (!component.eventConfigs) return callbacks;

    component.eventConfigs.forEach(eventConfig => {
      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView') {
          callbacks.push(`${component.id}_switch_view_cb`);
        }
      });
    });

    return callbacks;
  }

  getSwitchViewCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const impls: string[] = [];

    if (!component.eventConfigs) return impls;

    component.eventConfigs.forEach(eventConfig => {
      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
          const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';

          impls.push(`void ${component.id}_switch_view_cb(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});
}`);
        }
      });
    });

    return impls;
  }
}
