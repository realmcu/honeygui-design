/**
 * hg_circle component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { normalizeHexColor, resolveGradientStops, toFiniteNumber, escapeCString } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglCircleGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const fillColor = this.resolveCircleFillColor(component);
    const opacity = Math.max(0, Math.min(255, Math.round(Number(component.style?.opacity ?? component.data?.opacity ?? 255))));
    const useGradient = component.style?.useGradient === true;
    const gradientType = String(component.style?.gradientType || 'radial');
    const gradientStops = resolveGradientStops(component.data?.gradientStops, fillColor);
    const startAngle = toFiniteNumber(component.data?.gradientStartAngle, 0);
    const endAngle = toFiniteNumber(component.data?.gradientEndAngle, 360);

    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;
    code += `    lv_obj_set_style_radius(${component.id}, LV_RADIUS_CIRCLE, LV_PART_MAIN);\n`;
    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += `    lv_obj_set_style_bg_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${fillColor}), LV_PART_MAIN);\n`;

    if (useGradient && gradientStops.length >= 2) {
      code += this.generateGradient(component, gradientType, gradientStops, opacity, startAngle, endAngle);
    } else if (useGradient) {
      code += `    /* NOTE(lvgl): hg_circle gradient requires at least 2 color stops, falling back to solid fill */\n`;
    }

    if (component.data?.buttonMode && component.data?.buttonMode !== 'none') {
      code += `    /* TODO(lvgl): hg_circle buttonMode=${escapeCString(String(component.data.buttonMode))} not yet mapped */\n`;
    }

    return code;
  }

  private resolveCircleFillColor(component: Component): string {
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
    gradientType: string,
    gradientStops: Array<{ colorHex: string; frac: number }>,
    opacity: number,
    startAngle: number,
    endAngle: number
  ): string {
    const gradVar = `${component.id}_grad_dsc`;
    const gradInitVar = `${component.id}_grad_initialized`;
    const gradColorsVar = `${component.id}_grad_colors`;
    const gradOpaVar = `${component.id}_grad_opas`;
    const gradFracsVar = `${component.id}_grad_fracs`;

    let code = `    static lv_grad_dsc_t ${gradVar};\n`;
    code += `    static bool ${gradInitVar} = false;\n`;
    code += `    static lv_color_t ${gradColorsVar}[${gradientStops.length}];\n`;
    code += `    static const lv_opa_t ${gradOpaVar}[${gradientStops.length}] = { ${gradientStops.map(() => 'LV_OPA_COVER').join(', ')} };\n`;
    code += `    static const uint8_t ${gradFracsVar}[${gradientStops.length}] = { ${gradientStops.map((stop) => `${stop.frac}`).join(', ')} };\n`;
    code += `    if (!${gradInitVar}) {\n`;
    gradientStops.forEach((stop, index) => {
      code += `        ${gradColorsVar}[${index}] = lv_color_hex(0x${stop.colorHex});\n`;
    });
    code += `        lv_grad_init_stops(&${gradVar}, ${gradColorsVar}, ${gradOpaVar}, ${gradFracsVar}, ${gradientStops.length});\n`;
    if (gradientType === 'angular') {
      code += `        lv_grad_conical_init(&${gradVar}, LV_GRAD_CENTER, LV_GRAD_CENTER, ${Math.round(startAngle)}, ${Math.round(endAngle)}, LV_GRAD_EXTEND_PAD);\n`;
    } else {
      code += `        lv_grad_radial_init(&${gradVar}, LV_GRAD_CENTER, LV_GRAD_CENTER, LV_GRAD_RIGHT, LV_GRAD_CENTER, LV_GRAD_EXTEND_PAD);\n`;
    }
    code += `        ${gradInitVar} = true;\n`;
    code += `    }\n`;
    code += `    lv_obj_set_style_bg_grad(${component.id}, &${gradVar}, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_grad_dir(${component.id}, ${gradientType === 'angular' ? 'LV_GRAD_DIR_CONICAL' : 'LV_GRAD_DIR_RADIAL'}, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_grad_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    return code;
  }
}
