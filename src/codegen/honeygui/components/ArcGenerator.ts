/**
 * hg_arc 组件代码生成器
 * 支持独立 arc 和 arc group 两种模式
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

/**
 * Arc Group 信息
 */
interface ArcGroupInfo {
  name: string;
  arcs: Component[];
  boundingBox: { x: number; y: number; width: number; height: number };
}

export class ArcGenerator implements ComponentCodeGenerator {
  /**
   * 收集同一父组件下的所有 arc 群组
   */
  static collectArcGroups(components: Component[]): Map<string, ArcGroupInfo> {
    const groups = new Map<string, ArcGroupInfo>();
    
    components.forEach(comp => {
      if (comp.type === 'hg_arc' && comp.data?.arcGroup) {
        const groupName = comp.data.arcGroup as string;
        const parentId = comp.parent || 'root';
        const groupKey = `${parentId}_${groupName}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            name: groupName,
            arcs: [],
            boundingBox: { x: Infinity, y: Infinity, width: 0, height: 0 }
          });
        }
        
        const group = groups.get(groupKey)!;
        group.arcs.push(comp);
        
        // 更新包围盒
        const { x, y, width, height } = comp.position;
        const radius = comp.style?.radius || 40;
        const strokeWidth = comp.style?.strokeWidth || 8;
        const arcSize = (radius + strokeWidth / 2) * 2 + 4;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const arcLeft = centerX - arcSize / 2;
        const arcTop = centerY - arcSize / 2;
        
        group.boundingBox.x = Math.min(group.boundingBox.x, arcLeft);
        group.boundingBox.y = Math.min(group.boundingBox.y, arcTop);
        const right = Math.max(
          group.boundingBox.x + group.boundingBox.width,
          arcLeft + arcSize
        );
        const bottom = Math.max(
          group.boundingBox.y + group.boundingBox.height,
          arcTop + arcSize
        );
        group.boundingBox.width = right - group.boundingBox.x;
        group.boundingBox.height = bottom - group.boundingBox.y;
      }
    });
    
    return groups;
  }

  /**
   * 生成 arc group 创建代码
   */
  static generateGroupCreation(groupKey: string, groupInfo: ArcGroupInfo, parentRef: string, indent: number): string {
    const indentStr = '    '.repeat(indent);
    const { x, y, width, height } = groupInfo.boundingBox;
    const groupVarName = `arc_group_${groupInfo.name}`;
    
    let code = `${indentStr}// Arc Group: ${groupInfo.name}\n`;
    code += `${indentStr}gui_arc_group_t *${groupVarName} = gui_arc_group_create(${parentRef}, "${groupInfo.name}", ${Math.floor(x)}, ${Math.floor(y)}, ${Math.ceil(width)}, ${Math.ceil(height)});\n`;
    
    // 计算群组内的相对坐标
    const groupCenterX = width / 2;
    const groupCenterY = height / 2;
    
    // 为每个 arc 生成 add_arc 调用
    groupInfo.arcs.forEach((arc, index) => {
      const { x: arcX, y: arcY, width: arcW, height: arcH } = arc.position;
      const radius = arc.style?.radius || 40;
      const startAngle = arc.style?.startAngle || 0;
      const endAngle = arc.style?.endAngle || 270;
      const strokeWidth = arc.style?.strokeWidth || 8;
      const opacity = arc.style?.opacity ?? arc.data?.opacity ?? 255;
      const color = ArcGenerator.convertColorWithOpacity(arc.style?.color, opacity);
      
      // 计算 arc 圆心相对于群组的位置
      const arcCenterX = (arcX + arcW / 2) - x;
      const arcCenterY = (arcY + arcH / 2) - y;
      
      code += `${indentStr}gui_arc_group_add_arc(${groupVarName}, ${arcCenterX.toFixed(1)}f, ${arcCenterY.toFixed(1)}f, ${radius}.0f, ${startAngle}.0f, ${endAngle}.0f, ${strokeWidth}.0f, ${color});\n`;
    });
    
    code += `${indentStr}GUI_UNUSED(${groupVarName});\n`;
    
    return code;
  }

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    // 如果属于群组，跳过独立创建（由群组统一处理）
    if (component.data?.arcGroup) {
      return '';
    }
    
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 从 style 中获取参数，设置默认值
    const radius = component.style?.radius || 40;
    const startAngle = component.style?.startAngle || 0;
    const endAngle = component.style?.endAngle || 270;
    const strokeWidth = component.style?.strokeWidth || 8;
    
    // 获取透明度，默认 255（完全不透明）
    const opacity = component.style?.opacity ?? component.data?.opacity ?? 255;
    
    // 根据透明度选择颜色格式
    const color = opacity < 255 
      ? ArcGenerator.convertColorWithOpacity(component.style?.color, opacity)
      : this.convertColor(component.style?.color);

    // 重要：gui_arc_create 的 x, y 参数是圆心坐标，不是矩形框左上角
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return `${indentStr}${component.id} = gui_arc_create(${parentRef}, "${component.name}", ${centerX}, ${centerY}, ${radius}, ${startAngle}, ${endAngle}, ${strokeWidth}, ${color});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    // 如果属于群组，跳过（渐变已在群组创建时处理）
    if (component.data?.arcGroup) {
      return '';
    }
    
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 渐变设置
    if (component.style?.useGradient && component.data?.gradientStops) {
      const stops = component.data.gradientStops as Array<{ position: number; color: string }>;
      if (stops.length >= 2) {
        const gradientStartAngle = component.data?.gradientStartAngle ?? component.style?.startAngle ?? 0;
        const gradientEndAngle = component.data?.gradientEndAngle ?? component.style?.endAngle ?? 360;
        
        code += `${indentStr}// 设置角度渐变\n`;
        code += `${indentStr}gui_arc_set_angular_gradient(${component.id}, ${gradientStartAngle}, ${gradientEndAngle});\n`;
        
        stops.forEach(stop => {
          const color = ArcGenerator.convertColorToRgba(stop.color);
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
  static convertColorWithOpacity(color: string | undefined, opacity: number): string {
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
  static convertColorToRgba(color: string): string {
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `gui_rgba(${r}, ${g}, ${b}, 255)`;
    }
    
    return `gui_rgba(255, 255, 255, 255)`;
  }
}
