/**
 * hg_list_item 事件代码生成器
 * list_item 的事件在 note_design 回调中生成，需要特殊处理
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl } from './EventCodeGenerator';

export class ListItemEventGenerator implements EventCodeGenerator {
  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    const indentStr = '    '.repeat(indent);
    let code = '';

    // 统计 onMessage 事件的序号
    let msgIndex = 0;

    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage') {
        // onMessage 事件处理
        if (eventConfig.message) {
          const callbackName = eventConfig.handler || `${component.id}_msg_cb_${msgIndex}`;
          msgIndex++;
          code += `${indentStr}gui_msg_subscribe(${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        }
      } else {
        // 普通触摸/滑动事件
        const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
        if (!guiEvent) {
          console.warn(`[ListItemEventGenerator] Unknown event type: ${eventConfig.type}`);
          return;
        }

        // 检查是否有 switchView 或 callFunction 动作
        const hasSwitchView = eventConfig.actions.some(a => a.type === 'switchView');
        const hasCallFunction = eventConfig.actions.some(a => a.type === 'callFunction');

        if (hasSwitchView) {
          // 使用 switchView 回调
          const callbackName = `${component.id}_switch_view_cb`;
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, ${callbackName}, ${guiEvent}, NULL);\n`;
        } else if (hasCallFunction) {
          // 使用用户指定的回调函数
          const functionName = eventConfig.actions.find(a => a.type === 'callFunction')?.functionName;
          if (functionName) {
            code += `${indentStr}gui_obj_add_event_cb(${component.id}, ${functionName}, ${guiEvent}, NULL);\n`;
          }
        }
      }
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    if (!component.eventConfigs) return functions;

    // 统计 onMessage 事件的序号
    let msgIndex = 0;

    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage') {
        // onMessage 回调
        if (eventConfig.message) {
          const callbackName = eventConfig.handler || `${component.id}_msg_cb_${msgIndex}`;
          msgIndex++;
          functions.push(callbackName);
        }
      } else {
        // 普通事件回调
        const hasSwitchView = eventConfig.actions.some(a => a.type === 'switchView');
        const hasCallFunction = eventConfig.actions.some(a => a.type === 'callFunction');

        if (hasSwitchView) {
          functions.push(`${component.id}_switch_view_cb`);
        } else if (hasCallFunction) {
          const functionName = eventConfig.actions.find(a => a.type === 'callFunction')?.functionName;
          if (functionName) {
            functions.push(functionName);
          }
        }
      }
    });

    return functions;
  }

  getSwitchViewCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const impls: string[] = [];
    if (!component.eventConfigs) return impls;

    const hasSwitchView = component.eventConfigs.some(ec => 
      ec.type !== 'onMessage' && ec.actions.some(a => a.type === 'switchView')
    );

    if (!hasSwitchView) return impls;

    const callbackName = `${component.id}_switch_view_cb`;
    let body = '';

    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage') return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
          const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
          body += `    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
        }
      });
    });

    if (body) {
      impls.push(`void ${callbackName}(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
${body}}`);
    }

    return impls;
  }

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }
}
