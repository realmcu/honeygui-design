/**
 * hg_rect 组件代码生成器
 * TODO: 实现矩形特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class RectGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现矩形创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_rect_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // TODO: 实现矩形属性设置
    if (component.style?.borderRadius) {
      code += `${indentStr}// TODO: gui_rect_set_border_radius(${component.id}, ${component.style.borderRadius});\n`;
    }

    return code;
  }
}
