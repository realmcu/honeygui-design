/**
 * hg_button 组件代码生成器
 * TODO: 实现按钮特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { HoneyGuiApiMapper } from '../HoneyGuiApiMapper';

export class ButtonGenerator implements ComponentCodeGenerator {
  private apiMapper = new HoneyGuiApiMapper();

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现按钮创建逻辑
    return `${indentStr}${component.id} = gui_button_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // TODO: 实现按钮属性设置
    if (component.data?.text) {
      code += `${indentStr}// TODO: gui_button_set_text(${component.id}, "${component.data.text}");\n`;
    }

    return code;
  }
}
