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
    
    let src = component.data?.src || '';
    // 去掉 assets/ 前缀
    src = src.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!src.startsWith('/')) {
      src = '/' + src;
    }

    // 使用 gui_svg_create_from_file 创建 SVG
    return `${indentStr}${component.id} = (gui_obj_t *)gui_svg_create_from_file(${parentRef}, "${component.name}", "${src}", ${x}, ${y});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 缩放
    if (component.style?.scale !== undefined) {
      code += `${indentStr}gui_svg_set_scale((gui_svg_t *)${component.id}, ${component.style.scale}f);\n`;
    }

    // 透明度
    if (component.style?.opacity !== undefined) {
      code += `${indentStr}gui_svg_set_opacity((gui_svg_t *)${component.id}, ${component.style.opacity});\n`;
    }

    return code;
  }
}
