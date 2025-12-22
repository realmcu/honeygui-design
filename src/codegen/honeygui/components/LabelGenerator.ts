/**
 * hg_label 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { HoneyGuiApiMapper } from '../HoneyGuiApiMapper';

export class LabelGenerator implements ComponentCodeGenerator {
  private apiMapper = new HoneyGuiApiMapper();

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping) {
      return `${indentStr}// 警告: 未找到 ${component.type} 的API映射\n`;
    }

    return `${indentStr}${component.id} = ${mapping.createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // fontFile 必须先设置
    const fontFile = component.data?.fontFile;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set((gui_text_t *)${component.id}, (void *)"${fontFile}", FONT_SRC_FILESYS);\n`;
    }

    // 字体大小
    const fontSize = component.style?.fontSize || 16;
    code += `${indentStr}gui_text_size_set((gui_text_t *)${component.id}, ${fontSize}, 0);\n`;

    // 文本内容
    const text = component.data?.text || '';
    code += `${indentStr}gui_text_content_set((gui_text_t *)${component.id}, (void *)"${text}", ${text.length});\n`;

    // 颜色
    const color = component.style?.color;
    if (color) {
      const hexColor = this.colorToHex(color);
      code += `${indentStr}gui_text_color_set((gui_text_t *)${component.id}, ${hexColor});\n`;
    }

    // 对齐方式
    const align = component.style?.align || 'LEFT';
    code += `${indentStr}gui_text_mode_set((gui_text_t *)${component.id}, ${align});\n`;

    // 字间距
    const letterSpacing = component.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set((gui_text_t *)${component.id}, ${letterSpacing});\n`;
    }

    // 行间距
    const lineSpacing = component.style?.lineSpacing;
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set((gui_text_t *)${component.id}, ${lineSpacing});\n`;
    }

    // 自动换行
    if (component.style?.wordWrap) {
      code += `${indentStr}gui_text_wordwrap_set((gui_text_t *)${component.id}, true);\n`;
    }

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }

  private colorToHex(color: string): string {
    if (color.startsWith('#')) {
      return '0x' + color.slice(1).toUpperCase();
    }
    return color;
  }
}
