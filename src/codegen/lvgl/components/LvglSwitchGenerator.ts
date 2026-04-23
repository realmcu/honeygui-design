/**
 * hg_switch component LVGL code generator
 *
 * Maps to lv_switch_create(). Supports:
 * - Initial checked state via LV_STATE_CHECKED
 * - Disabled state via LV_STATE_DISABLED
 * - VALUE_CHANGED event callback
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglSwitchGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, _ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const checked = component.data?.checked === true || component.data?.checked === 'true'
      || component.data?.value === true || component.data?.value === 'true';

    let code = `    ${component.id} = lv_switch_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;

    if (checked) {
      code += `    lv_obj_add_state(${component.id}, LV_STATE_CHECKED);\n`;
    }

    return code;
  }
}
