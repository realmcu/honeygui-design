/**
 * hg_list 组件代码生成器
 * TODO: 实现列表特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ListGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现列表创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_list_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // TODO: 实现列表属性设置
    if (component.style?.direction) {
      code += `${indentStr}// TODO: gui_list_set_direction(${component.id}, ${component.style.direction});\n`;
    }

    return code;
  }
}
