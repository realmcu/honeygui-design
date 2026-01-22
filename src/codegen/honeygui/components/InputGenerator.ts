/**
 * hg_input 组件代码生成器
 * 使用 gui_text 组件 + gui_text_input_set 实现输入功能
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class InputGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 获取占位符文本（需要进行 C 字符串转义）
    const placeholder = component.data?.placeholder || 'Input...';
    const escapedPlaceholder = this.escapeCString(placeholder);
    
    // 使用 gui_text_create 创建文本组件
    let code = `${indentStr}${component.id} = gui_text_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
    
    // 设置占位符文本
    code += `${indentStr}gui_text_set(${component.id}, (void *)"${escapedPlaceholder}", "Arial", APP_COLOR_GRAY, strlen("${escapedPlaceholder}"), ${component.style?.fontSize || 16});\n`;
    
    // 启用输入功能
    code += `${indentStr}gui_text_input_set(${component.id}, true);\n`;
    
    return code;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 如果有初始文本值（需要进行 C 字符串转义）
    if (component.data?.text) {
      const escapedText = this.escapeCString(component.data.text);
      code += `${indentStr}gui_text_set(${component.id}, (void *)"${escapedText}", "Arial", APP_COLOR_BLACK, strlen("${escapedText}"), ${component.style?.fontSize || 16});\n`;
    }
    
    // 文本颜色
    if (component.style?.color) {
      const color = this.convertColor(component.style.color);
      code += `${indentStr}gui_text_set_color(${component.id}, ${color});\n`;
    }

    return code;
  }
  
  /**
   * 转义 C 字符串中的特殊字符
   */
  private escapeCString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')   // 反斜杠必须最先处理
      .replace(/"/g, '\\"')     // 双引号
      .replace(/\n/g, '\\n')    // 换行符
      .replace(/\r/g, '\\r')    // 回车符
      .replace(/\t/g, '\\t')    // 制表符
      .replace(/\0/g, '\\0');   // 空字符
  }

  /**
   * 转换颜色值为 gui_rgb() 格式
   */
  private convertColor(color?: string): string {
    if (!color) return 'APP_COLOR_BLACK';
    
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `gui_rgb(${r}, ${g}, ${b})`;
    }
    
    return color;
  }
}
