/**
 * HML 校验器
 * 用于验证 HML 语法和结构的合法性
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';

// ============ 类型定义 ============

export interface ValidationError {
  type: 'syntax' | 'schema' | 'structure' | 'business';
  message: string;
  path?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'style' | 'performance' | 'accessibility';
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats?: {
    componentCount: number;
    containerCount: number;
    maxNestingDepth: number;
  };
}

// ============ 常量定义 ============

// 容器组件类型
const CONTAINER_TYPES = new Set([
  'hg_view', 'hg_window', 'hg_canvas', 'hg_list', 'hg_list_item',
  'hg_menu_cellular', 'hg_grid', 'hg_tab', 'hg_container', 'hg_dialog'
]);

// 有效的 HoneyGUI 组件
const VALID_COMPONENTS = new Set([
  'hg_button', 'hg_image', 'hg_input', 'hg_checkbox', 'hg_radio',
  'hg_progressbar', 'hg_slider', 'hg_switch', 'hg_canvas', 'hg_list',
  'hg_list_item', 'hg_grid', 'hg_tab', 'hg_label', 'hg_glass',
  'hg_window', 'hg_dialog', 'hg_container', 'hg_view', 'hg_particle',
  'hg_menu_cellular', 'hg_time_label', 'hg_timer_label', 'hg_gif',
  'hg_arc', 'hg_circle', 'hg_rect', 'hg_svg', 'hg_video', 'hg_3d',
  'hg_lottie', 'hg_map', 'hg_openclaw', 'hg_claw_face'
]);

// 必需属性
const REQUIRED_PROPS = ['id', 'name', 'x', 'y', 'w', 'h'];

// ID 前缀映射
const ID_PREFIXES: Record<string, string> = {
  hg_button: 'btn_',
  hg_label: 'lbl_',
  hg_time_label: 'lbl_',
  hg_timer_label: 'lbl_',
  hg_image: 'img_',
  hg_gif: 'img_',
  hg_input: 'input_',
  hg_checkbox: 'chk_',
  hg_radio: 'radio_',
  hg_switch: 'sw_',
  hg_slider: 'slider_',
  hg_progressbar: 'progress_',
  hg_view: 'view_',
  hg_window: 'win_',
  hg_canvas: 'canvas_',
  hg_list: 'list_',
  hg_list_item: 'item_',
  hg_video: 'video_',
  hg_3d: 'model3d_',
  hg_lottie: 'lottie_',
  hg_arc: 'arc_',
  hg_circle: 'circle_',
  hg_rect: 'rect_',
  hg_svg: 'svg_',
  hg_particle: 'particle_',
  hg_menu_cellular: 'menu_',
  hg_map: 'map_',
  hg_openclaw: 'claw_',
  hg_claw_face: 'claw_face_',
  hg_glass: 'glass_',
  hg_grid: 'grid_',
  hg_tab: 'tab_',
  hg_container: 'container_',
  hg_dialog: 'dialog_'
};

// ============ HmlValidator 类 ============

export class HmlValidator {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      textNodeName: '_text',
      parseAttributeValue: true,
      trimValues: true
    });
  }

  /**
   * 验证 HML 内容
   */
  validate(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. XML 语法校验
    const syntaxResult = this.validateXmlSyntax(content);
    if (!syntaxResult.valid) {
      errors.push(...syntaxResult.errors);
      return { valid: false, errors, warnings };
    }

    // 2. 解析 HML
    let parsed: any;
    try {
      parsed = this.xmlParser.parse(content);
    } catch (e) {
      errors.push({
        type: 'syntax',
        message: `XML 解析失败: ${e instanceof Error ? e.message : String(e)}`
      });
      return { valid: false, errors, warnings };
    }

    // 3. 结构校验
    const structureResult = this.validateStructure(parsed);
    errors.push(...structureResult.errors);
    warnings.push(...structureResult.warnings);

    // 4. 组件校验
    const componentResult = this.validateComponents(parsed);
    errors.push(...componentResult.errors);
    warnings.push(...componentResult.warnings);

    // 5. 计算统计信息
    const stats = this.calculateStats(parsed);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats
    };
  }

  /**
   * XML 语法校验
   */
  private validateXmlSyntax(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 使用 fast-xml-parser 验证
    const result = XMLValidator.validate(content, {
      allowBooleanAttributes: true
    });

    if (result !== true) {
      errors.push({
        type: 'syntax',
        message: result.err.msg,
        line: result.err.line,
        column: result.err.col,
        path: this.getXmlPath(content, result.err.line)
      });
    }

    // 检查根元素
    if (!content.includes('<hml>') && !content.includes('<hml ')) {
      errors.push({
        type: 'syntax',
        message: '缺少 <hml> 根元素'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 结构校验
   */
  private validateStructure(parsed: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!parsed.hml) {
      errors.push({
        type: 'structure',
        message: '无效的 HML 结构：缺少 <hml> 根元素'
      });
      return { errors, warnings };
    }

    const hml = parsed.hml;

    // 检查是否至少有一个 view
    const hasView = hml.view || (hml['#list'] && hml['#list'].some((item: any) => item.view));

    if (!hasView) {
      errors.push({
        type: 'structure',
        message: '缺少 <view> 元素，HML 至少需要一个视图'
      });
    }

    return { errors, warnings };
  }

  /**
   * 组件校验
   */
  private validateComponents(parsed: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const seenIds = new Set<string>();
    const allComponents: Array<{ type: string; attrs: Record<string, any>; path: string }> = [];

    // 收集所有组件
    this.collectComponents(parsed.hml, '', allComponents);

    // 校验每个组件
    for (const comp of allComponents) {
      // 1. 组件名称校验
      if (!this.isValidComponentType(comp.type)) {
        errors.push({
          type: 'schema',
          message: `未知组件类型: ${comp.type}`,
          path: comp.path,
          suggestion: '请使用有效的 HoneyGUI 组件 (hg_button, hg_label, hg_view 等)'
        });
        continue;
      }

      const attrs = comp.attrs;

      // 2. 必需属性校验
      for (const required of REQUIRED_PROPS) {
        if (attrs[required] === undefined) {
          errors.push({
            type: 'schema',
            message: `组件缺少必需属性: ${required}`,
            path: comp.path,
            suggestion: `请为 ${comp.type} 添加 ${required} 属性`
          });
        }
      }

      // 3. ID 校验
      if (attrs.id) {
        // 检查 ID 唯一性
        if (seenIds.has(attrs.id)) {
          errors.push({
            type: 'business',
            message: `组件 ID 重复: ${attrs.id}`,
            path: comp.path,
            suggestion: '每个组件的 ID 必须唯一'
          });
        }
        seenIds.add(attrs.id);

        // 检查 ID 前缀
        const expectedPrefix = ID_PREFIXES[comp.type];
        if (expectedPrefix && !attrs.id.startsWith(expectedPrefix)) {
          warnings.push({
            type: 'style',
            message: `组件 ID 建议使用 "${expectedPrefix}" 前缀`,
            path: comp.path,
            suggestion: `当前 ID: ${attrs.id}, 建议: ${expectedPrefix}${attrs.id.replace(/^[a-z_]+/, '')}`
          });
        }
      }

      // 4. 数值属性校验
      const numericProps = ['x', 'y', 'w', 'h', 'zIndex'];
      for (const prop of numericProps) {
        if (attrs[prop] !== undefined) {
          const val = Number(attrs[prop]);
          if (isNaN(val)) {
            errors.push({
              type: 'schema',
              message: `属性 ${prop} 必须是数值类型`,
              path: comp.path,
              suggestion: `当前值: ${attrs[prop]}`
            });
          }
          if (val < 0 && (prop === 'x' || prop === 'y' || prop === 'w' || prop === 'h')) {
            errors.push({
              type: 'schema',
              message: `属性 ${prop} 不能为负数`,
              path: comp.path
            });
          }
        }
      }

      // 5. 触摸目标尺寸校验 (按钮)
      if (comp.type === 'hg_button') {
        const w = Number(attrs.w) || 0;
        const h = Number(attrs.h) || 0;
        if (w < 44 || h < 44) {
          warnings.push({
            type: 'accessibility',
            message: '按钮尺寸建议不小于 44x44 像素',
            path: comp.path,
            suggestion: '较小的触摸目标会影响用户体验'
          });
        }
      }

      // 6. 字体大小校验 (文本组件)
      if (['hg_label', 'hg_button', 'hg_input'].includes(comp.type)) {
        const fontSize = Number(attrs.fontSize);
        if (fontSize && fontSize < 12) {
          warnings.push({
            type: 'accessibility',
            message: '字体大小建议不小于 12 像素',
            path: comp.path
          });
        }
      }

      // 7. 颜色格式校验
      const colorProps = ['color', 'backgroundColor', 'borderColor'];
      for (const prop of colorProps) {
        if (attrs[prop] && !this.isValidColor(attrs[prop])) {
          errors.push({
            type: 'schema',
            message: `属性 ${prop} 颜色格式无效`,
            path: comp.path,
            suggestion: '请使用 #RRGGBB 或 #AARRGGBB 格式'
          });
        }
      }

      // 8. 容器层级校验
      if (comp.type === 'hg_view' || comp.type === 'hg_window') {
        if (attrs.children && Array.isArray(attrs.children)) {
          const depth = this.calculateDepth(attrs.children, allComponents);
          if (depth > 10) {
            warnings.push({
              type: 'performance',
              message: '组件嵌套层级过深，可能影响性能',
              path: comp.path,
              suggestion: '建议将深层嵌套的组件扁平化'
            });
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * 收集所有组件
   */
  private collectComponents(element: any, path: string, result: Array<{ type: string; attrs: Record<string, any>; path: string }>): void {
    if (!element || typeof element !== 'object') return;

    for (const [key, value] of Object.entries(element)) {
      if (key === ':@' || key.startsWith('?')) continue;

      // view/window 容器
      if (key === 'view') {
        if (typeof value === 'object' && value !== null) {
          const attrs: Record<string, any> = {};
          const childPath = path + '/view';
          for (const [k, v] of Object.entries(value)) {
            // 跳过 HoneyGUI 子组件键
            if (k.startsWith('hg_') || k.startsWith('custom_')) {
              // 值可能是对象或数组（多个相同组件）
              if (Array.isArray(v)) {
                for (const item of v) {
                  if (typeof item === 'object' && item !== null) {
                    result.push({ type: k, attrs: item, path: childPath });
                  }
                }
              } else if (typeof v === 'object') {
                result.push({ type: k, attrs: v, path: childPath });
              }
            } else {
              attrs[k] = v;
            }
          }
          result.push({ type: 'hg_view', attrs, path });
        }
        continue;
      }

      if (key === 'window') {
        if (typeof value === 'object' && value !== null) {
          const attrs: Record<string, any> = {};
          const childPath = path + '/window';
          for (const [k, v] of Object.entries(value)) {
            if (k.startsWith('hg_') || k.startsWith('custom_')) {
              if (Array.isArray(v)) {
                for (const item of v) {
                  if (typeof item === 'object' && item !== null) {
                    result.push({ type: k, attrs: item, path: childPath });
                  }
                }
              } else if (typeof v === 'object') {
                result.push({ type: k, attrs: v, path: childPath });
              }
            } else {
              attrs[k] = v;
            }
          }
          result.push({ type: 'hg_window', attrs, path });
        }
        continue;
      }

      // 其他 HoneyGUI 组件（可能有多个，数组形式）
      if ((key.startsWith('hg_') || key.startsWith('custom_'))) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              result.push({ type: key, attrs: item, path });
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          result.push({ type: key, attrs: value, path });
        }
      }
    }
  }

  /**
   * 计算嵌套深度
   */
  private calculateDepth(componentIds: string[], allComponents: Array<{ type: string; attrs: Record<string, any> }>): number {
    let maxDepth = 0;
    for (const id of componentIds) {
      const comp = allComponents.find(c => c.attrs.id === id);
      if (comp && (comp.type === 'hg_view' || comp.type === 'hg_window')) {
        const children = comp.attrs.children || [];
        const depth = 1 + this.calculateDepth(children, allComponents);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth;
  }

  /**
   * 计算统计信息
   */
  private calculateStats(parsed: any): { componentCount: number; containerCount: number; maxNestingDepth: number } {
    const allComponents: Array<{ type: string; attrs: Record<string, any>; path: string }> = [];
    this.collectComponents(parsed.hml, '', allComponents);

    let containerCount = 0;
    let maxDepth = 0;

    for (const comp of allComponents) {
      if (this.isContainerType(comp.type)) {
        containerCount++;
      }
    }

    return {
      componentCount: allComponents.length,
      containerCount,
      maxNestingDepth: maxDepth
    };
  }

  /**
   * 校验组件类型是否有效
   */
  private isValidComponentType(type: string): boolean {
    return VALID_COMPONENTS.has(type);
  }

  /**
   * 校验是否为容器类型
   */
  private isContainerType(type: string): boolean {
    return CONTAINER_TYPES.has(type);
  }

  /**
   * 校验颜色格式
   */
  private isValidColor(color: string): boolean {
    return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color) ||
           /^rgb/.test(color) ||
           /^hsl/.test(color);
  }

  /**
   * 获取 XML 路径（简单实现）
   */
  private getXmlPath(content: string, line: number): string {
    const lines = content.split('\n');
    if (line > 0 && line <= lines.length) {
      const lineContent = lines[line - 1].trim();
      // 尝试提取标签名
      const match = lineContent.match(/<(\/?)([\w-]+)/);
      if (match) {
        return `/${match[2]}`;
      }
    }
    return '/unknown';
  }
}

export default HmlValidator;