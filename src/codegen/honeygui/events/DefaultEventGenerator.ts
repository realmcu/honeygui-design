/**
 * 默认事件代码生成器（通用组件）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT, EVENT_TYPE_TO_CALLBACK_SUFFIX, generateMessageCallbackImpl, getMessageCallbackName } from './EventCodeGenerator';

export class DefaultEventGenerator implements EventCodeGenerator {

  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return '';
    }

    let code = '';
    const indentStr = '    '.repeat(indent);
    let msgIndex = 0;
    const eventTypeMap = new Map<string, boolean>(); // 记录每种事件类型是否已绑定

    component.eventConfigs.forEach((eventConfig) => {
      // 处理 onMessage 事件（消息订阅）
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        const callbackName = eventConfig.handler || getMessageCallbackName(component, eventConfig, msgIndex);
        msgIndex++;
        code += `${indentStr}gui_msg_subscribe((gui_obj_t *)${component.id}, "${eventConfig.message}", ${callbackName});\n`;
        return;
      }

      // 处理其他事件：统一使用 gui_obj_add_event_cb 绑定到对应的回调函数
      const guiEvent = EVENT_TYPE_TO_GUI_EVENT[eventConfig.type];
      if (!guiEvent) return;

      // 每种事件类型只绑定一次回调函数
      if (!eventTypeMap.has(eventConfig.type)) {
        const callbackName = this.getEventCallbackName(component.id, eventConfig.type);
        code += `${indentStr}gui_obj_add_event_cb(${component.id}, (gui_event_cb_t)${callbackName}, ${guiEvent}, NULL);\n`;
        eventTypeMap.set(eventConfig.type, true);
      }
    });

    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const functions: string[] = [];
    if (!component.eventConfigs) return functions;

    let msgIndex = 0;
    const eventTypeMap = new Map<string, boolean>(); // 记录每种事件类型是否已收集
    
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage' && eventConfig.message) {
        // 优先使用 handler 属性
        if (eventConfig.handler) {
          functions.push(eventConfig.handler);
        } else {
          functions.push(getMessageCallbackName(component, eventConfig, msgIndex));
        }
        msgIndex++;
      } else {
        // 其他事件：每种事件类型只收集一次回调函数名
        if (!eventTypeMap.has(eventConfig.type)) {
          const callbackName = this.getEventCallbackName(component.id, eventConfig.type);
          functions.push(callbackName);
          eventTypeMap.set(eventConfig.type, true);
        }
      }
    });

    return functions;
  }

  /**
   * 生成统一的事件回调实现（除 onMessage 外的所有事件）
   */
  getEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    const impls: string[] = [];
    if (!component.eventConfigs) return impls;

    // 按事件类型分组
    const eventGroups = new Map<string, typeof component.eventConfigs>();
    
    component.eventConfigs.forEach(eventConfig => {
      if (eventConfig.type === 'onMessage') return; // onMessage 单独处理
      
      if (!eventGroups.has(eventConfig.type)) {
        eventGroups.set(eventConfig.type, []);
      }
      eventGroups.get(eventConfig.type)!.push(eventConfig);
    });

    // 为每种事件类型生成一个回调函数
    eventGroups.forEach((eventConfigs, eventType) => {
      const callbackName = this.getEventCallbackName(component.id, eventType);
      let callbackBody = '';

      // 如果是按键事件，需要通过 strcmp 区分不同按键
      const isKeyEvent = eventType === 'onKeyShortPress' || eventType === 'onKeyLongPress';
      
      if (isKeyEvent) {
        // 按键事件：通过 strcmp 区分不同按键
        eventConfigs.forEach((eventConfig, index) => {
          const isFirst = index === 0;
          const keyName = eventConfig.keyName || 'unknown';
          
          if (isFirst) {
            callbackBody += `    // Check key name\n`;
            callbackBody += `    if (strcmp(e->indev_name, "${keyName}") == 0)\n    {\n`;
          } else {
            callbackBody += `    else if (strcmp(e->indev_name, "${keyName}") == 0)\n    {\n`;
          }
          
          // 生成动作代码（一个按键可能有多个动作）
          callbackBody += this.generateActionsCode(eventConfig, componentMap, '        ');
          callbackBody += `    }\n`;
        });
      } else {
        // 非按键事件：合并所有 eventConfig 的 actions，按顺序执行
        // 注意：同一事件类型可能有多个 eventConfig（虽然不常见），每个 eventConfig 可能有多个 action
        eventConfigs.forEach(eventConfig => {
          // 为每个 action 生成代码
          if (eventConfig.actions && eventConfig.actions.length > 0) {
            eventConfig.actions.forEach((action: any) => {
              callbackBody += this.generateSingleActionCode(action, componentMap, '    ');
            });
          }
        });
      }

      // 如果没有动作，生成 TODO 注释
      if (!callbackBody.trim()) {
        callbackBody = `    // TODO: Implement event handling logic\n`;
      }

      impls.push(`void ${callbackName}(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
${callbackBody}}`);
    });

    return impls;
  }

  /**
   * 生成 onMessage 回调实现
   */
  getMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
    return generateMessageCallbackImpl(component, componentMap);
  }

  /**
   * 生成事件动作代码（遍历所有 actions）
   */
  private generateActionsCode(eventConfig: any, componentMap: Map<string, Component>, indent: string): string {
    let code = '';
    
    if (!eventConfig.actions || eventConfig.actions.length === 0) {
      return code;
    }

    eventConfig.actions.forEach((action: any) => {
      code += this.generateSingleActionCode(action, componentMap, indent);
    });

    return code;
  }

  /**
   * 生成单个动作的代码
   */
  private generateSingleActionCode(action: any, componentMap: Map<string, Component>, indent: string): string {
    let code = '';

    if (action.type === 'callFunction' && action.functionName) {
      // 调用函数
      code += `${indent}${action.functionName}(obj, e);\n`;
    } else if (action.type === 'switchView' && action.target) {
      // 跳转界面
      const targetComponent = componentMap.get(action.target);
      const targetName = targetComponent?.name || action.target;
      const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
      const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
      code += `${indent}gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
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
            code += `${indent}${target.componentId}_timer_cnt = 0; // Reset counter\n`;
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

  /**
   * 根据事件类型生成回调函数名
   */
  private getEventCallbackName(componentId: string, eventType: string): string {
    const suffix = EVENT_TYPE_TO_CALLBACK_SUFFIX[eventType] || 'event';
    return `${componentId}_${suffix}_cb`;
  }
}
