/**
 * hg_window component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { parseColorHex, parseColorAlpha } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglWindowGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;

    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${Math.round(x)}, ${Math.round(y)});\n`;
    code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
    code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;

    const showBackground = component.style?.showBackground ?? false;
    const enableBlur = component.data?.enableBlur ?? false;
    const blurDegree = component.data?.blurDegree ?? 225;

    if (enableBlur) {
      const winBgColor = component.style?.backgroundColor;
      if (showBackground && winBgColor) {
        const winBgColorHex = parseColorHex(winBgColor);
        const winBgAlpha = parseColorAlpha(winBgColor);
        code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${winBgColorHex}), 0);\n`;
        const blurOpa = winBgAlpha < 255 ? winBgAlpha : 'LV_OPA_40';
        code += `    lv_obj_set_style_bg_opa(${component.id}, ${blurOpa}, 0);\n`;
      } else {
        code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_0, 0);\n`;
      }
      code += `    lv_obj_set_style_blur_backdrop(${component.id}, true, 0);\n`;
      const blurRadius = Math.max(1, Math.min(64, Math.round(blurDegree / 4)));
      code += `    lv_obj_set_style_blur_radius(${component.id}, ${blurRadius}, 0);\n`;
    } else if (showBackground) {
      const winBgColor = component.style?.backgroundColor;
      if (winBgColor) {
        const winBgColorHex = parseColorHex(winBgColor);
        const winBgAlpha = parseColorAlpha(winBgColor);
        code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${winBgColorHex}), LV_PART_MAIN);\n`;
        code += `    lv_obj_set_style_bg_opa(${component.id}, ${winBgAlpha}, LV_PART_MAIN);\n`;
      }
    } else {
      code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_TRANSP, LV_PART_MAIN);\n`;
    }

    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);
    return code;
  }
}
