/**
 * hg_svg 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class SvgGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y } = component.position;
    
    const src = component.data?.src || '';

    return `${indentStr}${component.id} = gui_svg_create_from_file(${parentRef}, "${component.name}", "${src}", ${x}, ${y});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 缩放
    if (component.style?.scale !== undefined) {
      code += `${indentStr}gui_svg_set_scale(${component.id}, ${component.style.scale});\n`;
    }

    // 透明度
    if (component.style?.opacity !== undefined) {
      code += `${indentStr}${component.id}->opacity_value = ${component.style.opacity};\n`;
    }

    return code;
  }
}
