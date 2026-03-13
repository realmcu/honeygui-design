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
    
    // hg_view 在 switch_in 函数内，使用 view 参数
    const targetRef = '(gui_obj_t *)view';
    
    // 为每个事件类型维护独立的索引
    const eventTypeIndexMap = new Map<string, number>();
    const keyEventTypeMap = new Map<string, boolean>(); // 记录每种按键事件类型是否已绑定

    component.eventConfigs.forEach(eventConfig => {
      // 处理 onMessage 事件
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 如果有 handler 属性，直接使用
        if (eventConfig.handler) {
          code += `${indentStr}gui_msg_subscribe(${targetRef}, "${eventConfig.message}", ${eventConfig.handler});\n`;
        }
        // 否则检查 actions 中的 callFunction
        else {
          eventConfig.actions.forEach(action => {
            if (action.type === 'callFunction' && action.functionName) {
              code += `${indentStr}gui_msg_subscribe(${targetRef}, "${eventConfig.message}", ${action.functionName});\n`;
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
          code += `${indentStr}gui_obj_add_event_cb(${targetRef}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        }
        return;
      }

      // 处理其他事件（controlTimer、callFunction 等）
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (guiEvent) {
        // 检查是否有需要生成回调的动作（controlTimer、sendMessage）
        const needsCallback = eventConfig.actions.some(a => 
          a.type === 'controlTimer' || a.type === 'sendMessage'
        );
        
        if (needsCallback) {
          // 生成统一的回调函数
          const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
          const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex);
          eventTypeIndexMap.set(eventConfig.type, currentIndex + 1);
          code += `${indentStr}gui_obj_add_event_cb(${targetRef}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        } else {
          // 只有 callFunction 的情况，直接绑定
          eventConfig.actions.forEach(action => {
            if (action.type === 'callFunction' && action.functionName) {
              code += `${indentStr}gui_obj_add_event_cb(${targetRef}, ${action.functionName}, ${guiEvent}, NULL);\n`;
            }
          });
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

        // 收集其他事件的回调函数名
        eventConfig.actions.forEach(action => {
          // 检查是否有需要生成回调的动作
          const needsCallback = eventConfig.actions.some(a => 
            a.type === 'controlTimer' || a.type === 'sendMessage'
          );
          
          if (needsCallback) {
            // 只收集一次回调函数名
            const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
            if (currentIndex === 0 || action === eventConfig.actions[0]) {
              const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex);
              if (!functions.includes(callbackName)) {
                functions.push(callbackName);
                eventTypeIndexMap.set(eventConfig.type, currentIndex + 1);
              }
            }
          } else if (action.type === 'callFunction' && action.functionName) {
            // 只有 callFunction 的情况
            functions.push(action.functionName);
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

  /**
   * 生成按键事件回调实现
   */
  getKeyEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateKeyEventCallbackImpl(component, componentMap);
  }

  /**
   * 生成统一的事件回调实现（除 onMessage 外的所有事件）
   * hg_view 的 switchView 事件在 switch_in 函数中使用 gui_view_switch_on_event 处理
   * 其他事件（如 controlTimer、sendMessage）使用 gui_obj_add_event_cb 绑定回调函数
   */
  getEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const impls: string[] = [];
    if (!component.eventConfigs) return impls;

    // 按事件类型分组
    const eventGroups = new Map<string, typeof component.eventConfigs>();
    
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage') return; // onMessage 单独处理
      
      // 跳过按键事件（按键事件在 getKeyEventCallbackImpl 中处理）
      if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
        return;
      }
      
      // 只处理有 controlTimer 或 sendMessage 动作的事件
      const needsCallback = eventConfig.actions.some(a => 
        a.type === 'controlTimer' || a.type === 'sendMessage'
      );
      
      if (needsCallback) {
        if (!eventGroups.has(eventConfig.type)) {
          eventGroups.set(eventConfig.type, []);
        }
        eventGroups.get(eventConfig.type)!.push(eventConfig);
      }
    });

    // 为每种事件类型生成一个回调函数
    eventGroups.forEach((eventConfigs, eventType) => {
      // 为每个 eventConfig 生成独立的回调函数
      eventConfigs.forEach((eventConfig, index) => {
        const callbackName = generateEventCallbackName(component.id, eventType, index);
        let callbackBody = '';

        // 生成动作代码
        if (eventConfig.actions && eventConfig.actions.length > 0) {
          eventConfig.actions.forEach((action: any) => {
            callbackBody += this.generateSingleActionCode(action, componentMap, '    ');
          });
        }

        // 如果没有动作，生成 TODO 注释
        if (!callbackBody.trim()) {
          callbackBody = `    // TODO: 实现事件处理逻辑\n`;
        }

        impls.push(`void ${callbackName}(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
${callbackBody}}`);
      });
    });

    return impls;
  }

  /**
   * 生成单个动作的代码
   */
  private generateSingleActionCode(action: any, componentMap: Map<string, Component>, indent: string): string {
    let code = '';

    if (action.type === 'callFunction' && action.functionName) {
      // 调用函数
      code += `${indent}${action.functionName}(obj, e);\n`;
    } else if (action.type === 'sendMessage' && action.message) {
      // 发送消息
      code += `${indent}gui_msg_publish("${action.message}", NULL, 0);\n`;
    } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
      // 控制定时器
      action.timerTargets.forEach((target: any) => {
        const targetComp = componentMap.get(target.componentId);
        if (!targetComp) return;

        // 检查是否是计时标签
        const isTimerLabel = targetComp.type === 'hg_timer_label';

        if (isTimerLabel) {
          // 计时标签的启停控制（使用生成的控制函数）
          if (target.action === 'start') {
            code += `${indent}${target.componentId}_start();\n`;
          } else if (target.action === 'stop') {
            code += `${indent}${target.componentId}_stop();\n`;
          } else if (target.action === 'reset') {
            code += `${indent}${target.componentId}_reset();\n`;
          }
        } else {
          // 普通定时器的启停控制
          const timers = targetComp.data?.timers;
          if (!timers || !Array.isArray(timers)) return;

          const timer = timers[target.timerIndex || 0];
          if (!timer) return;

          if (target.action === 'start') {
            // 开启定时器
            const callback = timer.mode === 'preset' 
              ? `${target.componentId}_${timer.id}_cb`
              : (timer.callback || `${target.componentId}_timer_cb`);
            code += `${indent}${target.componentId}_timer_cnt = 0; // 清零计数器\n`;
            code += `${indent}gui_obj_create_timer(GUI_BASE(${target.componentId}), ${timer.interval}, ${timer.reload ? 'true' : 'false'}, ${callback});\n`;
            code += `${indent}gui_obj_start_timer(GUI_BASE(${target.componentId}));\n`;
          } else if (target.action === 'stop') {
            // 关闭定时器
            code += `${indent}if (GUI_BASE(${target.componentId})->timer) {\n`;
            code += `${indent}    gui_obj_stop_timer(GUI_BASE(${target.componentId}));\n`;
            code += `${indent}}\n`;
          }
        }
      });
    }

    return code;
  }
}
