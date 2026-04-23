/**
 * hg_progressbar component LVGL code generator
 *
 * Maps to lv_bar_create(). Supports:
 * - value / min / max range
 * - indicator color (bar fill color)
 * - track background color
 * - orientation (horizontal / vertical)
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';
import { parseColorHex, parseColorAlpha } from '../LvglUtils';

export class LvglProgressBarGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, _ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const value = Number(component.data?.value ?? 0);
    const min = Number(component.data?.min ?? 0);
    const max = Number(component.data?.max ?? 100);
    const barColor = (component.style as any)?.color || '#00FF00';
    const trackColor = (component.style as any)?.backgroundColor || '#333333';
    const orientation = (component.style as any)?.orientation || 'horizontal';

    let code = `    ${component.id} = lv_bar_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;

    // Range (only emit if non-default)
    if (min !== 0 || max !== 100) {
      code += `    lv_bar_set_range(${component.id}, ${min}, ${max});\n`;
    }

    // Value
    if (value !== 0) {
      code += `    lv_bar_set_value(${component.id}, ${value}, LV_ANIM_OFF);\n`;
    }

    // Orientation
    if (orientation === 'vertical') {
      code += `    lv_bar_set_orientation(${component.id}, LV_BAR_ORIENTATION_VERTICAL);\n`;
    }

    // Indicator color (LV_PART_INDICATOR)
    const indicatorHex = parseColorHex(barColor);
    const indicatorAlpha = parseColorAlpha(barColor);
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${indicatorHex}), LV_PART_INDICATOR);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, ${indicatorAlpha}, LV_PART_INDICATOR);\n`;

    // Track background color (LV_PART_MAIN)
    const trackHex = parseColorHex(trackColor);
    const trackAlpha = parseColorAlpha(trackColor);
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${trackHex}), LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, ${trackAlpha}, LV_PART_MAIN);\n`;

    return code;
  }
}
