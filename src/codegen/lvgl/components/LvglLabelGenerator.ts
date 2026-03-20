/**
 * hg_label component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { parseColorHex, escapeCString, getLvglFontBySize } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglLabelGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);

    const text = component.data?.text || '';
    const color = parseColorHex(component.style?.color || component.data?.color || '#000000');
    const fontSize = Number(component.style?.fontSize || component.data?.fontSize || 16);
    const fontFile = component.data?.fontFile;

    let code = `    ${component.id} = lv_label_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_label_set_text(${component.id}, "${escapeCString(String(text))}");\n`;
    code += `    lv_obj_set_style_text_color(${component.id}, lv_color_hex(0x${color}), LV_PART_MAIN);\n`;

    const customFontVar = fontFile ? ctx.getBuiltinFontVar(String(fontFile), fontSize) : null;
    if (customFontVar) {
      code += `    lv_obj_set_style_text_font(${component.id}, &${customFontVar}, LV_PART_MAIN);\n`;
    } else {
      const fontName = getLvglFontBySize(fontSize);
      code += `    lv_obj_set_style_text_font(${component.id}, &${fontName}, LV_PART_MAIN);\n`;
    }

    return code;
  }
}
