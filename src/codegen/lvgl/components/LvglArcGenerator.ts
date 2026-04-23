/**
 * hg_arc component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { parseColorHex } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglArcGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const posX = Math.round(x);
    const posY = Math.round(y);
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const startAngle = Number(component.style?.startAngle ?? 0);
    const endAngle = Number(component.style?.endAngle ?? 270);
    const strokeWidth = Number(component.style?.strokeWidth ?? 8);
    const color = component.style?.color || '#007acc';
    const opacity = Math.max(0, Math.min(255, Math.round(Number(component.style?.opacity ?? component.data?.opacity ?? 255))));
    const colorHex = parseColorHex(color);

    const lvglStart = Math.round(startAngle) % 360;
    const lvglEnd = Math.round(endAngle) % 360;

    let code = `    ${component.id} = lv_arc_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${w}, ${h});\n`;

    code += `    lv_obj_remove_style(${component.id}, NULL, LV_PART_KNOB);\n`;
    code += `    lv_arc_set_rotation(${component.id}, 0);\n`;
    code += `    lv_arc_set_mode(${component.id}, LV_ARC_MODE_NORMAL);\n`;

    code += `    lv_arc_set_bg_angles(${component.id}, 0, 360);\n`;
    code += `    lv_obj_set_style_arc_width(${component.id}, 0, LV_PART_MAIN);\n`;

    code += `    lv_arc_set_angles(${component.id}, ${lvglStart}, ${lvglEnd});\n`;
    code += `    lv_obj_set_style_arc_width(${component.id}, ${Math.round(strokeWidth)}, LV_PART_INDICATOR);\n`;
    code += `    lv_obj_set_style_arc_rounded(${component.id}, true, LV_PART_INDICATOR);\n`;

    code += `    lv_obj_set_style_arc_color(${component.id}, lv_color_hex(0x${colorHex}), LV_PART_INDICATOR);\n`;

    if (opacity < 255) {
      code += `    lv_obj_set_style_arc_opa(${component.id}, ${opacity}, LV_PART_INDICATOR);\n`;
    }

    code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_TRANSP, LV_PART_MAIN);\n`;
    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);

    return code;
  }
}
