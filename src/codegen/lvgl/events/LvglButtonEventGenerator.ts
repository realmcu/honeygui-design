/**
 * hg_button event generator
 * Migrated from LvglButtonGenerator.generateEventCallbacks()
 * Supports switchView action via lv_screen_load_anim()
 */
import { Component } from '../../../hml/types';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
import { generateSwitchViewCode } from '../LvglSwitchViewMapper';

export class LvglButtonEventGenerator implements LvglEventCodeGenerator {
  generateEventBindings(component: Component): string {
    const cbName = `${component.id}_event_cb`;
    return `    lv_obj_add_event_cb(${component.id}, ${cbName}, LV_EVENT_ALL, NULL);\n`;
  }

  collectCallbackFunctions(component: Component): string[] {
    return [`${component.id}_event_cb`];
  }

  getEventCallbackImpl(component: Component): string[] {
    const cbName = `${component.id}_event_cb`;
    const eventConfigs = (component as any).eventConfigs || [];

    let code = `static void ${cbName}(lv_event_t * e)\n`;
    code += `{\n`;
    code += `    lv_event_code_t code = lv_event_get_code(e);\n`;
    code += `    lv_obj_t * obj = lv_event_get_target(e);\n`;
    code += `    (void)obj; // Avoid unused warning\n\n`;
    code += `    switch(code) {\n`;

    // Generate CLICKED handler with switchView/callFunction actions
    code += `        case LV_EVENT_CLICKED:\n`;
    const clickActions = this.getActionsForEvent(eventConfigs, 'onClick');
    if (clickActions.length > 0) {
      for (const action of clickActions) {
        code += this.generateActionCode(action);
      }
    } else {
      code += `            LV_LOG_USER("${component.id} clicked");\n`;
    }
    code += `            break;\n`;

    code += `        case LV_EVENT_PRESSED:\n`;
    code += `            LV_LOG_USER("${component.id} pressed");\n`;
    code += `            break;\n`;
    code += `        case LV_EVENT_RELEASED:\n`;
    code += `            LV_LOG_USER("${component.id} released");\n`;
    code += `            break;\n`;

    // Long press handler
    code += `        case LV_EVENT_LONG_PRESSED:\n`;
    const longPressActions = this.getActionsForEvent(eventConfigs, 'onLongPress');
    if (longPressActions.length > 0) {
      for (const action of longPressActions) {
        code += this.generateActionCode(action);
      }
    } else {
      code += `            LV_LOG_USER("${component.id} long pressed");\n`;
    }
    code += `            break;\n`;

    code += `        case LV_EVENT_VALUE_CHANGED:\n`;
    code += `            LV_LOG_USER("${component.id} value changed (toggled)");\n`;
    code += `            break;\n`;
    code += `        default:\n`;
    code += `            break;\n`;
    code += `    }\n`;
    code += `}\n`;
    return [code];
  }

  private getActionsForEvent(eventConfigs: any[], eventType: string): any[] {
    for (const ec of eventConfigs) {
      if (ec.type === eventType && ec.actions) {
        return ec.actions;
      }
    }
    return [];
  }

  private generateActionCode(action: any): string {
    if (action.type === 'switchView' && action.target) {
      return generateSwitchViewCode(action.target, action.switchInStyle, action.switchOutStyle);
    }
    if (action.type === 'callFunction' && action.functionName) {
      return `            ${action.functionName}(e);\n`;
    }
    return '';
  }
}
