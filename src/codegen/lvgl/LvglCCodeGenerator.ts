/**
 * LVGL C代码生成器
 * 从组件树生成调用LVGL API的C代码
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Component } from '../../hml/types';
import { ICodeGenerator, CodeGenOptions, CodeGenResult } from '../ICodeGenerator';

export class LvglCCodeGenerator implements ICodeGenerator {
  private components: Component[];
  private options: CodeGenOptions;
  private componentMap: Map<string, Component>;
  private builtinImageVarMap: Map<string, string>;
  private builtinImageVars: string[];
  private builtinFontVarMap: Map<string, string>;  // fontFile 路径 -> 字体变量名
  private builtinFontVars: string[];  // 所有转换后的字体变量名

  constructor(components: Component[], options: CodeGenOptions) {
    this.components = components;
    this.options = options;
    this.componentMap = new Map(components.map(component => [component.id, component]));
    this.builtinImageVarMap = new Map();
    this.builtinImageVars = [];
    this.builtinFontVarMap = new Map();
    this.builtinFontVars = [];
  }

  /**
   * 生成所有代码文件
   */
  async generate(): Promise<CodeGenResult> {
    try {
      const files: string[] = [];
      const srcDir = this.options.srcDir;
      const designName = this.options.designName;

      const lvglDir = path.join(srcDir, 'lvgl');
      if (!fs.existsSync(lvglDir)) {
        fs.mkdirSync(lvglDir, { recursive: true });
      }

      this.prepareBuiltinImages(lvglDir);
      this.prepareBuiltinFonts(lvglDir);

      const headerFile = path.join(lvglDir, `${designName}_lvgl_ui.h`);
      const sourceFile = path.join(lvglDir, `${designName}_lvgl_ui.c`);
      const entryHeaderFile = path.join(lvglDir, 'lvgl_generated_ui.h');
      const entrySourceFile = path.join(lvglDir, 'lvgl_generated_ui.c');

      fs.writeFileSync(headerFile, this.generateHeader(designName), 'utf-8');
      fs.writeFileSync(sourceFile, this.generateSource(designName), 'utf-8');
      fs.writeFileSync(entryHeaderFile, this.generateEntryHeader(), 'utf-8');
      fs.writeFileSync(entrySourceFile, this.generateEntrySource(designName), 'utf-8');

      files.push(headerFile, sourceFile, entryHeaderFile, entrySourceFile);

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private generateHeader(designName: string): string {
    const guard = `${designName.toUpperCase()}_LVGL_UI_H`;
    let code = `/**\n`;
    code += ` * ${designName} LVGL UI 定义（自动生成）\n`;
    code += ` * 生成时间: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#ifndef ${guard}\n`;
    code += `#define ${guard}\n\n`;
    code += `#include "lvgl.h"\n\n`;

    code += `#ifdef __cplusplus\n`;
    code += `extern "C" {\n`;
    code += `#endif\n\n`;

    code += `// 组件句柄\n`;
    this.getCreationOrder().forEach(component => {
      code += `extern lv_obj_t * ${component.id};\n`;
    });

    code += `\nvoid ${designName}_lvgl_ui_create(lv_obj_t * parent);\n\n`;

    code += `#ifdef __cplusplus\n`;
    code += `}\n`;
    code += `#endif\n\n`;
    code += `#endif /* ${guard} */\n`;
    return code;
  }

  private generateSource(designName: string): string {
    const orderedComponents = this.getCreationOrder();

    let code = `/**\n`;
    code += ` * ${designName} LVGL UI 实现（自动生成）\n`;
    code += ` * 生成时间: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "${designName}_lvgl_ui.h"\n\n`;

    if (this.builtinImageVars.length > 0) {
      code += `// LVGL 内置图片资源声明\n`;
      this.builtinImageVars.forEach(varName => {
        code += `extern const lv_image_dsc_t ${varName};\n`;
      });
      code += `\n`;
    }

    if (this.builtinFontVars.length > 0) {
      code += `// LVGL 内置字体资源声明\n`;
      this.builtinFontVars.forEach(varName => {
        code += `extern const lv_font_t ${varName};\n`;
      });
      code += `\n`;
    }

    code += `// 组件句柄定义\n`;
    orderedComponents.forEach(component => {
      code += `lv_obj_t * ${component.id} = NULL;\n`;
    });

    code += `\nvoid ${designName}_lvgl_ui_create(lv_obj_t * parent)\n`;
    code += `{\n`;
    code += `    if(parent == NULL) {\n`;
    code += `        parent = lv_screen_active();\n`;
    code += `    }\n\n`;

    orderedComponents.forEach(component => {
      code += this.generateComponent(component);
    });

    code += `}\n`;
    return code;
  }

  private generateEntryHeader(): string {
    let code = `/**\n`;
    code += ` * HoneyGUI LVGL 生成入口（自动生成）\n`;
    code += ` * 生成时间: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#ifndef HONEYGUI_LVGL_GENERATED_UI_H\n`;
    code += `#define HONEYGUI_LVGL_GENERATED_UI_H\n\n`;
    code += `#include "lvgl.h"\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `extern "C" {\n`;
    code += `#endif\n\n`;
    code += `void honeygui_lvgl_ui_create(lv_obj_t * parent);\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `}\n`;
    code += `#endif\n\n`;
    code += `#endif /* HONEYGUI_LVGL_GENERATED_UI_H */\n`;
    return code;
  }

  private generateEntrySource(designName: string): string {
    let code = `/**\n`;
    code += ` * HoneyGUI LVGL 生成入口实现（自动生成）\n`;
    code += ` * 生成时间: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "lvgl_generated_ui.h"\n`;
    code += `#include "${designName}_lvgl_ui.h"\n\n`;
    code += `void honeygui_lvgl_ui_create(lv_obj_t * parent)\n`;
    code += `{\n`;
    code += `    ${designName}_lvgl_ui_create(parent);\n`;
    code += `}\n`;
    return code;
  }

  private getCreationOrder(): Component[] {
    const childrenMap = new Map<string | null, Component[]>();

    const pushChild = (parentId: string | null, component: Component): void => {
      const list = childrenMap.get(parentId) || [];
      list.push(component);
      childrenMap.set(parentId, list);
    };

    this.components.forEach(component => {
      const parentId = component.parent || null;
      if (parentId && !this.componentMap.has(parentId)) {
        pushChild(null, component);
      } else {
        pushChild(parentId, component);
      }
    });

    const sortByZIndex = (list: Component[]): Component[] => {
      return list.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    };

    const ordered: Component[] = [];
    const visited = new Set<string>();

    const walk = (parentId: string | null): void => {
      const children = sortByZIndex(childrenMap.get(parentId) || []);
      children.forEach(child => {
        if (visited.has(child.id)) {
          return;
        }
        visited.add(child.id);
        ordered.push(child);
        walk(child.id);
      });
    };

    walk(null);

    this.components.forEach(component => {
      if (!visited.has(component.id)) {
        ordered.push(component);
      }
    });

    return ordered;
  }

  private generateComponent(component: Component): string {
    const parentRef = this.getParentRef(component);
    const { x, y, width, height } = component.position;

    let code = `    // ${component.id} (${component.type})\n`;

    switch (component.type) {
      case 'hg_view':
      {
        // 根视图（直接挂在 parent 下）坐标始终为 0, 0
        const isRootView = parentRef === 'parent';
        const posX = isRootView ? 0 : Math.round(x);
        const posY = isRootView ? 0 : Math.round(y);
        code += `    ${component.id} = lv_obj_create(${parentRef});\n`;
        code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
        code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
        code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;
        // 设置背景颜色
        const bgColor = component.style?.backgroundColor;
        if (bgColor) {
          const bgColorHex = this.parseColorHex(bgColor);
          code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${bgColorHex}), LV_PART_MAIN);\n`;
          code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_COVER, LV_PART_MAIN);\n`;
        }
        // 去除边框
        code += `    lv_obj_set_style_border_width(${component.id}, 0, LV_PART_MAIN);\n`;
        code += `    lv_obj_set_style_pad_all(${component.id}, 0, LV_PART_MAIN);\n`;
        break;
      }
      case 'hg_window': {
        code += `    ${component.id} = lv_obj_create(${parentRef});\n`;
        code += `    lv_obj_set_pos(${component.id}, ${Math.round(x)}, ${Math.round(y)});\n`;
        code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
        code += `    lv_obj_set_scrollbar_mode(${component.id}, LV_SCROLLBAR_MODE_OFF);\n`;
        // 设置背景颜色
        const winBgColor = component.style?.backgroundColor;
        if (winBgColor) {
          const winBgColorHex = this.parseColorHex(winBgColor);
          code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${winBgColorHex}), LV_PART_MAIN);\n`;
          code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_COVER, LV_PART_MAIN);\n`;
        }
        code += `    lv_obj_set_style_border_width(${component.id}, 0, LV_PART_MAIN);\n`;
        code += `    lv_obj_set_style_pad_all(${component.id}, 0, LV_PART_MAIN);\n`;
        break;
      }
      case 'hg_image': {
        const isGif = this.isGifComponent(component);
        const hasBuiltinVar = this.getBuiltinImageVar(String(component.data?.src || ''));
        // GIF 如果已转换为 C 数组，使用 lv_image（显示静态首帧）
        const useImageCreate = !isGif || hasBuiltinVar;
        code += `    ${component.id} = ${useImageCreate ? 'lv_image_create' : 'lv_gif_create'}(${parentRef});\n`;
        code += this.generateImageSetters(component, isGif && !hasBuiltinVar);
        break;
      }

      case 'hg_circle':
        code += `    ${component.id} = lv_obj_create(${parentRef});\n`;
        code += this.generateCircleSetters(component);
        break;

      case 'hg_label':
        code += `    ${component.id} = lv_label_create(${parentRef});\n`;
        code += this.generateLabelSetters(component);
        break;

      default:
        code += `    ${component.id} = lv_obj_create(${parentRef});\n`;
        code += `    lv_obj_set_pos(${component.id}, ${Math.round(x)}, ${Math.round(y)});\n`;
        code += `    lv_obj_set_size(${component.id}, ${Math.round(width)}, ${Math.round(height)});\n`;
        code += `    /* TODO(lvgl): 未支持组件类型 ${component.type} 的专用映射，当前使用占位对象 */\n`;
        break;
    }

    if (component.visible === false) {
      code += `    lv_obj_add_flag(${component.id}, LV_OBJ_FLAG_HIDDEN);\n`;
    }

    if (component.enabled === false) {
      code += `    lv_obj_add_state(${component.id}, LV_STATE_DISABLED);\n`;
    }

    code += `\n`;
    return code;
  }

  private generateImageSetters(component: Component, isGif: boolean): string {
    const transform = component.style?.transform;
    const src = component.data?.src;

    const tx = Number(transform?.translateX || 0);
    const ty = Number(transform?.translateY || 0);
    const x = Math.round(component.position.x + tx);
    const y = Math.round(component.position.y + ty);
    const width = Math.max(1, Math.round(component.position.width));
    const height = Math.max(1, Math.round(component.position.height));

    let code = `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;

    if (src) {
      if (!isGif) {
        const builtinVar = this.getBuiltinImageVar(String(src));
        if (builtinVar) {
          code += `    lv_image_set_src(${component.id}, &${builtinVar});\n`;
        } else {
          const lvglImageSrc = this.normalizeLvglImageSource(String(src));
          code += `    lv_image_set_src(${component.id}, "${this.escapeCString(lvglImageSrc)}");\n`;
        }
      } else {
        // GIF 也优先使用转换后的 C 数组（静态首帧）
        const builtinVar = this.getBuiltinImageVar(String(src));
        if (builtinVar) {
          // 使用 lv_image_set_src 显示转换后的静态首帧
          code += `    lv_image_set_src(${component.id}, &${builtinVar});\n`;
        } else {
          const lvglImageSrc = this.normalizeLvglImageSource(String(src));
          code += `    lv_gif_set_src(${component.id}, "${this.escapeCString(lvglImageSrc)}");\n`;
        }
      }
    }

    if (!isGif && (transform?.focusX !== undefined || transform?.focusY !== undefined)) {
      const focusX = Math.round(Number(transform.focusX ?? width / 2));
      const focusY = Math.round(Number(transform.focusY ?? height / 2));
      code += `    lv_image_set_pivot(${component.id}, ${focusX}, ${focusY});\n`;
    }

    if (!isGif && transform?.rotation !== undefined && Number(transform.rotation) !== 0) {
      const angle = Math.round(Number(transform.rotation) * 10);
      code += `    lv_image_set_rotation(${component.id}, ${angle});\n`;
    }

    const scaleX = transform?.scaleX !== undefined ? Number(transform.scaleX) : 1;
    const scaleY = transform?.scaleY !== undefined ? Number(transform.scaleY) : 1;
    if (!isGif && Number.isFinite(scaleX) && Number.isFinite(scaleY) && (scaleX !== 1 || scaleY !== 1)) {
      const zoomX = Math.max(1, Math.round(scaleX * 256));
      const zoomY = Math.max(1, Math.round(scaleY * 256));

      if (zoomX === zoomY) {
        code += `    lv_image_set_scale(${component.id}, ${zoomX});\n`;
      } else {
        code += `    lv_image_set_scale_x(${component.id}, ${zoomX});\n`;
        code += `    lv_image_set_scale_y(${component.id}, ${zoomY});\n`;
      }
    }

    if (transform?.opacity !== undefined) {
      const opacity = Math.max(0, Math.min(255, Math.round(Number(transform.opacity))));
      code += `    lv_obj_set_style_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    }

    if (component.data?.blendMode) {
      code += `    /* TODO(lvgl): blendMode=${this.escapeCString(String(component.data.blendMode))} 暂未映射 */\n`;
    }

    if (component.data?.highQuality !== undefined) {
      code += `    /* TODO(lvgl): highQuality 暂未映射 */\n`;
    }

    if (component.data?.needClip !== undefined) {
      code += `    /* TODO(lvgl): needClip 暂未映射 */\n`;
    }

    if (transform?.skewX !== undefined || transform?.skewY !== undefined) {
      code += `    /* TODO(lvgl): skewX/skewY 暂未映射 */\n`;
    }

    if (component.data?.buttonMode) {
      code += `    /* TODO(lvgl): buttonMode=${this.escapeCString(String(component.data.buttonMode))} 暂未映射 */\n`;
    }

    return code;
  }

  private generateCircleSetters(component: Component): string {
    const tx = Number(component.style?.transform?.translateX || 0);
    const ty = Number(component.style?.transform?.translateY || 0);

    const x = Math.round(component.position.x + tx);
    const y = Math.round(component.position.y + ty);
    const width = Math.max(1, Math.round(component.position.width));
    const height = Math.max(1, Math.round(component.position.height));

    const fillColor = this.resolveCircleFillColor(component);
    const opacity = Math.max(0, Math.min(255, Math.round(Number(component.style?.opacity ?? component.data?.opacity ?? 255))));
    const useGradient = component.style?.useGradient === true;
    const gradientType = String(component.style?.gradientType || 'radial');
    const gradientStops = this.resolveGradientStops(component.data?.gradientStops, fillColor);
    const startAngle = this.toFiniteNumber(component.data?.gradientStartAngle, 0);
    const endAngle = this.toFiniteNumber(component.data?.gradientEndAngle, 360);
    const gradVar = `${component.id}_grad_dsc`;
    const gradInitVar = `${component.id}_grad_initialized`;
    const gradColorsVar = `${component.id}_grad_colors`;
    const gradOpaVar = `${component.id}_grad_opas`;
    const gradFracsVar = `${component.id}_grad_fracs`;

    let code = `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;
    code += `    lv_obj_set_style_radius(${component.id}, LV_RADIUS_CIRCLE, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_border_width(${component.id}, 0, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${fillColor}), LV_PART_MAIN);\n`;

    if (useGradient && gradientStops.length >= 2) {
      code += `    static lv_grad_dsc_t ${gradVar};\n`;
      code += `    static bool ${gradInitVar} = false;\n`;
      code += `    static lv_color_t ${gradColorsVar}[${gradientStops.length}];\n`;
      code += `    static const lv_opa_t ${gradOpaVar}[${gradientStops.length}] = { ${gradientStops.map(() => 'LV_OPA_COVER').join(', ')} };\n`;
      code += `    static const uint8_t ${gradFracsVar}[${gradientStops.length}] = { ${gradientStops.map((stop) => `${stop.frac}`).join(', ')} };\n`;
      code += `    if (!${gradInitVar}) {\n`;
      gradientStops.forEach((stop, index) => {
        code += `        ${gradColorsVar}[${index}] = lv_color_hex(0x${stop.colorHex});\n`;
      });
      code += `        lv_grad_init_stops(&${gradVar}, ${gradColorsVar}, ${gradOpaVar}, ${gradFracsVar}, ${gradientStops.length});\n`;
      if (gradientType === 'angular') {
        code += `        lv_grad_conical_init(&${gradVar}, LV_GRAD_CENTER, LV_GRAD_CENTER, ${Math.round(startAngle)}, ${Math.round(endAngle)}, LV_GRAD_EXTEND_PAD);\n`;
      } else {
        code += `        lv_grad_radial_init(&${gradVar}, LV_GRAD_CENTER, LV_GRAD_CENTER, LV_GRAD_RIGHT, LV_GRAD_CENTER, LV_GRAD_EXTEND_PAD);\n`;
      }
      code += `        ${gradInitVar} = true;\n`;
      code += `    }\n`;
      code += `    lv_obj_set_style_bg_grad(${component.id}, &${gradVar}, LV_PART_MAIN);\n`;
      code += `    lv_obj_set_style_bg_grad_dir(${component.id}, ${gradientType === 'angular' ? 'LV_GRAD_DIR_CONICAL' : 'LV_GRAD_DIR_RADIAL'}, LV_PART_MAIN);\n`;
      code += `    lv_obj_set_style_bg_grad_opa(${component.id}, ${opacity}, LV_PART_MAIN);\n`;
    } else if (useGradient) {
      code += `    /* NOTE(lvgl): hg_circle 渐变至少需要 2 个色标，当前回退为纯色填充 */\n`;
    }

    if (component.data?.buttonMode && component.data?.buttonMode !== 'none') {
      code += `    /* TODO(lvgl): hg_circle buttonMode=${this.escapeCString(String(component.data.buttonMode))} 暂未映射 */\n`;
    }

    return code;
  }

  private generateLabelSetters(component: Component): string {
    const tx = Number(component.style?.transform?.translateX || 0);
    const ty = Number(component.style?.transform?.translateY || 0);

    const x = Math.round(component.position.x + tx);
    const y = Math.round(component.position.y + ty);

    const text = component.data?.text || '';
    const color = this.parseColorHex(component.style?.color || component.data?.color || '#000000');
    const fontSize = Number(component.style?.fontSize || component.data?.fontSize || 16);
    const fontFile = component.data?.fontFile;

    let code = `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_label_set_text(${component.id}, "${this.escapeCString(String(text))}");\n`;
    code += `    lv_obj_set_style_text_color(${component.id}, lv_color_hex(0x${color}), LV_PART_MAIN);\n`;

    // 优先使用用户指定的 TTF 字体（已转换为 LVGL 格式）
    const customFontVar = fontFile ? this.getBuiltinFontVar(String(fontFile), fontSize) : null;
    if (customFontVar) {
      code += `    lv_obj_set_style_text_font(${component.id}, &${customFontVar}, LV_PART_MAIN);\n`;
    } else {
      // 回退到 LVGL 内置字体
      const fontName = this.getLvglFontBySize(fontSize);
      code += `    lv_obj_set_style_text_font(${component.id}, &${fontName}, LV_PART_MAIN);\n`;
    }

    return code;
  }

  /**
   * 获取转换后的字体变量名
   */
  private getBuiltinFontVar(fontFile: string, fontSize: number): string | null {
    const key = this.normalizeFontKey(fontFile, fontSize);
    return this.builtinFontVarMap.get(key) || null;
  }

  /**
   * 规范化字体 key（fontFile + fontSize 组合）
   */
  private normalizeFontKey(fontFile: string, fontSize: number): string {
    const normalized = fontFile.replace(/\\/g, '/').toLowerCase().trim();
    return `${normalized}@${fontSize}`;
  }

  private parseColorHex(color: string): string {
    // 移除 # 前缀，返回纯16进制颜色值
    const hex = color.replace(/^#/, '').toUpperCase();
    // 如果是 3 位颜色，扩展为 6 位
    if (hex.length === 3) {
      return hex.split('').map(c => c + c).join('');
    }
    return hex.padStart(6, '0');
  }

  private getLvglFontBySize(fontSize: number): string {
    // LVGL 内置字体：montserrat 系列
    // 选择最接近的字体大小
    const sizes = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48];
    let closest = 14; // 默认
    let minDiff = Infinity;
    for (const size of sizes) {
      const diff = Math.abs(size - fontSize);
      if (diff < minDiff) {
        minDiff = diff;
        closest = size;
      }
    }
    return `lv_font_montserrat_${closest}`;
  }

  private getParentRef(component: Component): string {
    const parentId = component.parent;
    if (!parentId || !this.componentMap.has(parentId)) {
      return 'parent';
    }

    return parentId;
  }

  private escapeCString(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  private normalizeLvglImageSource(source: string): string {
    const normalized = source.replace(/\\/g, '/').trim();
    if (!normalized) {
      return normalized;
    }

    if (/^[A-Z]:/i.test(normalized)) {
      return normalized;
    }

    const withoutLeadingSlash = normalized.replace(/^\/+/, '');
    if (withoutLeadingSlash.startsWith('assets/')) {
      return `A:${withoutLeadingSlash}`;
    }

    return `A:assets/${withoutLeadingSlash}`;
  }

  /**
   * 准备内置字体资源：将项目中使用的 TTF 字体转换为 LVGL C 格式
   */
  private prepareBuiltinFonts(lvglDir: string): void {
    this.builtinFontVarMap.clear();
    this.builtinFontVars = [];

    const projectRoot = path.dirname(this.options.srcDir);
    const assetsDir = path.join(projectRoot, 'assets');

    // 收集所有 hg_label 组件中使用的字体
    const fontConfigs = this.collectFontConfigs();
    if (fontConfigs.length === 0) {
      return;
    }

    // 确保输出目录存在
    const fontOutputDir = path.join(lvglDir, 'fonts');
    if (!fs.existsSync(fontOutputDir)) {
      fs.mkdirSync(fontOutputDir, { recursive: true });
    }

    // 转换每个字体
    for (const config of fontConfigs) {
      const inputPath = this.resolveFontPath(projectRoot, assetsDir, config.fontFile);
      if (!inputPath) {
        console.warn(`字体文件不存在，跳过: ${config.fontFile}`);
        continue;
      }

      // 生成变量名
      const varName = this.buildFontVarName(config.fontFile, config.fontSize);

      // 使用 lv_font_conv 转换字体
      const success = this.convertFontToLvgl(inputPath, fontOutputDir, varName, config.fontSize, config.characters);
      if (success) {
        const key = this.normalizeFontKey(config.fontFile, config.fontSize);
        this.builtinFontVarMap.set(key, varName);
        this.builtinFontVars.push(varName);
      }
    }
  }

  /**
   * 收集所有 hg_label 组件中使用的字体配置
   */
  private collectFontConfigs(): Array<{ fontFile: string; fontSize: number; characters: string }> {
    const fontExts = new Set(['.ttf', '.otf', '.woff', '.woff2']);
    const seen = new Map<string, { fontFile: string; fontSize: number; characters: Set<string> }>();

    for (const component of this.components) {
      if (component.type !== 'hg_label') {
        continue;
      }

      const fontFile = component.data?.fontFile;
      if (!fontFile) {
        continue;
      }

      const fontFileStr = String(fontFile).trim();
      const ext = path.extname(fontFileStr).toLowerCase();
      if (!fontExts.has(ext)) {
        continue;
      }

      const fontSize = Number(component.style?.fontSize || component.data?.fontSize || 16);
      const text = String(component.data?.text || '');
      const key = this.normalizeFontKey(fontFileStr, fontSize);

      if (seen.has(key)) {
        // 合并字符集
        const existing = seen.get(key)!;
        for (const char of text) {
          existing.characters.add(char);
        }
      } else {
        seen.set(key, {
          fontFile: fontFileStr,
          fontSize,
          characters: new Set(text)
        });
      }
    }

    // 转换为数组，并添加基本字符集
    return Array.from(seen.values()).map(config => ({
      fontFile: config.fontFile,
      fontSize: config.fontSize,
      // 合并用户文本和基本 ASCII 字符
      characters: this.buildCharacterSet(config.characters)
    }));
  }

  /**
   * 构建字符集：合并用户文本中的字符和基本字符
   */
  private buildCharacterSet(userChars: Set<string>): string {
    // 基本 ASCII + 用户使用的字符
    const chars = new Set<string>();
    
    // 添加基本 ASCII 可打印字符
    for (let i = 0x20; i <= 0x7E; i++) {
      chars.add(String.fromCharCode(i));
    }
    
    // 添加用户文本中的字符
    for (const char of userChars) {
      chars.add(char);
    }

    return Array.from(chars).sort().join('');
  }

  /**
   * 解析字体文件的绝对路径
   */
  private resolveFontPath(projectRoot: string, assetsDir: string, fontFile: string): string | null {
    let normalized = fontFile.replace(/\\/g, '/').trim();
    
    // 移除 A: 或 /font/ 前缀
    normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');
    
    // 尝试多种路径
    const candidates = [
      path.join(assetsDir, normalized),
      path.join(assetsDir, 'font', path.basename(normalized)),
      path.join(projectRoot, normalized),
      path.join(projectRoot, 'assets', normalized),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 生成字体变量名
   */
  private buildFontVarName(fontFile: string, fontSize: number): string {
    const baseName = path.basename(fontFile, path.extname(fontFile))
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    return `font_${baseName}_${fontSize}`;
  }

  /**
   * 使用 lv_font_conv 将字体转换为 LVGL C 格式
   */
  private convertFontToLvgl(
    inputPath: string,
    outputDir: string,
    varName: string,
    fontSize: number,
    characters: string
  ): boolean {
    try {
      const outputFile = path.join(outputDir, `${varName}.c`);

      // 构建 lv_font_conv 命令参数
      // lv_font_conv 需要通过 npx 或全局安装运行
      const args = [
        'lv_font_conv',
        '--font', inputPath,
        '--size', String(fontSize),
        '--format', 'lvgl',
        '--output', outputFile,
        '--bpp', '4',  // 4 位抗锯齿
        '--symbols', characters
      ];

      // 尝试使用 npx 运行
      const result = spawnSync('npx', args, {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: path.dirname(this.options.srcDir),
        shell: true
      });

      if (result.status === 0) {
        console.log(`字体转换成功: ${varName}`);
        return true;
      } else {
        console.warn(`字体转换失败 ${varName}: ${result.stderr || result.error}`);
        return false;
      }
    } catch (error) {
      console.warn(`字体转换异常 ${varName}: ${error}`);
      return false;
    }
  }

  /**
   * 准备内置图片资源：将项目中使用的图片转换为 LVGL 内置 C 数组格式
   */
  private prepareBuiltinImages(lvglDir: string): void {
    this.builtinImageVarMap.clear();
    this.builtinImageVars = [];

    // 查找 LVGLImage.py 工具
    const toolPath = this.findLvglImageTool();
    if (!toolPath) {
      console.warn('LVGL 图片转换工具未找到，跳过图片内置转换');
      return;
    }

    const projectRoot = path.dirname(this.options.srcDir);
    const assetsDir = path.join(projectRoot, 'assets');
    if (!fs.existsSync(assetsDir)) {
      return;
    }

    // 收集所有 hg_image 组件中使用的图片
    const images = this.collectImageSources();
    if (images.length === 0) {
      return;
    }

    // 清理之前生成的图片 C 文件
    this.cleanupGeneratedImages(lvglDir);

    // 转换每个图片
    for (const imgSrc of images) {
      const inputPath = this.resolveImagePath(projectRoot, imgSrc);
      if (!inputPath) {
        console.warn(`图片文件不存在，跳过: ${imgSrc}`);
        continue;
      }

      // 生成变量名
      const varName = this.buildImageVarName(imgSrc);
      
      // 使用 LVGLImage.py 转换图片
      const success = this.convertImageToLvgl(toolPath, inputPath, lvglDir, varName);
      if (success) {
        const key = this.normalizeImageKey(imgSrc);
        this.builtinImageVarMap.set(key, varName);
        this.builtinImageVars.push(varName);
      }
    }
  }

  /**
   * 收集所有 hg_image 组件中使用的图片源
   */
  private collectImageSources(): string[] {
    const imageExts = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif']);
    const seen = new Set<string>();
    const result: string[] = [];

    for (const component of this.components) {
      if (component.type !== 'hg_image') {
        continue;
      }
      
      const src = component.data?.src;
      if (!src) {
        continue;
      }
      
      const srcText = String(src).trim();
      if (!srcText) {
        continue;
      }
      
      const ext = path.extname(srcText).toLowerCase();
      if (!imageExts.has(ext)) {
        continue;
      }

      const key = this.normalizeImageKey(srcText);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(srcText);
    }

    return result;
  }

  /**
   * 查找 LVGLImage.py 转换工具
   */
  private findLvglImageTool(): string | null {
    // 运行时 __dirname 指向 out/src/codegen/lvgl/，需要向上走 4 层
    const candidates = [
      process.env.HONEYGUI_LVGL_IMAGE_TOOL,
      path.resolve(__dirname, '../../../../lvgl-pc/lvgl-official-tools/scripts/LVGLImage.py'),
      path.join(process.cwd(), 'lvgl-pc', 'lvgl-official-tools', 'scripts', 'LVGLImage.py'),
    ].filter((c): c is string => !!c);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * 解析图片的绝对路径
   */
  private resolveImagePath(projectRoot: string, source: string): string | null {
    // 规范化路径：去除 A: 前缀和反斜杠
    let normalized = source.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');
    
    // 如果路径以 assets/ 开头，去掉这个前缀
    const relativePath = normalized.startsWith('assets/')
      ? normalized.substring('assets/'.length)
      : normalized;

    // 尝试在 assets 目录下查找
    const fullPath = path.join(projectRoot, 'assets', relativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    // 尝试直接作为相对路径
    const altPath = path.join(projectRoot, normalized);
    if (fs.existsSync(altPath)) {
      return altPath;
    }

    return null;
  }

  /**
   * 使用 LVGLImage.py 将图片转换为 LVGL C 数组
   */
  private convertImageToLvgl(
    toolPath: string,
    inputPath: string,
    outputDir: string,
    varName: string
  ): boolean {
    const ext = path.extname(inputPath).toLowerCase();
    
    // LVGLImage.py 只支持 PNG 格式，其他格式需要先转换
    let actualInputPath = inputPath;
    let tempPngPath: string | null = null;
    let colorFormat = 'ARGB8888'; // 默认支持透明

    if (ext !== '.png') {
      // 使用 Pillow 将非 PNG 图片转换为临时 PNG
      tempPngPath = path.join(outputDir, `_temp_${varName}.png`);
      const convertSuccess = this.convertToPng(inputPath, tempPngPath);
      if (!convertSuccess) {
        console.warn(`图片格式转换失败: ${inputPath}`);
        return false;
      }
      actualInputPath = tempPngPath;
      // 非 PNG 格式（如 JPG）通常没有透明通道，使用 RGB565 更节省空间
      colorFormat = 'RGB565';
    }

    const baseArgs = [toolPath, '--ofmt', 'C', '--cf', colorFormat, '-o', outputDir, '--name', varName, actualInputPath];
    
    // 尝试不同的 Python 命令
    const pythonCommands = ['python', 'python3', 'py'];
    let success = false;
    
    for (const pyCmd of pythonCommands) {
      const args = pyCmd === 'py' ? ['-3', ...baseArgs] : baseArgs;
      const result = spawnSync(pyCmd, args, { encoding: 'utf-8', windowsHide: true });
      
      if (result.status === 0) {
        const outputFile = path.join(outputDir, `${varName}.c`);
        if (fs.existsSync(outputFile)) {
          success = true;
          break;
        }
      }
    }

    // 清理临时 PNG 文件
    if (tempPngPath && fs.existsSync(tempPngPath)) {
      try {
        fs.unlinkSync(tempPngPath);
      } catch {
        // 忽略清理错误
      }
    }

    if (!success) {
      console.warn(`图片转换失败: ${inputPath}`);
    }
    return success;
  }

  /**
   * 使用 Pillow 将图片转换为 PNG 格式
   */
  private convertToPng(inputPath: string, outputPath: string): boolean {
    // Python 脚本：使用 Pillow 转换图片为 PNG
    // 对于 GIF 只取第一帧，对于带调色板的图片先转换为 RGBA
    const script = `from PIL import Image; img = Image.open(r'${inputPath.replace(/'/g, "\\'")}'); img.convert('RGBA').save(r'${outputPath.replace(/'/g, "\\'")}', 'PNG')`;
    
    const pythonCommands = ['python', 'python3', 'py'];
    
    for (const pyCmd of pythonCommands) {
      const args = pyCmd === 'py' ? ['-3', '-c', script] : ['-c', script];
      const result = spawnSync(pyCmd, args, { encoding: 'utf-8', windowsHide: true });
      
      if (result.status === 0 && fs.existsSync(outputPath)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 清理之前生成的图片 C 文件
   */
  private cleanupGeneratedImages(lvglDir: string): void {
    if (!fs.existsSync(lvglDir)) {
      return;
    }
    const prefix = 'img_';
    const files = fs.readdirSync(lvglDir);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.c')) {
        fs.unlinkSync(path.join(lvglDir, file));
      }
    }
  }

  /**
   * 构建图片变量名
   */
  private buildImageVarName(source: string): string {
    // 规范化路径
    let normalized = source.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');
    if (normalized.startsWith('assets/')) {
      normalized = normalized.substring('assets/'.length);
    }
    
    // 去掉扩展名，将路径分隔符替换为下划线
    const base = normalized.replace(/\.[^.]+$/, '').replace(/[\/]+/g, '_');
    
    // 确保是合法的 C 标识符
    let varName = 'img_' + base.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
    
    // 如果以数字开头，添加前缀
    if (/^[0-9]/.test(varName)) {
      varName = 'img_' + varName;
    }
    
    return varName;
  }

  /**
   * 规范化图片源路径用于查找 Map
   */
  private normalizeImageKey(source: string): string {
    return source
      .replace(/\\/g, '/')
      .replace(/^A:/i, '')
      .replace(/^\/+/, '')
      .trim()
      .toLowerCase();
  }

  /**
   * 获取内置图片变量名
   */
  private getBuiltinImageVar(source: string): string | undefined {
    return this.builtinImageVarMap.get(this.normalizeImageKey(source));
  }

  private isGifComponent(component: Component): boolean {
    const src = component.data?.src;
    if (!src) {
      return false;
    }

    const normalized = this.normalizeLvglImageSource(String(src)).toLowerCase();
    return normalized.endsWith('.gif');
  }

  private resolveCircleFillColor(component: Component): string {
    const buttonMode = component.data?.buttonMode;
    if (buttonMode === 'dual-state') {
      const initialOn = component.data?.buttonInitialState === 'on';
      const onColor = String(component.data?.buttonStateOnColor || '#00FF00');
      const offColor = String(component.data?.buttonStateOffColor || '#FF0000');
      return this.normalizeHexColor(initialOn ? onColor : offColor, 'FFFFFF');
    }

    return this.normalizeHexColor(String(component.style?.fillColor || '#FFFFFF'), 'FFFFFF');
  }

  private normalizeHexColor(value: string, fallback: string): string {
    const raw = (value || '').trim();
    if (!raw.startsWith('#')) {
      return fallback;
    }

    const hex = raw.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return hex.toUpperCase();
    }

    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
    }

    return fallback;
  }

  private resolveGradientStops(rawStops: any, fallbackHex: string): Array<{ colorHex: string; frac: number }> {
    if (!Array.isArray(rawStops)) {
      return [
        { colorHex: fallbackHex, frac: 0 },
        { colorHex: fallbackHex, frac: 255 },
      ];
    }

    const parsed = rawStops
      .map((item) => {
        const position = this.toFiniteNumber(item?.position, 0);
        const colorHex = this.normalizeHexColor(String(item?.color || `#${fallbackHex}`), fallbackHex);
        const frac = Math.max(0, Math.min(255, Math.round(position * 255)));
        return { colorHex, frac };
      })
      .sort((a, b) => a.frac - b.frac);

    if (parsed.length < 2) {
      return [
        { colorHex: fallbackHex, frac: 0 },
        { colorHex: fallbackHex, frac: 255 },
      ];
    }

    const limited = parsed.slice(0, 8);
    limited[0] = { ...limited[0], frac: 0 };
    limited[limited.length - 1] = { ...limited[limited.length - 1], frac: 255 };
    return limited;
  }

  private toFiniteNumber(value: any, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
}
