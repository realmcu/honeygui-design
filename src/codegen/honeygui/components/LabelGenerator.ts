/**
 * hg_label 组件代码生成器
 */
import * as path from 'path';
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { HoneyGuiApiMapper } from '../HoneyGuiApiMapper';

/**
 * 字体初始化信息
 */
export interface FontInitInfo {
  fontPath: string;      // 转换后的字体文件路径
  fontType: 'bitmap' | 'vector';
}

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
    
    // 文本内容（如果有时间格式，使用占位符）
    const timeFormat = component.data?.timeFormat;
    const rawText = timeFormat ? this.getTimeFormatPlaceholder(timeFormat) : (component.data?.text ?? '');
    const text = String(rawText);

    // 确定字体类型
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;

    // gui_text_set 是必须调用的核心 API
    // 参数: widget, text, text_type, color, length, font_size
    // length 是字符串的字节数（UTF-8编码），不是 Unicode 字符数量
    const textByteLength = this.getUtf8ByteLength(text);
    code += `${indentStr}gui_text_set((gui_text_t *)${component.id}, "${text}", ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), ${textByteLength}, ${fontSize});\n`;

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
   * 获取时间格式的占位符
   */
  private getTimeFormatPlaceholder(format: string): string {
    switch (format) {
      case 'HH:mm:ss': return '00:00:00';
      case 'HH:mm': return '00:00';
      case 'YYYY-MM-DD': return '2024-01-01';
      case 'YYYY-MM-DD HH:mm:ss': return '2024-01-01 00:00:00';
      case 'MM-DD HH:mm': return '01-01 00:00';
      default: return '00:00:00';
    }
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

  /**
   * 从组件中提取字体初始化信息
   * 
   * @param component 组件
   * @returns 字体初始化信息，如果没有指定字体则返回 null
   */
  static getFontInitInfo(component: Component): FontInitInfo | null {
    const fontFile = component.data?.fontFile;
    if (!fontFile) {
      return null;
    }

    const fontType = (component.data?.fontType || 'bitmap') as 'bitmap' | 'vector';
    const fontSize = component.data?.fontSize || 16;
    const renderMode = parseInt(component.data?.renderMode || '4', 10);

    // 提取字体文件名（不含扩展名）
    const fontFileName = path.basename(fontFile);
    const fontName = fontFileName.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    
    // 获取原始字体文件的目录路径
    const fontDir = path.dirname(fontFile);
    
    let convertedFileName: string;
    if (fontType === 'vector') {
      convertedFileName = `${fontName}_vector.bin`;
    } else {
      convertedFileName = `${fontName}_size${fontSize}_bits${renderMode}_bitmap.bin`;
    }

    // 保持原始目录结构
    let fontPath: string;
    if (fontDir && fontDir !== '.') {
      fontPath = `${fontDir}/${convertedFileName}`;
    } else {
      fontPath = convertedFileName;
    }

    return { fontPath, fontType };
  }

  /**
   * 从组件列表中收集所有需要初始化的字体
   * 
   * @param components 组件列表
   * @returns 去重后的字体初始化信息列表（只包含点阵字体）
   */
  static collectFontInitInfos(components: Component[]): FontInitInfo[] {
    const fontMap = new Map<string, FontInitInfo>();

    for (const component of components) {
      if (component.type !== 'hg_label') continue;
      
      const info = LabelGenerator.getFontInitInfo(component);
      if (info && info.fontType === 'bitmap') {
        // 只有点阵字体需要预加载，矢量字体不需要
        fontMap.set(info.fontPath, info);
      }
    }

    return Array.from(fontMap.values());
  }

  /**
   * 生成字体初始化代码
   * 
   * @param fontInfos 字体初始化信息列表
   * @param indent 缩进级别
   * @returns 初始化代码字符串
   */
  static generateFontInitCode(fontInfos: FontInitInfo[], indent: number = 1): string {
    if (fontInfos.length === 0) {
      return '';
    }

    const indentStr = '    '.repeat(indent);
    let code = `${indentStr}// 初始化点阵字体（从文件系统加载）\n`;

    for (const info of fontInfos) {
      code += `${indentStr}gui_font_mem_init_fs((uint8_t *)"${info.fontPath}");\n`;
    }

    code += '\n';
    return code;
  }
}
