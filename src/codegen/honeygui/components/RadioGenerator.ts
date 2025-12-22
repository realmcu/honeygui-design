/**
 * hg_radio 组件代码生成器
 * TODO: 实现单选框特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class RadioGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现单选框创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_radio_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    if (component.data?.value !== undefined) {
      code += `${indentStr}// TODO: gui_radio_set_selected(${component.id}, ${component.data.value});\n`;
    }

    return code;
  }
}
