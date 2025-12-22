/**
 * hg_arc 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ArcGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y } = component.position;
    
    // 从 style 中获取参数，设置默认值
    const radius = component.style?.radius || 40;
    const startAngle = component.style?.startAngle || 0;
    const endAngle = component.style?.endAngle || 270;
    const strokeWidth = component.style?.strokeWidth || 8;
    const color = component.style?.color || 'APP_COLOR_WHITE';

    return `${indentStr}${component.id} = gui_arc_create(${parentRef}, "${component.name}", ${x}, ${y}, ${radius}, ${startAngle}, ${endAngle}, ${strokeWidth}, ${color});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 透明度
    if (component.style?.opacity !== undefined) {
      code += `${indentStr}${component.id}->opacity_value = ${component.style.opacity};\n`;
    }

    return code;
  }
}
