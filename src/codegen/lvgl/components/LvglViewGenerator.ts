/**
 * hg_view component LVGL code generator
 *
 * hg_view maps to LVGL screen (lv_obj_create(NULL)).
 * Each root view becomes an independent screen object.
 * Entry view is loaded via lv_screen_load().
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglViewGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { width, height } = component.position;
    const isRootView = parentRef === 'parent';

    let code = '';

    if (isRootView) {
      // Root view → independent LVGL screen
      code += `    ${component.id} = lv_obj_create(NULL);\n`;
      code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
    } else {
      // Nested view (non-root) → child object
      const { x, y } = component.position;
      code += `    ${component.id} = lv_obj_create(${parentRef});\n`;
      code += `    lv_obj_set_pos(${component.id}, ${Math.round(x)}, ${Math.round(y)});\n`;
      code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
    }

    code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;
    code += `    lv_obj_clear_flag(${component.id}, LV_OBJ_FLAG_SCROLLABLE);\n`;

    const bgColor = component.style?.backgroundColor;
    if (bgColor) {
      code += LvglStyleGenerator.generateBackgroundColor(component.id, bgColor);
    }

    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);

    // Entry view → load as active screen
    if (isRootView && (component.data?.entry === true || component.data?.entry === 'true')) {
      code += `    lv_screen_load(${component.id});\n`;
    }

    return code;
  }
}
