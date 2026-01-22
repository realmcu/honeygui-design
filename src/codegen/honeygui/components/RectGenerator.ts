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
    
    // 获取透明度，默认 255（完全不透明）
    // opacity 优先从 style 读取，兼容从 data 读取
    const opacity = component.style?.opacity ?? component.data?.opacity ?? 255;
    
    // 检查是否是双态按键，如果是则使用初始状态对应的颜色
    let fillColor: string;
    const buttonMode = component.data?.buttonMode;
    if (buttonMode === 'dual-state') {
      const initialState = component.data?.buttonInitialState === 'on';
      const onColor = component.data?.buttonStateOnColor || '#00FF00';
      const offColor = component.data?.buttonStateOffColor || '#FF0000';
      const stateColor = initialState ? onColor : offColor;
      
      fillColor = opacity < 255 
        ? this.convertColorWithOpacity(stateColor, opacity)
        : this.convertColor(stateColor);
    } else {
      // 普通矩形使用 fillColor
      fillColor = opacity < 255 
        ? this.convertColorWithOpacity(component.style?.fillColor, opacity)
        : this.convertColor(component.style?.fillColor);
    }

    return `${indentStr}${component.id} = gui_rect_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height}, ${borderRadius}, ${fillColor});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 注意：透明度已在 gui_rgba 中设置，不再单独设置 opacity_value

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

    // 可见性
    if (component.visible === false) {
      code += `${indentStr}gui_obj_show(${component.id}, false);\n`;
    }

    return code;
  }

  /**
   * 生成按键效果的事件绑定
   */
  generateEventBinding(component: Component, indent: number): string {
    const buttonMode = component.data?.buttonMode;
    if (!buttonMode || buttonMode === 'none') {
      return '';
    }

    const indentStr = '    '.repeat(indent);
    
    if (buttonMode === 'dual-state') {
      // 双态按键：使用点击事件
      return `${indentStr}gui_obj_add_event_cb(${component.id}, ${component.id}_button_cb, GUI_EVENT_TOUCH_CLICKED, NULL);\n`;
    } else if (buttonMode === 'opacity') {
      // 透明度按键：使用按下和松开事件
      let code = '';
      code += `${indentStr}gui_obj_add_event_cb(${component.id}, ${component.id}_button_press_cb, GUI_EVENT_TOUCH_PRESSED, NULL);\n`;
      code += `${indentStr}gui_obj_add_event_cb(${component.id}, ${component.id}_button_release_cb, GUI_EVENT_TOUCH_RELEASED, NULL);\n`;
      return code;
    }

    return '';
  }

  /**
   * 生成按键效果的回调函数
   */
  generateButtonCallback(component: Component): string {
    const buttonMode = component.data?.buttonMode;
    if (!buttonMode || buttonMode === 'none') {
      return '';
    }

    if (buttonMode === 'dual-state') {
      return this.generateDualStateCallback(component);
    } else if (buttonMode === 'opacity') {
      return this.generateOpacityCallback(component);
    }

    return '';
  }

  /**
   * 生成双态按键回调
   */
  private generateDualStateCallback(component: Component): string {
    const onColor = component.data?.buttonStateOnColor || '#00FF00';
    const offColor = component.data?.buttonStateOffColor || '#FF0000';
    const initialState = component.data?.buttonInitialState === 'on';

    const onColorRgba = this.convertColorToRgba(onColor);
    const offColorRgba = this.convertColorToRgba(offColor);

    return `
// ${component.id} 双态按键回调
static bool ${component.id}_state = ${initialState ? 'true' : 'false'};

void ${component.id}_button_cb(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    
    // 切换状态
    ${component.id}_state = !${component.id}_state;
    
    // 根据状态切换颜色
    if (${component.id}_state) {
        gui_rect_set_color((gui_rect_t *)${component.id}, ${onColorRgba});
    } else {
        gui_rect_set_color((gui_rect_t *)${component.id}, ${offColorRgba});
    }
}

// 获取当前状态
bool ${component.id}_get_state(void)
{
    return ${component.id}_state;
}

// 设置状态（外部调用）
void ${component.id}_set_state(bool state)
{
    if (${component.id}_state != state) {
        ${component.id}_state = state;
        
        if (state) {
            gui_rect_set_color((gui_rect_t *)${component.id}, ${onColorRgba});
        } else {
            gui_rect_set_color((gui_rect_t *)${component.id}, ${offColorRgba});
        }
    }
}
`;
  }

  /**
   * 生成透明度按键回调（按下变暗，松开恢复）
   */
  private generateOpacityCallback(component: Component): string {
    const pressedOpacity = component.data?.buttonPressedOpacity || 128;
    const releasedOpacity = component.data?.buttonReleasedOpacity || 255;

    return `
// ${component.id} 透明度按键回调

// 按下时改变透明度
void ${component.id}_button_press_cb(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    
    gui_rect_set_opacity((gui_rounded_rect_t *)${component.id}, ${pressedOpacity});
}

// 松开时恢复透明度
void ${component.id}_button_release_cb(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    
    gui_rect_set_opacity((gui_rounded_rect_t *)${component.id}, ${releasedOpacity});
}
`;
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
