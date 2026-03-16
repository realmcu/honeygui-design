/**
 * 事件代码生成器基类接口
 */
import { Component } from '../../../hml/types';
import { EventConfig } from '../../../hml/eventTypes';

export interface EventCodeGenerator {
  /**
   * 生成事件绑定代码
   */
  generateEventBindings(component: Component, indent: number, componentMap: Map<string, Component>): string;

  /**
   * 收集需要生成的回调函数名
   */
  collectCallbackFunctions(component: Component): string[];

  /**
   * 获取统一的事件回调实现代码（除 onMessage 外的所有事件）
   */
  getEventCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];

  /**
   * 获取 onMessage 回调的实现代码（可选）
   */
  getMessageCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];

  /**
   * 获取按键事件回调的实现代码（可选）
   */
  getKeyEventCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];
}

/**
 * 事件类型到 GUI_EVENT 的映射
 */
export const EVENT_TYPE_TO_GUI_EVENT: Record<string, string> = {
  // 触摸事件
  'onClick': 'GUI_EVENT_TOUCH_CLICKED',
  'onLongPress': 'GUI_EVENT_TOUCH_LONG',
  'onTouchDown': 'GUI_EVENT_TOUCH_PRESSED',
  'onTouchUp': 'GUI_EVENT_TOUCH_RELEASED',
  // 按键事件
  'onKeyShortPress': 'GUI_EVENT_KB_SHORT_PRESSED',
  'onKeyLongPress': 'GUI_EVENT_KB_LONG_PRESSED',
  // 滑动事件
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};

/**
 * 事件类型到回调函数名后缀的映射
 */
export const EVENT_TYPE_TO_CALLBACK_SUFFIX: Record<string, string> = {
  'onClick': 'clicked',
  'onLongPress': 'long_pressed',
  'onTouchDown': 'pressed',
  'onTouchUp': 'released',
  'onKeyShortPress': 'key',
  'onKeyLongPress': 'key_long',
  'onSwipeLeft': 'swiped_left',
  'onSwipeRight': 'swiped_right',
  'onSwipeUp': 'swiped_up',
  'onSwipeDown': 'swiped_down',
};

/**
 * 生成基于事件类型的回调函数名
 * @param componentId 组件ID
 * @param eventType 事件类型
 * @param index 索引（同一事件类型可能有多个回调）
 */
export function generateEventCallbackName(componentId: string, eventType: string, index: number): string {
  const suffix = EVENT_TYPE_TO_CALLBACK_SUFFIX[eventType] || 'event';
  return `${componentId}_${suffix}_${index}_cb`;
}

/**
 * 生成 onMessage 回调函数名
 */
export function getMessageCallbackName(component: Component, eventConfig: EventConfig, eventIndex: number): string {
  // 优先使用用户指定的 handler
  if (eventConfig.handler) {
    return eventConfig.handler;
  }
  // 自动生成：{组件id}_msg_cb_{序号}
  return `${component.id}_msg_cb_${eventIndex}`;
}

/**
 * 生成基于事件类型的回调实现（用于 controlTimer 等动作）
 */
export function generateControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
  const impls: string[] = [];
  if (!component.eventConfigs) return impls;

  // 为每个事件类型维护独立的索引
  const eventTypeIndexMap = new Map<string, number>();

  component.eventConfigs.forEach(eventConfig => {
    if (eventConfig.type === 'onMessage') return;

    // 跳过按键事件（按键事件的 controlTimer 在 generateKeyEventCallbackImpl 中处理）
    if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
      return;
    }

    // 检查是否有 controlTimer 动作
    const controlTimerActions = eventConfig.actions.filter(a => 
      a.type === 'controlTimer' && a.timerTargets && a.timerTargets.length > 0
    );

    if (controlTimerActions.length === 0) return;

    // 获取当前事件类型的索引
    const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
    eventTypeIndexMap.set(eventConfig.type, currentIndex + controlTimerActions.length);

    // 为每个 controlTimer 动作生成独立的回调函数
    controlTimerActions.forEach((action, actionIndex) => {
      const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex + actionIndex);

      let callbackBody = ``;

      action.timerTargets!.forEach(target => {
        const targetComp = componentMap.get(target.componentId);
        if (!targetComp) return;

        // 检查是否是计时标签
        const isTimerLabel = targetComp.type === 'hg_timer_label';

        if (isTimerLabel) {
          // 计时标签的启停控制（使用生成的控制函数）
          if (target.action === 'start') {
            callbackBody += `    ${target.componentId}_start();\n`;
          } else if (target.action === 'stop') {
            callbackBody += `    ${target.componentId}_stop();\n`;
          } else if (target.action === 'reset') {
            callbackBody += `    ${target.componentId}_reset();\n`;
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
            callbackBody += `    ${target.componentId}_timer_cnt = 0; // Reset counter\n`;
            callbackBody += `    gui_obj_create_timer(GUI_BASE(${target.componentId}), ${timer.interval}, ${timer.reload ? 'true' : 'false'}, ${callback});\n`;
            callbackBody += `    gui_obj_start_timer(GUI_BASE(${target.componentId}));\n`;
          } else if (target.action === 'stop') {
            // 关闭定时器
            callbackBody += `    if (GUI_BASE(${target.componentId})->timer) {\n`;
            callbackBody += `        gui_obj_stop_timer(GUI_BASE(${target.componentId}));\n`;
            callbackBody += `    }\n`;
          }
        }
      });

      impls.push(`void ${callbackName}(void *obj, gui_event_t *e)\n{\n    GUI_UNUSED(obj);\n    GUI_UNUSED(e);\n${callbackBody}}`);
    });
  });

  return impls;
}

