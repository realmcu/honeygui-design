/**
 * hg_glass 组件代码生成器
 * 玻璃效果组件，使用 gui_glass_create_from_fs 创建
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class GlassGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y } = component.position;

    const src = component.data?.src || '';
    // 将 .glass 扩展名替换为 .bin
    let binSrc = src.replace(/\.glass$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }

    // gui_glass_create_from_fs(父控件指针, "组件名", "文件路径", x, y, 0, 0)
    return `${indentStr}${component.id} = (gui_obj_t *)gui_glass_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, 0, 0);\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // Movable 属性 - 启用按压事件
    if (component.data?.movable) {
      code += `${indentStr}gui_glass_enable_pressing_envent((gui_glass_t *)${component.id});\n`;
    }

    // Click 属性 - 启用点击事件
    if (component.data?.click) {
      code += `${indentStr}gui_glass_enable_click_event((gui_glass_t *)${component.id});\n`;
    }

    // 可见性
    if (component.visible !== undefined && !component.visible) {
      code += `${indentStr}gui_obj_show(${component.id}, false);\n`;
    }

    return code;
  }
}
