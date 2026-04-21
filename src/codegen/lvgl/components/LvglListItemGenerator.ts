/**
 * hg_list_item component LVGL code generator
 *
 * hg_list_item maps to lv_list_add_button() inside a lv_list.
 * The list button is a flex-row container that can hold child components.
 *
 * In the designer, each list item contains arbitrary child components
 * (typically hg_image + hg_label). The child components are generated
 * separately by their own generators and parented to this list item.
 *
 * We use lv_obj_create (plain container) instead of lv_list_add_button
 * because list_add_button creates its own internal label/icon structure,
 * which conflicts with the designer's custom child layout.
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglListItemGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { width, height } = this.resolveSize(component);

    // Create a plain container as list item (flex-row layout like lv_list_button)
    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;

    // Width: 100% of parent list, height: fixed from designer
    code += `    lv_obj_set_size(${component.id}, LV_PCT(100), ${height});\n`;

    // Remove default styles for clean appearance
    code += `    lv_obj_set_style_pad_all(${component.id}, 0, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_border_width(${component.id}, 0, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_TRANSP, LV_PART_MAIN);\n`;

    // Disable scrolling on individual items
    code += `    lv_obj_clear_flag(${component.id}, LV_OBJ_FLAG_SCROLLABLE);\n`;

    return code;
  }
}
