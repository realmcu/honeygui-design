/**
 * hg_circle 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class CircleGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 从 style 中获取参数，设置默认值
    const radius = component.style?.radius || 40;
    const color = this.convertColor(component.style?.fillColor);

    // 重要：gui_circle_create 的 x, y 参数是圆心坐标，不是矩形框左上角
    // 设计器中存储的是矩形框左上角，需要转换为圆心坐标
    // 矩形框中心 = 左上角 + 宽度/2
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return `${indentStr}${component.id} = gui_circle_create(${parentRef}, "${component.name}", ${centerX}, ${centerY}, ${radius}, ${color});\n`;
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

  /**
   * 转换颜色值为 gui_rgb() 格式
   */
  private convertColor(color?: string): string {
    if (!color) return 'APP_COLOR_WHITE';
    
    // 如果是 #RRGGBB 格式
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `gui_rgb(${r}, ${g}, ${b})`;
    }
    
    // 如果已经是 APP_COLOR_ 或 gui_rgb() 格式，直接返回
    return color;
  }
}
