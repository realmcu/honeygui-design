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
   * 获取 switchView 回调的实现代码（可选）
   */
  getSwitchViewCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];

  /**
   * 获取 onMessage 回调的实现代码（可选）
   */
  getMessageCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];

  /**
   * 获取 controlTimer 回调的实现代码（可选）
   */
  getControlTimerCallbackImpl?(component: Component, componentMap: Map<string, Component>): string[];
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
  // 滑动事件
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};

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
 * 生成 controlTimer 回调实现的公共函数
 */
export function generateControlTimerCallbackImpl(component: Component, componentMap: Map<string, Component>): string[] {
  const impls: string[] = [];
  if (!component.eventConfigs) return impls;

  let controlTimerIndex = 0;
  component.eventConfigs.forEach(eventConfig => {
    if (eventConfig.type === 'onMessage') return;

    // 检查是否有 controlTimer 动作
    const controlTimerActions = eventConfig.actions.filter(a => 
      a.type === 'controlTimer' && a.timerTargets && a.timerTargets.length > 0
    );

    if (controlTimerActions.length === 0) return;

    // 为每个 controlTimer 动作生成独立的回调函数
    controlTimerActions.forEach(action => {
      const callbackName = `${component.id}_animation_set_${controlTimerIndex}_cb`;
      controlTimerIndex++;

      let callbackBody = `    GUI_UNUSED(obj);\n    GUI_UNUSED(event);\n    GUI_UNUSED(param);\n`;

      action.timerTargets!.forEach(target => {
        const targetComp = componentMap.get(target.componentId);
        if (!targetComp) return;

        // 检查是否是计时标签
        const isTimerLabel = targetComp.type === 'hg_label' && targetComp.data?.isTimerLabel === true;

        if (isTimerLabel) {
          // 计时标签的启停控制
          if (target.action === 'start') {
            // 启动计时标签的定时器
            callbackBody += `    gui_obj_create_timer((void *)${target.componentId}, 10, -1, ${target.componentId}_timer_update_cb);\n`;
            callbackBody += `    gui_obj_start_timer((void *)${target.componentId});\n`;
          } else if (target.action === 'stop') {
            // 停止计时标签的定时器
            callbackBody += `    if (GUI_BASE(${target.componentId})->timer) {\n`;
            callbackBody += `        gui_obj_stop_timer((void *)${target.componentId});\n`;
            callbackBody += `    }\n`;
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

      impls.push(`void ${callbackName}(void *obj, gui_event_t event, void *param)\n{\n${callbackBody}}`);
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
      body = `    // TODO: 实现消息处理逻辑\n`;
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
