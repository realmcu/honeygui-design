/**
 * hg_window component LVGL code generator
 *
 * hg_window is a transparent container layer with optional background.
 * Maps to lv_obj (NOT lv_win, which is a desktop-style window with header).
 *
 * Note: blur effect (enableBlur) is not available in RTK LVGL v9.4.
 * The blur APIs (lv_obj_set_style_blur_backdrop/blur_radius) were introduced in v9.5.
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

    if (enableBlur) {
      // Blur not available in RTK LVGL v9.4 — fall back to semi-transparent background
      code += `    /* NOTE(lvgl): blur effect not available in LVGL v9.4, using semi-transparent background as fallback */\n`;
      const winBgColor = component.style?.backgroundColor;
      if (showBackground && winBgColor) {
        const winBgColorHex = parseColorHex(winBgColor);
        const winBgAlpha = parseColorAlpha(winBgColor);
        code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${winBgColorHex}), LV_PART_MAIN);\n`;
        const blurOpa = winBgAlpha < 255 ? winBgAlpha : 'LV_OPA_40';
        code += `    lv_obj_set_style_bg_opa(${component.id}, ${blurOpa}, LV_PART_MAIN);\n`;
      } else {
        code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_40, LV_PART_MAIN);\n`;
      }
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
