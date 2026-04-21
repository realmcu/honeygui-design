/**
 * hg_list component LVGL code generator
 *
 * hg_list maps to lv_list_create().
 * LVGL list is a flex-column container with built-in scrolling.
 * Each hg_list_item maps to lv_list_add_button() — a flex-row button
 * that can contain icon + label children.
 *
 * Design notes:
 * - LIST_CLASSIC style maps directly to lv_list (vertical/horizontal flex list)
 * - Other styles (CIRCLE, ZOOM, CARD, etc.) are HoneyGUI-specific;
 *   for LVGL we fall back to classic list with a TODO comment.
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglListGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const direction = String(component.data?.direction || component.style?.direction || 'VERTICAL');
    const style = String(component.data?.style || component.style?.style || 'LIST_CLASSIC');
    const space = Number(component.data?.space ?? component.style?.space ?? 5);
    const loop = component.data?.loop === true || component.data?.loop === 'true';
    const createBar = component.data?.createBar === true || component.data?.createBar === 'true';

    let code = `    ${component.id} = lv_list_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;

    // Flex direction: LVGL list defaults to LV_FLEX_FLOW_COLUMN
    if (direction === 'HORIZONTAL') {
      code += `    lv_obj_set_flex_flow(${component.id}, LV_FLEX_FLOW_ROW);\n`;
    }

    // Item spacing via flex gap
    if (space !== 0) {
      if (direction === 'HORIZONTAL') {
        code += `    lv_obj_set_style_pad_column(${component.id}, ${space}, LV_PART_MAIN);\n`;
      } else {
        code += `    lv_obj_set_style_pad_row(${component.id}, ${space}, LV_PART_MAIN);\n`;
      }
    }

    // Remove default padding for tighter layout
    code += `    lv_obj_set_style_pad_all(${component.id}, 0, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_border_width(${component.id}, 0, LV_PART_MAIN);\n`;

    // Scrollbar visibility
    if (!createBar) {
      code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;
    } else {
      code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_AUTO);\n`;
    }

    // Scroll snap for auto-align behavior (snap to start for natural list scrolling)
    if (component.data?.autoAlign === true || component.data?.autoAlign === 'true') {
      if (direction === 'HORIZONTAL') {
        code += `    lv_obj_set_scroll_snap_x(${component.id}, LV_SCROLL_SNAP_START);\n`;
      } else {
        code += `    lv_obj_set_scroll_snap_y(${component.id}, LV_SCROLL_SNAP_START);\n`;
      }
    }

    // Inertia: LVGL has scroll momentum enabled by default, disable if inertia=false
    const inertia = component.data?.inertia;
    if (inertia === false || inertia === 'false') {
      code += `    lv_obj_remove_flag(${component.id}, LV_OBJ_FLAG_SCROLL_MOMENTUM);\n`;
    }

    // Non-classic styles: add TODO comment
    if (style !== 'LIST_CLASSIC') {
      code += `    /* TODO(lvgl): List style '${style}' is HoneyGUI-specific, using classic list as fallback */\n`;
    }

    return code;
  }
}
