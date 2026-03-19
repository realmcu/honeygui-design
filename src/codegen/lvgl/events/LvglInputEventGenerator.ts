/**
 * hg_input 事件生成器
 * 生成 LV_EVENT_VALUE_CHANGED 和 LV_EVENT_READY 回调
 */
import { Component } from '../../../hml/types';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';

export class LvglInputEventGenerator implements LvglEventCodeGenerator {
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
    code += `    if(code == LV_EVENT_VALUE_CHANGED) {\n`;
    code += `        const char * txt = lv_textarea_get_text(obj);\n`;
    code += `        LV_LOG_USER("${component.id} value changed: %s", txt);\n`;
    code += `    } else if(code == LV_EVENT_READY) {\n`;
    code += `        const char * txt = lv_textarea_get_text(obj);\n`;
    code += `        LV_LOG_USER("${component.id} ready: %s", txt);\n`;
    code += `    }\n`;
    code += `}\n`;
    return [code];
  }
}