/**
 * 生成 onMessage 回调实现的公共函数
 */
export function generateMessageCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
  const impls: string[] = [];
  if (!component.eventConfigs) return impls;

  // 统计 onMessage 事件的序号
  let msgIndex = 0;
  component.eventConfigs.forEach(eventConfig => {
    if (eventConfig.type !== 'onMessage' || !eventConfig.message) return;

    // 如果有 handler 属性，使用它作为回调函数名
    const callbackName = eventConfig.handler || getMessageCallbackName(component, eventConfig, msgIndex);
    msgIndex++;
    
    let body = '';

    // 如果有 actions，生成对应的代码
    if (eventConfig.actions && eventConfig.actions.length > 0) {
      eventConfig.actions.forEach(action => {
        if (action.type === 'callFunction' && action.functionName) {
          body += `    ${action.functionName}(obj, topic, data, len);\n`;
        } else if (action.type === 'switchView' && action.target) {
          const targetComponent = componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
          const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
          body += `    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
        } else if (action.type === 'sendMessage' && action.message) {
          body += `    gui_msg_publish("${action.message}", data, len);\n`;
        } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
          // 控制动画定时器
          action.timerTargets.forEach(target => {
            const targetComp = componentMap.get(target.componentId);
            if (!targetComp) return;
            
            const timers = targetComp.data?.timers;
            if (!timers || !Array.isArray(timers)) return;
            
            const timer = timers[target.timerIndex || 0];
            if (!timer) return;
            
            if (target.action === 'start') {
              // 开启定时器
              const callback = timer.mode === 'preset' 
                ? `${target.componentId}_${timer.id}_cb`
                : (timer.callback || `${target.componentId}_timer_cb`);
              body += `    ${target.componentId}_timer_cnt = 0; // Reset counter\n`;
              body += `    gui_obj_create_timer(GUI_BASE(${target.componentId}), ${timer.interval}, ${timer.reload ? 'true' : 'false'}, ${callback});\n`;
              body += `    gui_obj_start_timer(GUI_BASE(${target.componentId}));\n`;
            } else if (target.action === 'stop') {
              // 关闭定时器
              body += `    if (GUI_BASE(${target.componentId})->timer) {\n`;
              body += `        gui_obj_stop_timer(GUI_BASE(${target.componentId}));\n`;
              body += `    }\n`;
            }
          });
        }
      });
    }

    // 如果没有 actions 或 body 为空，生成 TODO 注释
    if (!body) {
      body = `    // TODO: Implement message handling logic\n`;
    }
    
    impls.push(`void ${callbackName}(gui_obj_t *obj, const char *topic, void *data, uint16_t len)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(topic);
    GUI_UNUSED(data);
    GUI_UNUSED(len);
${body}}`);
  });

  return impls;
}

/**
 * 生成按键事件回调实现的公共函数
 * 同一个组件的同类型按键事件（短按/长按）只生成一个回调函数
 * 在回调函数内部通过 strcmp(e->indev_name, "按键名") 来区分不同按键
 */
