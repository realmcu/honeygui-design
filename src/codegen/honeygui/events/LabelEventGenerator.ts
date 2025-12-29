/**
 * hg_label 事件代码生成器
 * TODO: 实现标签特定的事件处理逻辑
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class LabelEventGenerator implements EventCodeGenerator {
  generateEventBindings(component: Component, indent: number, _componentMap: Map<string, Component>): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    if (!component.eventConfigs) return code;

    let msgIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        const callbackName = getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe(${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        return;
      }

      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const callbackName = `${component.id}_switch_view_cb`;
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        }
      });
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const callbacks: string[] = [];

    if (!component.eventConfigs) return callbacks;

    let msgIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        callbacks.push(getMessageCallbackName(component, eventConfig, msgIndex));
        msgIndex++;
        return;
      }

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
      // onMessage 的 switchView 在 getMessageCallbackImpl 中处理
      if (eventConfig.type === 'onMessage') return;

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

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }
}
