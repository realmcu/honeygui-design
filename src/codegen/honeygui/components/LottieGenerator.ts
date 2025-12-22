/**
 * hg_lottie 组件代码生成器
 * TODO: 实现 Lottie 动画特定的代码生成逻辑
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class LottieGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // TODO: 实现 Lottie 创建逻辑
    return `${indentStr}// TODO: ${component.id} = gui_lottie_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // TODO: 实现 Lottie 属性设置
    if (component.data?.src) {
      code += `${indentStr}// TODO: gui_lottie_set_src(${component.id}, "${component.data.src}");\n`;
    }
    if (component.data?.autoplay) {
      code += `${indentStr}// TODO: gui_lottie_set_autoplay(${component.id}, true);\n`;
    }

    return code;
  }
}
