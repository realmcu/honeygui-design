/**
 * hg_button event generator
 * Migrated from LvglButtonGenerator.generateEventCallbacks()
 */
import { Component } from '../../../hml/types';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';

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
    let code = `static void ${cbName}(lv_event_t * e)\n`;
    code += `{\n`;
    code += `    lv_event_code_t code = lv_event_get_code(e);\n`;
    code += `    lv_obj_t * obj = lv_event_get_target(e);\n`;
    code += `    (void)obj; // Avoid unused warning\n\n`;
    code += `    switch(code) {\n`;
    code += `        case LV_EVENT_CLICKED:\n`;
    code += `            LV_LOG_USER("${component.id} clicked");\n`;
    code += `            break;\n`;
    code += `        case LV_EVENT_PRESSED:\n`;
    code += `            LV_LOG_USER("${component.id} pressed");\n`;
    code += `            break;\n`;
    code += `        case LV_EVENT_RELEASED:\n`;
    code += `            LV_LOG_USER("${component.id} released");\n`;
    code += `            break;\n`;
    code += `        case LV_EVENT_LONG_PRESSED:\n`;
    code += `            LV_LOG_USER("${component.id} long pressed");\n`;
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
}
