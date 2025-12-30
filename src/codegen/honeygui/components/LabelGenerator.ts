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

    // 文本内容（如果有时间格式，使用占位符）
    const timeFormat = component.data?.timeFormat;
    const rawText = timeFormat ? this.getTimeFormatPlaceholder(timeFormat) : (component.data?.text ?? '');
    const text = String(rawText);  // 确保是字符串
    code += `${indentStr}gui_text_content_set((gui_text_t *)${component.id}, (void *)"${text}", ${text.length});\n`;

    // 颜色
    const color = component.style?.color;
    if (color) {
      const rgb = this.colorToRgb(color);
      code += `${indentStr}gui_text_color_set((gui_text_t *)${component.id}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}));\n`;
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

    // 时间格式的 label 不需要在这里注册事件，由 view 的 switch_in 创建定时器

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }

  /**
   * 获取时间格式的占位符
   */
  private getTimeFormatPlaceholder(format: string): string {
    switch (format) {
      case 'HH:mm:ss': return '00:00:00';
      case 'HH:mm': return '00:00';
      case 'YYYY-MM-DD': return '2024-01-01';
      case 'YYYY-MM-DD HH:mm:ss': return '2024-01-01 00:00:00';
      case 'MM-DD HH:mm': return '01-01 00:00';
      default: return '00:00:00';
    }
  }

  /**
   * 将颜色字符串转换为 RGB 对象
   */
  private colorToRgb(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      } else if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
    }
    return { r: 255, g: 255, b: 255 };  // 默认白色
  }
}
