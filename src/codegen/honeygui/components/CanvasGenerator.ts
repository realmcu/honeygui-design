/**
 * hg_canvas 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class CanvasGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    return `${indentStr}${component.id} = gui_canvas_create(${parentRef}, "${component.name}", NULL, ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // Canvas 需要设置回调函数来绘制内容
    // 这里生成注释提示用户设置回调
    code += `${indentStr}// TODO: gui_canvas_set_canvas_cb(${component.id}, your_canvas_callback);\n`;

    return code;
  }
}
