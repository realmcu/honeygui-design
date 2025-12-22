/**
 * hg_image 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ImageGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const src = component.data?.src || '';
    // 将图片扩展名替换为 .bin
    let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }

    return `${indentStr}${component.id} = (gui_obj_t *)gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }
}
