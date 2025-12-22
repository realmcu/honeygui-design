/**
 * hg_input 组件代码生成器
 * TODO: 实现输入框特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class InputGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现输入框创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_input_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    if (component.data?.placeholder) {
      code += `${indentStr}// TODO: gui_input_set_placeholder(${component.id}, "${component.data.placeholder}");\n`;
    }

    return code;
  }
}
