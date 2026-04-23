/**
 * hg_slider component LVGL code generator
 *
 * Maps to lv_slider_create(). Supports:
 * - value / min / max range
 * - VALUE_CHANGED event callback
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglSliderGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, _ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const value = Number(component.data?.value ?? 0);
    const min = Number(component.data?.min ?? 0);
    const max = Number(component.data?.max ?? 100);

    let code = `    ${component.id} = lv_slider_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;

    if (min !== 0 || max !== 100) {
      code += `    lv_slider_set_range(${component.id}, ${min}, ${max});\n`;
    }

    if (value !== 0) {
      code += `    lv_slider_set_value(${component.id}, ${value}, LV_ANIM_OFF);\n`;
    }

    return code;
  }
}
