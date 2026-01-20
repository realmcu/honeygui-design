/**
 * hg_label 组件代码生成器
 */
import * as path from 'path';
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { HoneyGuiApiMapper } from '../HoneyGuiApiMapper';

export class LabelGenerator implements ComponentCodeGenerator {
  private apiMapper = new HoneyGuiApiMapper();

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 检查是否启用滚动（注意：可能是字符串 'true' 或布尔值 true）
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    
    // 根据是否滚动选择不同的 API
    const createFunction = enableScroll ? 'gui_scroll_text_create' : 'gui_text_create';

    // 检查是否是拆分时间格式
    if (component.data?.timeFormat === 'HH:mm-split') {
      return this.generateSplitTimeCreation(component, indent, context);
    }

    return `${indentStr}${component.id} = ${createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    // 拆分时间格式的属性设置在 generateSplitTimeCreation 中已完成
    if (component.data?.timeFormat === 'HH:mm-split') {
      return '';
    }
    
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 检查是否启用滚动（注意：可能是字符串 'true' 或布尔值 true）
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    const scrollDirection = component.data?.scrollDirection || 'horizontal';
    const scrollReverse = component.data?.scrollReverse === true || component.data?.scrollReverse === 'true';
    
    // 根据滚动方向自动处理多行
    // Y 方向滚动强制多行，X 方向滚动不支持多行
    const forceMultiLine = enableScroll && scrollDirection === 'vertical';
    const wordWrap = forceMultiLine ? true : (component.style?.wordWrap || false);

    // 获取属性值
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    // 文本内容
    const timeFormat = component.data?.timeFormat;
    let text: string;
    let textLengthExpr: string;
    
    if (timeFormat) {
      // 时间标签：使用全局变量，长度动态计算
      const varName = `${component.id}_time_str`;
      text = varName;
      textLengthExpr = `strlen(${varName})`;
    } else {
      // 普通标签：使用静态文本，长度固定
      const staticText = String(component.data?.text ?? '');
      text = `"${staticText}"`;
      textLengthExpr = String(this.getUtf8ByteLength(staticText));
    }

    // 确定字体类型
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;

    // 根据是否滚动选择不同的 API
    const widgetCast = enableScroll ? 'gui_scroll_text_t' : 'gui_text_t';
    const setFunction = enableScroll ? 'gui_scroll_text_set' : 'gui_text_set';
    
    // 设置文本内容和基本属性
    code += `${indentStr}${setFunction}((${widgetCast} *)${component.id}, ${text}, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), ${textLengthExpr}, ${fontSize});\n`;

    // 设置字体文件路径（如果指定了字体文件）
    if (fontFile) {
      const convertedFontFile = this.getConvertedFontFileName(component);
      const fontMode = this.getFontMode();
      const typeSetFunction = enableScroll ? 'gui_scroll_text_type_set' : 'gui_text_type_set';
      code += `${indentStr}${typeSetFunction}((${widgetCast} *)${component.id}, "${convertedFontFile}", ${fontMode});\n`;
    }

    // 对齐方式 - 滚动文本不需要 gui_text_mode_set，因为 gui_scroll_text_scroll_set 有 mode 参数
    if (!enableScroll) {
      const textMode = this.getTextMode(component);
      code += `${indentStr}gui_text_mode_set((gui_text_t *)${component.id}, ${textMode});\n`;
    }

    // 滚动文本特有：设置滚动参数
    if (enableScroll) {
      // 转换滚动方向和对齐模式
      // SDK TEXT_MODE 枚举：
      // SCROLL_X = 0x30, SCROLL_X_REVERSE = 0x31
      // SCROLL_X_MID = 0x32, SCROLL_X_MID_REVERSE = 0x33
      // SCROLL_Y = 0x38, SCROLL_Y_REVERSE = 0x39
      let scrollModeStr: string;
      const vAlign = component.style?.vAlign || 'TOP';
      
      if (scrollDirection === 'horizontal') {
        // 横向滚动
        if (vAlign === 'MID') {
          scrollModeStr = scrollReverse ? 'SCROLL_X_MID_REVERSE' : 'SCROLL_X_MID';
        } else {
          scrollModeStr = scrollReverse ? 'SCROLL_X_REVERSE' : 'SCROLL_X';
        }
      } else {
        // 纵向滚动（SDK 只有 SCROLL_Y 和 SCROLL_Y_REVERSE，没有 MID 变体）
        scrollModeStr = scrollReverse ? 'SCROLL_Y_REVERSE' : 'SCROLL_Y';
      }
      
      // 获取滚动参数
      const startOffset = component.data?.scrollStartOffset ?? 0;
      const endOffset = component.data?.scrollEndOffset ?? 0;
      const interval = component.data?.scrollInterval ?? 3000;
      const duration = component.data?.scrollDuration ?? 0;
      
      // 调用 gui_scroll_text_scroll_set
      code += `${indentStr}gui_scroll_text_scroll_set((gui_scroll_text_t *)${component.id}, ${scrollModeStr}, ${startOffset}, ${endOffset}, ${interval}, ${duration});\n`;
    }

    // 字间距 - 滚动文本需要强转为 gui_text_t
    const letterSpacing = component.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set((gui_text_t *)${component.id}, ${letterSpacing});\n`;
    }

    // 行间距 - 滚动文本需要强转为 gui_text_t
    const lineSpacing = component.style?.lineSpacing;
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set((gui_text_t *)${component.id}, ${lineSpacing});\n`;
    }

    // 断词保护（英文跨行断词）- 滚动文本需要强转为 gui_text_t
    const wordBreak = component.style?.wordBreak;
    if (wordBreak === true) {
      code += `${indentStr}gui_text_wordwrap_set((gui_text_t *)${component.id}, true);\n`;
    }

    // 可见性
    if (component.visible === false) {
      code += `${indentStr}gui_obj_show(${component.id}, false);\n`;
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
    
    // 高度直接使用字体大小（参考 watchface_number.c）
    // 确保 fontSize 是数字类型
    const height = Number(fontSize);
    
    // 检查是否启用换行
    const wordWrap = component.style?.wordWrap || false;
    
    // 确保坐标是数字类型
    const numX = Number(x);
    const numY = Number(y);
    const numWidth = Number(width);
    
    // 计算三个部分的位置和尺寸
    if (wordWrap) {
      // 换行模式：小时在第一行，冒号和分钟在第二行
      // 参考 SDK 示例：
      // - 小时和分钟使用相同的 x 和宽度（以分钟的 x 为准）
      // - 冒号宽度 = 字体大小 / 2
      // - 都使用 MID_CENTER 对齐，数字自然上下对齐
      const colonWidth = Math.floor(Number(fontSize) / 2);  // 冒号宽度 = 字体大小 / 2
      const numWidth2 = numWidth - colonWidth;              // 数字部分宽度
      
      const hourX = numX + colonWidth;  // 小时 x = 原始 x + 冒号宽度
      const colonX = numX;              // 冒号在左侧
      const minX = numX + colonWidth;   // 分钟 x = 原始 x + 冒号宽度（与小时相同）
      
      const hourY = numY;
      const colonY = Number(numY) + Number(height);     // 冒号在第二行
      const minY = Number(numY) + Number(height);       // 分钟也在第二行
      
      return this.generateSplitTimeWithWrap(component, indent, context, 
        hourX, hourY, numWidth2, colonX, colonY, colonWidth, minX, minY, numWidth2, height);
    } else {
      // 不换行模式：小时、冒号、分钟在同一行
      const hourWidth = Math.floor(numWidth * 0.4);
      const colonWidth = Math.floor(numWidth * 0.2);
      const minWidth = Math.floor(numWidth * 0.4);
      
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
    
    // 确定字体类型和文件
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;
    const convertedFontFile = fontFile ? this.getConvertedFontFileName(component) : '';
    const fontMode = this.getFontMode();
    
    // 拆分时间使用固定的对齐方式
    // 参考 SDK 示例：小时和分钟都使用 MID_CENTER，数字自然上下对齐
    const hourTextMode = 'MID_CENTER';
    const minTextMode = 'MID_CENTER';
    
    let code = '';
    
    // 生成小时 label
    code += `${indentStr}// 拆分时间 - 小时\n`;
    code += `${indentStr}${component.id}_hour = gui_text_create(${parentRef}, "${component.name}_hour", ${hourX}, ${hourY}, ${hourWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_hour, ${component.id}_time_str, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_hour, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_hour, ${hourTextMode});\n`;
    
    // 应用字间距和行间距
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
    code += `${indentStr}gui_text_mode_set(${component.id}_colon, MID_CENTER);\n`;
    
    // 生成分钟 label
    code += `${indentStr}// 拆分时间 - 分钟\n`;
    code += `${indentStr}${component.id}_min = gui_text_create(${parentRef}, "${component.name}_min", ${minX}, ${minY}, ${minWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_min, ${component.id}_time_str + 3, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_min, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_min, ${minTextMode});\n`;
    
    // 应用字间距和行间距到分钟
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_min, ${letterSpacing});\n`;
    }
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_min, ${lineSpacing});\n`;
    }
    
    // 创建定时器用于呼吸灯动画
    code += `${indentStr}// 冒号呼吸灯动画定时器\n`;
    code += `${indentStr}gui_obj_create_timer(GUI_BASE(${component.id}_colon), 50, true, ${component.id}_breath_anim_cb);\n`;
    
    // 创建时间更新定时器
    code += `${indentStr}// 时间更新定时器\n`;
    code += `${indentStr}gui_obj_create_timer(${parentRef}, 1000, true, ${component.id}_time_update_cb);\n`;
    
    // 主组件 ID 指向小时 label
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
    
    // 确定字体类型和文件
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;
    const convertedFontFile = fontFile ? this.getConvertedFontFileName(component) : '';
    const fontMode = this.getFontMode();
    
    // 拆分时间使用固定的对齐方式
    const hourTextMode = 'MID_LEFT';
    const minTextMode = 'MID_RIGHT';
    
    let code = '';
    
    // 生成小时 label
    code += `${indentStr}// 拆分时间 - 小时\n`;
    code += `${indentStr}${component.id}_hour = gui_text_create(${parentRef}, "${component.name}_hour", ${hourX}, ${hourY}, ${hourWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_hour, ${component.id}_time_str, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_hour, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_hour, ${hourTextMode});\n`;
    
    // 应用字间距和行间距
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
    code += `${indentStr}gui_text_mode_set(${component.id}_colon, MID_CENTER);\n`;
    
    // 生成分钟 label
    code += `${indentStr}// 拆分时间 - 分钟\n`;
    code += `${indentStr}${component.id}_min = gui_text_create(${parentRef}, "${component.name}_min", ${minX}, ${minY}, ${minWidth}, ${height});\n`;
    code += `${indentStr}gui_text_set(${component.id}_min, ${component.id}_time_str + 3, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), 2, ${fontSize});\n`;
    if (fontFile) {
      code += `${indentStr}gui_text_type_set(${component.id}_min, "${convertedFontFile}", ${fontMode});\n`;
    }
    code += `${indentStr}gui_text_mode_set(${component.id}_min, ${minTextMode});\n`;
    
    // 应用字间距和行间距到分钟
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set(${component.id}_min, ${letterSpacing});\n`;
    }
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set(${component.id}_min, ${lineSpacing});\n`;
    }
    
    // 创建定时器用于呼吸灯动画
    code += `${indentStr}// 冒号呼吸灯动画定时器\n`;
    code += `${indentStr}gui_obj_create_timer(GUI_BASE(${component.id}_colon), 50, true, ${component.id}_breath_anim_cb);\n`;
    
    // 创建时间更新定时器
    code += `${indentStr}// 时间更新定时器\n`;
    code += `${indentStr}gui_obj_create_timer(${parentRef}, 1000, true, ${component.id}_time_update_cb);\n`;
    
    // 主组件 ID 指向小时 label
    code += `${indentStr}${component.id} = GUI_BASE(${component.id}_hour);\n`;
    
    return code;
  }

  /**
   * 根据字体配置确定字体类型
   */
  private getFontType(component: Component): string {
    const fontType = component.data?.fontType || 'bitmap';
    if (fontType === 'vector') {
      return 'GUI_FONT_SRC_TTF';
    }
    return 'GUI_FONT_SRC_BMP';
  }

  /**
   * 根据 hAlign、vAlign 和 wordWrap 生成 TEXT_MODE
   */
  private getTextMode(component: Component): string {
    const hAlign = component.style?.hAlign || 'LEFT';
    const vAlign = component.style?.vAlign || 'TOP';
    const wordWrap = component.style?.wordWrap || false;
    
    // 组合对齐方式
    if (vAlign === 'MID') {
      if (wordWrap) {
        switch (hAlign) {
          case 'LEFT': return 'MULTI_MID_LEFT';
          case 'CENTER': return 'MULTI_MID_CENTER';
          case 'RIGHT': return 'MULTI_MID_RIGHT';
          default: return 'MULTI_MID_LEFT';
        }
      } else {
        switch (hAlign) {
          case 'LEFT': return 'MID_LEFT';
          case 'CENTER': return 'MID_CENTER';
          case 'RIGHT': return 'MID_RIGHT';
          default: return 'MID_LEFT';
        }
      }
    } else {
      // TOP
      if (wordWrap) {
        switch (hAlign) {
          case 'LEFT': return 'MULTI_LEFT';
          case 'CENTER': return 'MULTI_CENTER';
          case 'RIGHT': return 'MULTI_RIGHT';
          default: return 'MULTI_LEFT';
        }
      } else {
        switch (hAlign) {
          case 'LEFT': return 'LEFT';
          case 'CENTER': return 'CENTER';
          case 'RIGHT': return 'RIGHT';
          default: return 'LEFT';
        }
      }
    }
  }

  /**
   * 获取字体源模式
   */
  private getFontMode(): string {
    // 默认使用文件系统
    return 'FONT_SRC_FILESYS';
  }

  /**
   * 计算字符串的 UTF-8 字节长度
   * 用于 gui_text_set 的 length 参数
   */
  private getUtf8ByteLength(str: string): number {
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7F) {
        byteLength += 1;  // ASCII: 1 字节
      } else if (code <= 0x7FF) {
        byteLength += 2;  // 2 字节
      } else if (code >= 0xD800 && code <= 0xDBFF) {
        // 代理对（surrogate pair），4 字节
        byteLength += 4;
        i++;  // 跳过低代理
      } else {
        byteLength += 3;  // 3 字节（包括大部分中文）
      }
    }
    return byteLength;
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

  /**
   * 根据组件属性生成转换后的字体文件名
   * 
   * 输出文件名规则：
   * - Bitmap: [fontName]_size[N]_bits[M]_bitmap.bin
   * - Vector: [fontName]_vector.bin
   * 
   * @param component 组件
   * @returns 转换后的字体文件路径
   */
  private getConvertedFontFileName(component: Component): string {
    const fontFile = component.data?.fontFile;
    if (!fontFile) {
      return '';
    }

    // 提取字体文件名（不含扩展名）
    const fontFileName = path.basename(fontFile);
    const fontName = fontFileName.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    
    // 获取字体类型和相关属性
    const fontType = component.data?.fontType || 'bitmap';
    const fontSize = component.data?.fontSize || 16;
    const renderMode = parseInt(component.data?.renderMode || '4', 10);

    // 获取原始字体文件的目录路径
    const fontDir = path.dirname(fontFile);
    
    let convertedFileName: string;
    if (fontType === 'vector') {
      // 矢量字体: [fontName]_vector.bin
      convertedFileName = `${fontName}_vector.bin`;
    } else {
      // 点阵字体: [fontName]_size[N]_bits[M]_bitmap.bin
      convertedFileName = `${fontName}_size${fontSize}_bits${renderMode}_bitmap.bin`;
    }

    // 保持原始目录结构
    if (fontDir && fontDir !== '.') {
      return `${fontDir}/${convertedFileName}`;
    }
    return convertedFileName;
  }
}
