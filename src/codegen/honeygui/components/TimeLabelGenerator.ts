/**
 * hg_time_label 组件代码生成器
 * 继承自 LabelGenerator，专门处理时间格式显示
 */
import { Component } from '../../../hml/types';
import { GeneratorContext } from './ComponentGenerator';
import { LabelGenerator } from './LabelGenerator';

export class TimeLabelGenerator extends LabelGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    const timeFormat = component.data?.timeFormat || 'HH:mm:ss';
    
    // 检查是否是拆分时间格式
    if (timeFormat === 'HH:mm-split') {
      return this.generateSplitTimeCreation(component, indent, context);
    }

    // 时间标签不支持滚动，使用普通 text
    return `${indentStr}${component.id} = gui_text_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const timeFormat = component.data?.timeFormat || 'HH:mm:ss';
    
    // 拆分时间格式的属性设置在 generateSplitTimeCreation 中已完成
    if (timeFormat === 'HH:mm-split') {
      return '';
    }
    
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 获取属性值
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    // 时间标签：使用全局变量，长度动态计算
    const varName = `${component.id}_time_str`;
    const text = varName;
    const textLengthExpr = `strlen(${varName})`;

    // 确定字体类型
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;

    // 设置文本内容和基本属性
    code += `${indentStr}gui_text_set((gui_text_t *)${component.id}, ${text}, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), ${textLengthExpr}, ${fontSize});\n`;

    // 设置字体文件路径（如果指定了字体文件）
    if (fontFile) {
      const convertedFontFile = this.getConvertedFontFileName(component);
      const fontMode = this.getFontMode();
      code += `${indentStr}gui_text_type_set((gui_text_t *)${component.id}, "${convertedFontFile}", ${fontMode});\n`;
    }

    // 对齐方式
    const textMode = this.getTextMode(component);
    code += `${indentStr}gui_text_mode_set((gui_text_t *)${component.id}, ${textMode});\n`;

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

    // 断词保护
    const wordBreak = component.style?.wordBreak;
    if (wordBreak === true) {
      code += `${indentStr}gui_text_wordwrap_set((gui_text_t *)${component.id}, true);\n`;
    }

    // 可见性
    if (component.visible === false) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, false);\n`;
    }

    return code;
  }

  /**
   * 生成拆分时间格式的代码（小时、冒号、分钟 + 呼吸灯动画）
   */
  private generateSplitTimeCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width } = component.position;
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    // 高度直接使用字体大小
    const height = Number(fontSize);
    
    // 检查是否启用换行
    const wordWrap = component.style?.wordWrap || false;
    
    const numX = Number(x);
    const numY = Number(y);
    const numWidth = Number(width);
    
    if (wordWrap) {
      // 换行模式：小时在第一行，冒号和分钟在第二行
      const fontSizeNum = Number(component.data?.fontSize) || 16;
      const digitCharWidth = Math.floor(fontSizeNum * 0.5);
      const twoDigitsWidth = digitCharWidth * 2;
      const colonWidth = Math.max(Math.floor(fontSizeNum / 4), 20);
      const colonSpacing = Math.floor(fontSizeNum / 8);
      const centerX = numX + Math.floor(numWidth / 2);
      
      const hourWidth = twoDigitsWidth;
      const hourX = centerX - Math.floor(hourWidth / 2);
      const hourY = numY;
      
      const secondLineWidth = colonWidth + colonSpacing + twoDigitsWidth;
      const secondLineX = centerX - Math.floor(secondLineWidth / 2);
      const colonX = secondLineX;
      const colonY = Number(numY) + Number(fontSizeNum);
      const minWidth = twoDigitsWidth;
      const minX = secondLineX + colonWidth + colonSpacing;
      const minY = Number(numY) + Number(fontSizeNum);
      
      return this.generateSplitTimeWithWrap(component, indent, context, 
        hourX, hourY, hourWidth, colonX, colonY, colonWidth, minX, minY, minWidth, fontSizeNum);
    } else {
      // 不换行模式：小时、冒号、分钟在同一行
      const colonWidth = Math.max(Math.floor(Number(fontSize) / 4), 20);
      const halfWidth = Math.floor((numWidth - colonWidth) / 2);
      const hourWidth = halfWidth;
      const minWidth = numWidth - colonWidth - hourWidth;
      const hourX = numX;
      const colonX = numX + hourWidth;
      const minX = numX + hourWidth + colonWidth;
      
      return this.generateSplitTimeInline(component, indent, context,
        hourX, numY, hourWidth, colonX, numY, colonWidth, minX, numY, minWidth, height);
    }
  }

  /**
   * 生成换行模式的拆分时间代码
   */
  private generateSplitTimeWithWrap(
    component: Component, indent: number, context: GeneratorContext,
    hourX: number, hourY: number, hourWidth: number,
    colonX: number, colonY: number, colonWidth: number,
    minX: number, minY: number, minWidth: number,
    height: number
  ): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;
    const convertedFontFile = fontFile ? this.getConvertedFontFileName(component) : '';
    const fontMode = this.getFontMode();
    
    let code = '';
    
    // 生成小时 label
    code += `${indentStr}// 拆分时间 - 小时\n`;
    code += `${indentStr}${component.id}_hour = gui_text_create(${parentRef}, "${component.name}_hour", ${hourX}, ${hourY}, ${hourWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_hour, ${component.id}_time_str, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_hour, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_hour, CENTER);\n`;
    
    const letterSpacing = component.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_hour, ${letterSpacing});\n`;
    }
    const lineSpacing = component.style?.lineSpacing;
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_hour, ${lineSpacing});\n`;
    }
    
    // 生成冒号 label
    code += `${indentStr}// 拆分时间 - 冒号（带呼吸灯）\n`;
    code += `${indentStr}${component.id}_colon = gui_text_create(${parentRef}, "${component.name}_colon", ${colonX}, ${colonY}, ${colonWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_colon, ":", ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 1, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_colon, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_colon, CENTER);\n`;
    
    // 生成分钟 label
    code += `${indentStr}// 拆分时间 - 分钟\n`;
    code += `${indentStr}${component.id}_min = gui_text_create(${parentRef}, "${component.name}_min", ${minX}, ${minY}, ${minWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_min, ${component.id}_time_str + 3, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_min, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_min, CENTER);\n`;
    
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_min, ${letterSpacing});\n`;
    }
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_min, ${lineSpacing});\n`;
    }
    
    // 创建定时器
    code += `${indentStr}// 冒号呼吸灯动画定时器\n`;
    code += `${indentStr}gui_obj_create_timer(GUI_BASE(${component.id}_colon), 50, true, ${component.id}_breath_anim_cb);\n`;
    code += `${indentStr}// 时间更新定时器\n`;
    code += `${indentStr}gui_obj_create_timer(${parentRef}, 1000, true, ${component.id}_time_update_cb);\n`;
    code += `${indentStr}${component.id} = GUI_BASE(${component.id}_hour);\n`;
    
    return code;
  }

  /**
   * 生成不换行模式的拆分时间代码
   */
  private generateSplitTimeInline(
    component: Component, indent: number, context: GeneratorContext,
    hourX: number, hourY: number, hourWidth: number,
    colonX: number, colonY: number, colonWidth: number,
    minX: number, minY: number, minWidth: number,
    height: number
  ): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const fontSize = Number(component.data?.fontSize) || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;
    const convertedFontFile = fontFile ? this.getConvertedFontFileName(component) : '';
    const fontMode = this.getFontMode();
    
    let code = '';
    
    // 生成小时 label
    code += `${indentStr}// 拆分时间 - 小时\n`;
    code += `${indentStr}${component.id}_hour = gui_text_create(${parentRef}, "${component.name}_hour", ${hourX}, ${hourY}, ${hourWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_hour, ${component.id}_time_str, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_hour, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_hour, RIGHT);\n`;
    
    const letterSpacing = component.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_hour, ${letterSpacing});\n`;
    }
    const lineSpacing = component.style?.lineSpacing;
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_hour, ${lineSpacing});\n`;
    }
    
    // 生成冒号 label
    code += `${indentStr}// 拆分时间 - 冒号（带呼吸灯）\n`;
    code += `${indentStr}${component.id}_colon = gui_text_create(${parentRef}, "${component.name}_colon", ${colonX}, ${colonY}, ${colonWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_colon, ":", ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 1, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_colon, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_colon, LEFT);\n`;
    
    // 生成分钟 label
    code += `${indentStr}// 拆分时间 - 分钟\n`;
    code += `${indentStr}${component.id}_min = gui_text_create(${parentRef}, "${component.name}_min", ${minX}, ${minY}, ${minWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_min, ${component.id}_time_str + 3, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_min, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_min, LEFT);\n`;
    
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_min, ${letterSpacing});\n`;
    }
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_min, ${lineSpacing});\n`;
    }
    
    // 创建定时器
    code += `${indentStr}// 冒号呼吸灯动画定时器\n`;
    code += `${indentStr}gui_obj_create_timer(GUI_BASE(${component.id}_colon), 50, true, ${component.id}_breath_anim_cb);\n`;
    code += `${indentStr}// 时间更新定时器\n`;
    code += `${indentStr}gui_obj_create_timer(${parentRef}, 1000, true, ${component.id}_time_update_cb);\n`;
    code += `${indentStr}${component.id} = GUI_BASE(${component.id}_hour);\n`;
    
    return code;
  }
}
