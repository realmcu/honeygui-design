/**
 * hg_view component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglViewGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const isRootView = parentRef === 'parent';
    const posX = isRootView ? 0 : Math.round(x);
    const posY = isRootView ? 0 : Math.round(y);

    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
    code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;

    const bgColor = component.style?.backgroundColor;
    if (bgColor) {
      code += LvglStyleGenerator.generateBackgroundColor(component.id, bgColor);
    }

    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);
    return code;
  }
}
