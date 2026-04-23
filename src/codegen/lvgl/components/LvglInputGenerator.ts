/**
 * hg_input component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { parseColorHex, escapeCString } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglInputGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const placeholder = component.data?.placeholder || '';
    const text = component.data?.text || '';
    const color = component.style?.color || component.data?.color;
    const bgColor = component.style?.backgroundColor;

    let code = `    ${component.id} = lv_textarea_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;
    code += `    lv_textarea_set_one_line(${component.id}, true);\n`;

    if (placeholder) {
      code += `    lv_textarea_set_placeholder_text(${component.id}, "${escapeCString(String(placeholder))}");\n`;
    }
    if (text) {
      code += `    lv_textarea_set_text(${component.id}, "${escapeCString(String(text))}");\n`;
    }
    if (color) {
      const colorHex = parseColorHex(String(color));
      code += `    lv_obj_set_style_text_color(${component.id}, lv_color_hex(0x${colorHex}), LV_PART_MAIN);\n`;
    }
    if (bgColor) {
      const bgColorHex = parseColorHex(String(bgColor));
      code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${bgColorHex}), LV_PART_MAIN);\n`;
      code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_COVER, LV_PART_MAIN);\n`;
    }

    return code;
  }
}
