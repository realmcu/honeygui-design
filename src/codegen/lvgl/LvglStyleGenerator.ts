/**
 * LVGL 通用样式代码生成模块
 * 集中处理 backgroundColor、opacity、borderRadius、borderWidth、padding 等通用样式属性的 LVGL 代码生成
 */
import { parseColorHex, parseColorAlpha } from './LvglUtils';

export class LvglStyleGenerator {
  /**
   * 生成背景色代码：lv_obj_set_style_bg_color + lv_obj_set_style_bg_opa
   */
  static generateBackgroundColor(id: string, bgColor: string): string {
    const hex = parseColorHex(bgColor);
    const alpha = parseColorAlpha(bgColor);
    let code = `    lv_obj_set_style_bg_color(${id}, lv_color_hex(0x${hex}), LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${id}, ${alpha}, LV_PART_MAIN);\n`;
    return code;
  }

  /**
   * 生成透明度代码：lv_obj_set_style_bg_opa（钳位到 [0, 255]）
   */
  static generateOpacity(id: string, opacity: number): string {
    const clamped = Math.max(0, Math.min(255, Math.round(opacity)));
    return `    lv_obj_set_style_bg_opa(${id}, ${clamped}, LV_PART_MAIN);\n`;
  }

  /**
   * 生成圆角代码：lv_obj_set_style_radius（钳位到 min(w/2, h/2)）
   */
  static generateBorderRadius(id: string, radius: number, width: number, height: number): string {
    const maxRadius = Math.min(width / 2, height / 2);
    const clamped = radius > maxRadius ? Math.round(maxRadius) : Math.round(radius);
    return `    lv_obj_set_style_radius(${id}, ${clamped}, LV_PART_MAIN);\n`;
  }

  /**
   * 生成边框宽度代码：lv_obj_set_style_border_width
   */
  static generateBorderWidth(id: string, borderWidth: number): string {
    return `    lv_obj_set_style_border_width(${id}, ${Math.round(borderWidth)}, LV_PART_MAIN);\n`;
  }

  /**
   * 生成内边距代码：lv_obj_set_style_pad_all
   */
  static generatePadding(id: string, padding: number): string {
    return `    lv_obj_set_style_pad_all(${id}, ${Math.round(padding)}, LV_PART_MAIN);\n`;
  }
}
