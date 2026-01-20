/**
 * hg_label 组件代码生成器
 * 纯文本标签，不包含时间功能
 */
import * as path from 'path';
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class LabelGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 检查是否启用滚动（注意：可能是字符串 'true' 或布尔值 true）
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    
    // 根据是否滚动选择不同的 API
    const createFunction = enableScroll ? 'gui_scroll_text_create' : 'gui_text_create';

    return `${indentStr}${component.id} = ${createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 检查是否启用滚动（注意：可能是字符串 'true' 或布尔值 true）
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    const scrollDirection = component.data?.scrollDirection || 'horizontal';
    const scrollReverse = component.data?.scrollReverse === true || component.data?.scrollReverse === 'true';

    // 获取属性值
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    // 普通标签：使用静态文本
    const staticText = String(component.data?.text ?? '');
    const text = `"${staticText}"`;
    const textLengthExpr = String(this.getUtf8ByteLength(staticText));

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
      let scrollModeStr: string;
      const vAlign = component.style?.vAlign || 'TOP';
      
      if (scrollDirection === 'horizontal') {
        if (vAlign === 'MID') {
          scrollModeStr = scrollReverse ? 'SCROLL_X_MID_REVERSE' : 'SCROLL_X_MID';
        } else {
          scrollModeStr = scrollReverse ? 'SCROLL_X_REVERSE' : 'SCROLL_X';
        }
      } else {
        scrollModeStr = scrollReverse ? 'SCROLL_Y_REVERSE' : 'SCROLL_Y';
      }
      
      const startOffset = component.data?.scrollStartOffset ?? 0;
      const endOffset = component.data?.scrollEndOffset ?? 0;
      const interval = component.data?.scrollInterval ?? 3000;
      const duration = component.data?.scrollDuration ?? 0;
      
      code += `${indentStr}gui_scroll_text_scroll_set((gui_scroll_text_t *)${component.id}, ${scrollModeStr}, ${startOffset}, ${endOffset}, ${interval}, ${duration});\n`;
    }

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
      code += `${indentStr}gui_obj_show(${component.id}, false);\n`;
    }

    return code;
  }

  /**
   * 根据字体配置确定字体类型
   */
  protected getFontType(component: Component): string {
    const fontType = component.data?.fontType || 'bitmap';
    if (fontType === 'vector') {
      return 'GUI_FONT_SRC_TTF';
    }
    return 'GUI_FONT_SRC_BMP';
  }

  /**
   * 根据 hAlign、vAlign 和 wordWrap 生成 TEXT_MODE
   */
  protected getTextMode(component: Component): string {
    const hAlign = component.style?.hAlign || 'LEFT';
    const vAlign = component.style?.vAlign || 'TOP';
    const wordWrap = component.style?.wordWrap || false;
    
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
  protected getFontMode(): string {
    return 'FONT_SRC_FILESYS';
  }

  /**
   * 计算字符串的 UTF-8 字节长度
   */
  protected getUtf8ByteLength(str: string): number {
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7F) {
        byteLength += 1;
      } else if (code <= 0x7FF) {
        byteLength += 2;
      } else if (code >= 0xD800 && code <= 0xDBFF) {
        byteLength += 4;
        i++;
      } else {
        byteLength += 3;
      }
    }
    return byteLength;
  }

  /**
   * 将颜色字符串转换为 RGB 对象
   */
  protected colorToRgb(color: string): { r: number; g: number; b: number } {
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
    return { r: 255, g: 255, b: 255 };
  }

  /**
   * 根据组件属性生成转换后的字体文件名
   */
  protected getConvertedFontFileName(component: Component): string {
    const fontFile = component.data?.fontFile;
    if (!fontFile) {
      return '';
    }

    const fontFileName = path.basename(fontFile);
    const fontName = fontFileName.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    
    const fontType = component.data?.fontType || 'bitmap';
    const fontSize = component.data?.fontSize || 16;
    const renderMode = parseInt(component.data?.renderMode || '4', 10);

    const fontDir = path.dirname(fontFile);
    
    let convertedFileName: string;
    if (fontType === 'vector') {
      convertedFileName = `${fontName}_vector.bin`;
    } else {
      convertedFileName = `${fontName}_size${fontSize}_bits${renderMode}_bitmap.bin`;
    }

    if (fontDir && fontDir !== '.') {
      return `${fontDir}/${convertedFileName}`;
    }
    return convertedFileName;
  }
}
