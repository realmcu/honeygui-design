/**
 * hg_radio component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { parseColorHex, escapeCString, getLvglFontBySize, getContrastTextColor } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglRadioGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const text = component.data?.label || component.data?.text || component.name || '';
    const checked = component.data?.checked === true || component.data?.value === true;
    const color = component.style?.color || component.data?.color;
    const fontSize = Number(component.style?.fontSize || component.data?.fontSize || 16);
    const fontFile = component.data?.fontFile;
    const indicatorSize = Math.min(width, height);

    let code = `    ${component.id} = lv_checkbox_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;

    code += `    {\n`;
    code += `        const lv_font_t * _font = lv_obj_get_style_text_font(${component.id}, LV_PART_MAIN);\n`;
    code += `        lv_coord_t _fh = lv_font_get_line_height(_font);\n`;
    code += `        lv_coord_t _pad = (${indicatorSize} - _fh) / 2;\n`;
    code += `        if(_pad < 0) _pad = 0;\n`;
    code += `        lv_obj_set_style_pad_all(${component.id}, _pad, LV_PART_INDICATOR);\n`;
    code += `    }\n`;

    if (text) {
      code += `    lv_checkbox_set_text(${component.id}, "${escapeCString(String(text))}");\n`;
    } else {
      code += `    lv_checkbox_set_text(${component.id}, "");\n`;
    }

    code += `    lv_obj_set_radio_button(${component.id}, true);\n`;
    code += `    radio_style_init();\n`;
    code += `    lv_obj_add_style(${component.id}, &style_radio, LV_PART_INDICATOR);\n`;
    code += `    lv_obj_add_style(${component.id}, &style_radio_chk, LV_PART_INDICATOR | LV_STATE_CHECKED);\n`;

    if (checked) {
      code += `    lv_obj_add_state(${component.id}, LV_STATE_CHECKED);\n`;
    }

    if (color) {
      const colorHex = parseColorHex(String(color));
      code += `    lv_obj_set_style_text_color(${component.id}, lv_color_hex(0x${colorHex}), LV_PART_MAIN);\n`;
    } else {
      const parentBgColor = ctx.getAncestorBackgroundColor(component);
      if (parentBgColor) {
        const contrastColor = getContrastTextColor(parentBgColor);
        code += `    lv_obj_set_style_text_color(${component.id}, lv_color_hex(0x${contrastColor}), LV_PART_MAIN);\n`;
      }
    }

    const customFontVar = fontFile ? ctx.getBuiltinFontVar(String(fontFile), fontSize) : null;
    if (customFontVar) {
      code += `    lv_obj_set_style_text_font(${component.id}, &${customFontVar}, LV_PART_MAIN);\n`;
    } else if (fontSize !== 16) {
      const fontName = getLvglFontBySize(fontSize);
      code += `    lv_obj_set_style_text_font(${component.id}, &${fontName}, LV_PART_MAIN);\n`;
    }

    const cbName = `${component.id}_event_cb`;
    code += `    lv_obj_add_event_cb(${component.id}, ${cbName}, LV_EVENT_VALUE_CHANGED, NULL);\n`;

    return code;
  }

  generateGlobalDefinitions(components: Component[]): string {
    const radios = components.filter(c => c.type === 'hg_radio');
    if (radios.length === 0) { return ''; }

    let code = `// Radio button styles (circular indicator)\n`;
    code += `static lv_style_t style_radio;\n`;
    code += `static lv_style_t style_radio_chk;\n`;
    code += `static bool style_radio_initialized = false;\n\n`;
    code += `static void radio_style_init(void)\n`;
    code += `{\n`;
    code += `    if(style_radio_initialized) return;\n`;
    code += `    style_radio_initialized = true;\n\n`;
    code += `    lv_style_init(&style_radio);\n`;
    code += `    lv_style_set_radius(&style_radio, LV_RADIUS_CIRCLE);\n\n`;
    code += `    lv_style_init(&style_radio_chk);\n`;
    code += `    lv_style_set_bg_image_src(&style_radio_chk, NULL);\n`;
    code += `}\n\n`;
    return code;
  }
}
