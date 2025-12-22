/**
 * hg_checkbox 组件代码生成器
 * TODO: 实现复选框特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class CheckboxGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现复选框创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_checkbox_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    if (component.data?.value !== undefined) {
      code += `${indentStr}// TODO: gui_checkbox_set_checked(${component.id}, ${component.data.value});\n`;
    }

    return code;
  }
}
