/**
 * hg_view 事件代码生成器
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator, EVENT_TYPE_TO_GUI_EVENT } from './EventCodeGenerator';

export class ViewEventGenerator implements EventCodeGenerator {

  /**
   * 生成 switch_in 中的视图切换事件
   */
  generateSwitchViewEvents(component: Component, indent: number, componentMap: Map<string, Component>): string {
    if (!component.eventConfigs) return '';

    let code = '';
    const indentStr = '    '.repeat(indent);

    component.eventConfigs.forEach(eventConfig => {
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
    // hg_view 的事件在 generateSwitchViewEvents 中处理
    return '';
  }

  collectCallbackFunctions(component: Component): string[] {
    // hg_view 的 switchView 不需要回调函数
    return [];
  }
}
