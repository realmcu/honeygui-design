/**
 * hg_canvas 组件代码生成器
 * TODO: 实现画布特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class CanvasGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现画布创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_canvas_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(_component: Component, _indent: number, _context: GeneratorContext): string {
    // TODO: 实现画布属性设置
    return '';
  }
}
