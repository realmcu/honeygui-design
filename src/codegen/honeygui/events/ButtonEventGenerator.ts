/**
 * hg_button 事件代码生成器
 * TODO: 实现按钮特定的事件处理逻辑
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, generateMessageCallbackImpl, generateControlTimerCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class ButtonEventGenerator implements EventCodeGenerator {
  generateEventBindings(component: Component, indent: number, _componentMap: Map<string, Component>): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    if (!component.eventConfigs) return code;

    // 检查是否是双态按钮
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';

    let msgIndex = 0;
    let controlTimerIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        const callbackName = eventConfig.handler || getMessageCallbackName(component, eventConfig, msgIndex);
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
        } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
          // 双态按钮：跳过 controlTimer 事件，因为应该使用 on/off 回调来控制
          if (toggleMode) {
            return;
          }
          const callbackName = `${component.id}_animation_set_${controlTimerIndex}_cb`;
          controlTimerIndex++;
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        } else if (action.type === 'callFunction' && action.functionName) {
          code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${action.functionName}, ${guiEvent}, NULL);\n`;
        }
      });
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const callbacks: string[] = [];

    if (!component.eventConfigs) return callbacks;

    // 检查是否是双态按钮
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';

    let msgIndex = 0;
    let controlTimerIndex = 0;
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        if (eventConfig.handler) {
          callbacks.push(eventConfig.handler);
        } else {
          callbacks.push(getMessageCallbackName(component, eventConfig, msgIndex));
        }
        msgIndex++;
        return;
      }

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView') {
          callbacks.push(`${component.id}_switch_view_cb`);
        } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
          // 双态按钮：跳过 controlTimer 回调
          if (toggleMode) {
            return;
          }
          callbacks.push(`${component.id}_animation_set_${controlTimerIndex}_cb`);
          controlTimerIndex++;
        } else if (action.type === 'callFunction' && action.functionName) {
          callbacks.push(action.functionName);
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

          // 生成回调函数体
          let callbackBody = `    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
`;

          // 如果是 onTouchUp 事件且开启了抬起区域检测
          if (eventConfig.type === 'onTouchUp' && eventConfig.checkReleaseArea) {
            callbackBody += `    
    // 抬起区域检测
    touch_info_t *tp = tp_get_info();
    gui_obj_t *parent = ((gui_obj_t *)obj)->parent;
    if (!(gui_obj_point_in_obj_rect((gui_obj_t *)obj, tp->x + tp->deltaX - parent->x, tp->y + tp->deltaY - parent->y) == true)) {
        return;
    }
`;
          }

          callbackBody += `    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});`;

          impls.push(`void ${component.id}_switch_view_cb(void *obj, gui_event_t event, void *param)
{
${callbackBody}
}`);
        }
      });
    });

    return impls;
  }

  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }

  getControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    // 检查是否是双态按钮
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    
    // 双态按钮：不生成 controlTimer 回调，因为应该使用 on/off 回调
    if (toggleMode) {
      return [];
    }
    
    return generateControlTimerCallbackImpl(component, componentMap);
  }
}
