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
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping) {
      return `${indentStr}// 警告: 未找到 ${component.type} 的API映射\n`;
    }

    return `${indentStr}${component.id} = ${mapping.createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

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

    // gui_text_set 是必须调用的核心 API
    // 参数: widget, text, text_type, color, length, font_size
    // length 是字符串的字节数（UTF-8编码），不是 Unicode 字符数量
    code += `${indentStr}gui_text_set((gui_text_t *)${component.id}, ${text}, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), ${textLengthExpr}, ${fontSize});\n`;

    // 设置字体文件路径（如果指定了字体文件）
    if (fontFile) {
      // 生成转换后的字体文件名
      const convertedFontFile = this.getConvertedFontFileName(component);
      const fontMode = this.getFontMode();
      code += `${indentStr}gui_text_type_set((gui_text_t *)${component.id}, "${convertedFontFile}", ${fontMode});\n`;
    }

    // 对齐方式 - 根据 hAlign 和 vAlign 组合生成 TEXT_MODE
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

    // 断词保护（英文跨行断词）
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
