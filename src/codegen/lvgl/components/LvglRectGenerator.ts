/**
 * hg_rect component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { normalizeHexColor, resolveGradientStops, escapeCString } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglRectGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const posX = Math.round(x);
    const posY = Math.round(y);
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const opacity = Math.max(0, Math.min(255, Math.round(Number(component.style?.opacity ?? component.data?.opacity ?? 255))));
    const fillColor = this.resolveRectFillColor(component);
    const useGradient = component.style?.useGradient === true;
    const gradientDirection = String(component.style?.gradientDirection || 'horizontal');
    const gradientStops = resolveGradientStops(component.data?.gradientStops, fillColor);

    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${w}, ${h});\n`;
    code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;
    code += LvglStyleGenerator.generateBorderRadius(component.id, Number(component.style?.borderRadius || 0), w, h);
    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${fillColor}), LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;

    if (useGradient && gradientStops.length >= 2) {
      code += this.generateGradient(component, gradientDirection, gradientStops, opacity);
    } else if (useGradient) {
      code += `    /* NOTE(lvgl): hg_rect gradient requires at least 2 color stops, falling back to solid fill */\n`;
    }

    if (component.data?.buttonMode && component.data?.buttonMode !== 'none') {
      code += `    /* TODO(lvgl): hg_rect buttonMode=${escapeCString(String(component.data.buttonMode))} not yet mapped */\n`;
    }

    return code;
  }

  private resolveRectFillColor(component: Component): string {
    const buttonMode = component.data?.buttonMode;
    if (buttonMode === 'dual-state') {
      const initialOn = component.data?.buttonInitialState === 'on';
      const onColor = String(component.data?.buttonStateOnColor || '#00FF00');
      const offColor = String(component.data?.buttonStateOffColor || '#FF0000');
      return normalizeHexColor(initialOn ? onColor : offColor, 'FFFFFF');
    }
    return normalizeHexColor(String(component.style?.fillColor || '#FFFFFF'), 'FFFFFF');
  }

  private generateGradient(
    component: Component,
    gradientDirection: string,
    gradientStops: Array<{ colorHex: string; frac: number }>,
    opacity: number
  ): string {
    const isSimpleLinear = (gradientDirection === 'horizontal' || gradientDirection === 'vertical');

    if (isSimpleLinear && gradientStops.length === 2) {
      const startColor = gradientStops[0].colorHex;
      const endColor = gradientStops[gradientStops.length - 1].colorHex;
      const lvglDir = gradientDirection === 'vertical' ? 'LV_GRAD_DIR_VER' : 'LV_GRAD_DIR_HOR';
      let code = `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${startColor}), LV_PART_MAIN);\n`;
      code += `    lv_obj_set_style_bg_grad_color(${component.id}, lv_color_hex(0x${endColor}), LV_PART_MAIN);\n`;
      code += `    lv_obj_set_style_bg_grad_dir(${component.id}, ${lvglDir}, LV_PART_MAIN);\n`;
      return code;
    }

    const gradVar = `${component.id}_grad_dsc`;
    const gradInitVar = `${component.id}_grad_initialized`;
    const gradColorsVar = `${component.id}_grad_colors`;
    const gradOpaVar = `${component.id}_grad_opas`;
    const gradFracsVar = `${component.id}_grad_fracs`;

    let code = `    static lv_grad_dsc_t ${gradVar};\n`;
    code += `    static bool ${gradInitVar} = false;\n`;
    code += `    static lv_color_t ${gradColorsVar}[${gradientStops.length}];\n`;
    code += `    static const lv_opa_t ${gradOpaVar}[${gradientStops.length}] = { ${gradientStops.map(() => 'LV_OPA_COVER').join(', ')} };\n`;
    code += `    static const uint8_t ${gradFracsVar}[${gradientStops.length}] = { ${gradientStops.map(s => `${s.frac}`).join(', ')} };\n`;
    code += `    if (!${gradInitVar}) {\n`;
    gradientStops.forEach((stop, index) => {
      code += `        ${gradColorsVar}[${index}] = lv_color_hex(0x${stop.colorHex});\n`;
    });
    code += `        lv_grad_init_stops(&${gradVar}, ${gradColorsVar}, ${gradOpaVar}, ${gradFracsVar}, ${gradientStops.length});\n`;

    if (gradientDirection === 'vertical') {
      code += `        lv_grad_linear_init(&${gradVar}, LV_GRAD_CENTER, LV_GRAD_TOP, LV_GRAD_CENTER, LV_GRAD_BOTTOM, LV_GRAD_EXTEND_PAD);\n`;
    } else if (gradientDirection === 'diagonal_tl_br') {
      code += `        lv_grad_linear_init(&${gradVar}, LV_GRAD_LEFT, LV_GRAD_TOP, LV_GRAD_RIGHT, LV_GRAD_BOTTOM, LV_GRAD_EXTEND_PAD);\n`;
    } else if (gradientDirection === 'diagonal_tr_bl') {
      code += `        lv_grad_linear_init(&${gradVar}, LV_GRAD_RIGHT, LV_GRAD_TOP, LV_GRAD_LEFT, LV_GRAD_BOTTOM, LV_GRAD_EXTEND_PAD);\n`;
    } else {
      code += `        lv_grad_linear_init(&${gradVar}, LV_GRAD_LEFT, LV_GRAD_CENTER, LV_GRAD_RIGHT, LV_GRAD_CENTER, LV_GRAD_EXTEND_PAD);\n`;
    }

    code += `        ${gradInitVar} = true;\n`;
    code += `    }\n`;
    code += `    lv_obj_set_style_bg_grad(${component.id}, &${gradVar}, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_grad_dir(${component.id}, LV_GRAD_DIR_LINEAR, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_grad_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    return code;
  }
}
