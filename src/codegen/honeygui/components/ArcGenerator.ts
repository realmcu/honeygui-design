/**
 * hg_arc 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ArcGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 从 style 中获取参数，设置默认值
    const radius = component.style?.radius || 40;
    const startAngle = component.style?.startAngle || 0;
    const endAngle = component.style?.endAngle || 270;
    const strokeWidth = component.style?.strokeWidth || 8;
    
    // 获取透明度，默认 255（完全不透明）
    // opacity 优先从 style 读取，兼容从 data 读取
    const opacity = component.style?.opacity ?? component.data?.opacity ?? 255;
    
    // 根据透明度选择颜色格式
    const color = opacity < 255 
      ? this.convertColorWithOpacity(component.style?.color, opacity)
      : this.convertColor(component.style?.color);

    // 重要：gui_arc_create 的 x, y 参数是圆心坐标，不是矩形框左上角
    // 设计器中存储的是矩形框左上角，需要转换为圆心坐标
    // 矩形框中心 = 左上角 + 宽度/2
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return `${indentStr}${component.id} = gui_arc_create(${parentRef}, "${component.name}", ${centerX}, ${centerY}, ${radius}, ${startAngle}, ${endAngle}, ${strokeWidth}, ${color});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 注意：透明度已在 gui_rgba 中设置，不再单独设置 opacity_value

    // 渐变设置
    if (component.style?.useGradient && component.data?.gradientStops) {
      const stops = component.data.gradientStops as Array<{ position: number; color: string }>;
      if (stops.length >= 2) {
        // 使用独立的渐变角度，如果没有设置则使用弧形角度
        const gradientStartAngle = component.data?.gradientStartAngle ?? component.style?.startAngle ?? 0;
        const gradientEndAngle = component.data?.gradientEndAngle ?? component.style?.endAngle ?? 360;
        
        code += `${indentStr}// 设置角度渐变\n`;
        code += `${indentStr}gui_arc_set_angular_gradient(${component.id}, ${gradientStartAngle}, ${gradientEndAngle});\n`;
        
        stops.forEach(stop => {
          const color = this.convertColorToRgba(stop.color);
          // 确保 position 是浮点数格式（如 0.0f 而不是 0f）
          const position = Number.isInteger(stop.position) 
            ? `${stop.position}.0f` 
            : `${stop.position}f`;
          code += `${indentStr}gui_arc_add_gradient_stop(${component.id}, ${position}, ${color});\n`;
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
   * 转换颜色值为 gui_rgba() 格式（带透明度）
   */
  private convertColorWithOpacity(color: string | undefined, opacity: number): string {
    if (!color) {
      return `gui_rgba(255, 255, 255, ${opacity})`;
    }
    
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `gui_rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    return `gui_rgba(255, 255, 255, ${opacity})`;
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