export function generateKeyEventCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
  const impls: string[] = [];
  if (!component.eventConfigs) return impls;

  // 按事件类型分组（onKeyShortPress 和 onKeyLongPress）
  const keyEventGroups = new Map<string, EventConfig[]>();
  
  component.eventConfigs.forEach(eventConfig => {
    if ((eventConfig.type !== 'onKeyShortPress' && eventConfig.type !== 'onKeyLongPress') || !eventConfig.keyName) {
      return;
    }
    
    if (!keyEventGroups.has(eventConfig.type)) {
      keyEventGroups.set(eventConfig.type, []);
    }
    keyEventGroups.get(eventConfig.type)!.push(eventConfig);
  });

  // 为每种事件类型生成一个回调函数
  let keyEventIndex = 0;
  keyEventGroups.forEach((eventConfigs, eventType) => {
    const callbackName = `${component.id}_key_${keyEventIndex}_cb`;
    keyEventIndex++;

    let callbackBody = '';

    // 为每个按键名生成 if-else 分支
    eventConfigs.forEach((eventConfig, index) => {
      const isFirst = index === 0;
      const isLast = index === eventConfigs.length - 1;

      // 生成条件判断
      if (isFirst) {
        callbackBody += `    // Check key name\n`;
        callbackBody += `    if (strcmp(e->indev_name, "${eventConfig.keyName}") == 0)\n    {\n`;
      } else {
        callbackBody += `    else if (strcmp(e->indev_name, "${eventConfig.keyName}") == 0)\n    {\n`;
      }

      // 生成动作代码
      if (eventConfig.actions && eventConfig.actions.length > 0) {
        eventConfig.actions.forEach(action => {
          if (action.type === 'callFunction' && action.functionName) {
            callbackBody += `        ${action.functionName}(obj, e);\n`;
          } else if (action.type === 'switchView' && action.target) {
            const targetComponent = componentMap.get(action.target);
            const targetName = targetComponent?.name || action.target;
            const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
            const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
            callbackBody += `        gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
          } else if (action.type === 'sendMessage' && action.message) {
            callbackBody += `        gui_msg_publish("${action.message}", NULL, 0);\n`;
          } else if (action.type === 'controlTimer' && action.timerTargets && action.timerTargets.length > 0) {
            // 控制动画定时器
            action.timerTargets.forEach(target => {
              const targetComp = componentMap.get(target.componentId);
              if (!targetComp) return;

              // 检查是否是计时标签
              const isTimerLabel = targetComp.type === 'hg_label' && targetComp.data?.isTimerLabel === true;

              if (isTimerLabel) {
                // 计时标签的启停控制
                if (target.action === 'start') {
                  callbackBody += `        gui_obj_create_timer((void *)${target.componentId}, 10, -1, ${target.componentId}_timer_update_cb);\n`;
                  callbackBody += `        gui_obj_start_timer((void *)${target.componentId});\n`;
                } else if (target.action === 'stop') {
                  callbackBody += `        if (GUI_BASE(${target.componentId})->timer) {\n`;
                  callbackBody += `            gui_obj_stop_timer((void *)${target.componentId});\n`;
                  callbackBody += `        }\n`;
                }
              } else {
                // 普通定时器的启停控制
                const timers = targetComp.data?.timers;
                if (!timers || !Array.isArray(timers)) return;

                const timer = timers[target.timerIndex || 0];
                if (!timer) return;

                if (target.action === 'start') {
                  const callback = timer.mode === 'preset'
                    ? `${target.componentId}_${timer.id}_cb`
                    : (timer.callback || `${target.componentId}_timer_cb`);
                  callbackBody += `        ${target.componentId}_timer_cnt = 0; // Reset counter\n`;
                  callbackBody += `        gui_obj_create_timer(GUI_BASE(${target.componentId}), ${timer.interval}, ${timer.reload ? 'true' : 'false'}, ${callback});\n`;
                  callbackBody += `        gui_obj_start_timer(GUI_BASE(${target.componentId}));\n`;
                } else if (target.action === 'stop') {
                  callbackBody += `        if (GUI_BASE(${target.componentId})->timer) {\n`;
                  callbackBody += `            gui_obj_stop_timer(GUI_BASE(${target.componentId}));\n`;
                  callbackBody += `        }\n`;
                }
              }
            });
          }
        });
      } else {
        // 如果没有 actions，生成 TODO 注释
        callbackBody += `        // TODO: Implement key event handling logic\n`;
      }

      callbackBody += `    }\n`;
    });

    impls.push(`void ${callbackName}(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
${callbackBody}}`);
  });

  return impls;
}
