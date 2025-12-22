/**
 * hg_svg 组件代码生成器
 * TODO: 实现 SVG 特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class SvgGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现 SVG 创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_svg_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // TODO: 实现 SVG 属性设置
    if (component.data?.src) {
      code += `${indentStr}// TODO: gui_svg_set_src(${component.id}, "${component.data.src}");\n`;
    }

    return code;
  }
}
