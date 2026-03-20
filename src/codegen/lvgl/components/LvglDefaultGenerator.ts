/**
 * Default (unknown type) component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglDefaultGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    let code = `    ${component.id} = lv_obj_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${Math.round(x)}, ${Math.round(y)});\n`;
    code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
    code += `    /* TODO(lvgl): Unsupported component type ${component.type}, using placeholder object */\n`;
    return code;
  }
}
