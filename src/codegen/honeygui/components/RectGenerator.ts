/**
 * hg_rect 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class RectGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 从 style 中获取参数，设置默认值
    let borderRadius = component.style?.borderRadius || 0;
    
    // 限制圆角半径：不能超过矩形宽度或高度的一半
    const maxRadius = Math.min(width / 2, height / 2);
    if (borderRadius > maxRadius) {
      borderRadius = maxRadius;
    }
    
    const fillColor = this.convertColor(component.style?.fillColor);

    return `${indentStr}${component.id} = gui_rect_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height}, ${borderRadius}, ${fillColor});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 透明度
    if (component.style?.opacity !== undefined) {
      code += `${indentStr}${component.id}->opacity_value = ${component.style.opacity};\n`;
    }

    // 渐变设置
    if (component.style?.useGradient && component.data?.gradientStops) {
      const stops = component.data.gradientStops as Array<{ position: number; color: string }>;
      if (stops.length >= 2) {
        const direction = component.style?.gradientDirection || 'horizontal';
        
        // 映射方向到 SDK 枚举
        const directionMap: Record<string, string> = {
          'horizontal': 'RECT_GRADIENT_HORIZONTAL',
          'vertical': 'RECT_GRADIENT_VERTICAL',
          'diagonal_tl_br': 'RECT_GRADIENT_DIAGONAL_TL_BR',
          'diagonal_tr_bl': 'RECT_GRADIENT_DIAGONAL_TR_BL'
        };
        
        const sdkDirection = directionMap[direction] || 'RECT_GRADIENT_HORIZONTAL';
        
        code += `${indentStr}// 设置线性渐变\n`;
        code += `${indentStr}gui_rect_set_linear_gradient(${component.id}, ${sdkDirection});\n`;
        
        stops.forEach(stop => {
          const color = this.convertColorToRgba(stop.color);
          // 确保 position 是浮点数格式（如 0.0f 而不是 0f）
          const position = Number.isInteger(stop.position) 
            ? `${stop.position}.0f` 
            : `${stop.position}f`;
          code += `${indentStr}gui_rect_add_gradient_stop(${component.id}, ${position}, ${color});\n`;
        });
      }
    }

    return code;
  }

  /**
   * 转换颜色值为 gui_rgb() 格式
   */
  private convertColor(color?: string): string {
    if (!color) return 'APP_COLOR_WHITE';
    
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `gui_rgb(${r}, ${g}, ${b})`;
    }
    
    return color;
  }

  /**
   * 转换颜色值为 gui_rgba() 格式（用于渐变色标）
   */
  private convertColorToRgba(color: string): string {
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      // 默认完全不透明
      return `gui_rgba(${r}, ${g}, ${b}, 255)`;
    }
    
    return `gui_rgba(255, 255, 255, 255)`;
  }
}
