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
    
    // 获取占位符文本
    const placeholder = component.data?.placeholder || 'Input...';
    
    // 使用 gui_text_create 创建文本组件
    let code = `${indentStr}${component.id} = gui_text_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
    
    // 设置占位符文本
    code += `${indentStr}gui_text_set(${component.id}, (void *)"${placeholder}", "Arial", APP_COLOR_GRAY, strlen("${placeholder}"), ${component.style?.fontSize || 16});\n`;
    
    // 启用输入功能
    code += `${indentStr}gui_text_input_set(${component.id}, true);\n`;
    
    return code;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 如果有初始文本值
    if (component.data?.text) {
      code += `${indentStr}gui_text_set(${component.id}, (void *)"${component.data.text}", "Arial", APP_COLOR_BLACK, strlen("${component.data.text}"), ${component.style?.fontSize || 16});\n`;
    }
    
    // 文本颜色
    if (component.style?.color) {
      const color = this.convertColor(component.style.color);
      code += `${indentStr}gui_text_set_color(${component.id}, ${color});\n`;
    }

    return code;
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
