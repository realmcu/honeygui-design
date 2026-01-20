/**
 * HoneyGUI API映射器
 * 负责将设计器组件类型映射到HoneyGUI API调用
 */

export interface PropertySetter {
  property: string;      // 组件属性名
  apiFunction: string;   // HoneyGUI API函数名
  valueTransform?: (value: any) => string;  // 值转换函数
}

export interface EventHandler {
  event: string;         // 事件名称
  apiFunction: string;   // HoneyGUI API函数名
}

export interface HoneyGuiApiMapping {
  componentType: string;           // 组件类型
  createFunction: string;          // 创建函数名
  propertySetters: PropertySetter[];  // 属性设置函数列表
  eventHandlers: EventHandler[];      // 事件处理函数列表
  includeHeader?: string;          // 需要包含的头文件
}

export class HoneyGuiApiMapper {
  private mappings: Map<string, HoneyGuiApiMapping>;

  constructor() {
    this.mappings = new Map();
    this.initMappings();
  }

  /**
   * 初始化组件到API的映射关系
   */
  private initMappings(): void {
    // 视图容器
    this.mappings.set('hg_view', {
      componentType: 'hg_view',
      createFunction: 'GUI_VIEW_INSTANCE',  // 使用宏而非函数
      propertySetters: [],  // view 不需要属性设置
      eventHandlers: [],
      includeHeader: 'gui_view.h'
    });

    // 按钮（双态模式使用 gui_img 实现）
    this.mappings.set('hg_button', {
      componentType: 'hg_button',
      createFunction: 'gui_img_create_from_fs',
      propertySetters: [],
      eventHandlers: [
        { event: 'onClick', apiFunction: 'gui_obj_add_event_cb' }
      ],
      includeHeader: 'gui_img.h'
    });

    // 文本标签
    this.mappings.set('hg_label', {
      componentType: 'hg_label',
      createFunction: 'gui_text_create',
      propertySetters: [
        { property: 'fontFile', apiFunction: 'gui_text_type_set' },
        { property: 'text', apiFunction: 'gui_text_content_set' },
        { property: 'fontSize', apiFunction: 'gui_text_size_set' },
        { property: 'color', apiFunction: 'gui_text_color_set', valueTransform: this.colorToHex }
      ],
      eventHandlers: [],
      includeHeader: 'gui_text.h'
    });

    // 滚动文本（基于 gui_text）
    this.mappings.set('hg_scroll_text', {
      componentType: 'hg_scroll_text',
      createFunction: 'gui_scroll_text_create',
      propertySetters: [
        { property: 'fontFile', apiFunction: 'gui_text_type_set' },
        { property: 'text', apiFunction: 'gui_text_content_set' },
        { property: 'fontSize', apiFunction: 'gui_text_size_set' },
        { property: 'color', apiFunction: 'gui_text_color_set', valueTransform: this.colorToHex },
        { property: 'scrollDirection', apiFunction: 'gui_scroll_text_scroll_set' }
      ],
      eventHandlers: [],
      includeHeader: 'gui_scroll_text.h'
    });

    // 图片
    this.mappings.set('hg_image', {
      componentType: 'hg_image',
      createFunction: 'gui_img_create_from_fs',  // 使用支持文件系统的创建函数
      propertySetters: [
        // { property: 'src', apiFunction: 'gui_img_set_attribute' } // 移除旧的设置方式
      ],
      eventHandlers: [],
      includeHeader: 'gui_img.h'
    });

    // 输入框
    this.mappings.set('hg_input', {
      componentType: 'hg_input',
      createFunction: 'gui_text_create',
      propertySetters: [
        { property: 'placeholder', apiFunction: 'gui_text_set' },
        { property: 'text', apiFunction: 'gui_text_set' }
      ],
      eventHandlers: [],
      includeHeader: 'gui_text.h'
    });

    // 开关
    this.mappings.set('hg_switch', {
      componentType: 'hg_switch',
      createFunction: 'gui_switch_create',
      propertySetters: [
        { property: 'checked', apiFunction: 'gui_switch_set_state' }
      ],
      eventHandlers: [
        { event: 'onChange', apiFunction: 'gui_switch_set_change_cb' }
      ],
      includeHeader: 'gui_switch.h'
    });

    // 滑块
    this.mappings.set('hg_slider', {
      componentType: 'hg_slider',
      createFunction: 'gui_seekbar_create',
      propertySetters: [
        { property: 'value', apiFunction: 'gui_seekbar_set_progress' },
        { property: 'min', apiFunction: 'gui_seekbar_set_range' },
        { property: 'max', apiFunction: 'gui_seekbar_set_range' }
      ],
      eventHandlers: [
        { event: 'onChange', apiFunction: 'gui_seekbar_set_change_cb' }
      ],
      includeHeader: 'gui_seekbar.h'
    });

    // 3D模型
    this.mappings.set('hg_3d', {
      componentType: 'hg_3d',
      createFunction: 'gui_3d_create',  // 需要根据文件类型选择l3_create_obj_model或l3_create_gltf_model
      propertySetters: [],
      eventHandlers: [],
      includeHeader: 'gui_lite3d.h'
    });

    // 视频
    // 注意：frameRate 和 autoPlay 已在 HoneyGuiCCodeGenerator.ts 的视频组件专门处理中生成
    this.mappings.set('hg_video', {
      componentType: 'hg_video',
      createFunction: 'gui_video_create_from_fs',  // 使用支持文件系统的创建函数
      propertySetters: [],  // 属性设置在 generateComponentCreate 中专门处理
      eventHandlers: [],
      includeHeader: 'gui_video.h'
    });

    // 圆弧
    this.mappings.set('hg_arc', {
      componentType: 'hg_arc',
      createFunction: 'gui_arc_create',
      propertySetters: [
        { property: 'radius', apiFunction: 'gui_arc_set_radius' },
        { property: 'startAngle', apiFunction: 'gui_arc_set_start_angle' },
        { property: 'endAngle', apiFunction: 'gui_arc_set_end_angle' },
        { property: 'strokeWidth', apiFunction: 'gui_arc_set_line_width' },
        { property: 'color', apiFunction: 'gui_arc_set_color', valueTransform: this.colorToGuiColor }
      ],
      eventHandlers: [
        { event: 'onClick', apiFunction: 'gui_arc_on_click' }
      ],
      includeHeader: 'gui_arc.h'
    });

    // 圆形
    this.mappings.set('hg_circle', {
      componentType: 'hg_circle',
      createFunction: 'gui_circle_create',
      propertySetters: [
        { property: 'radius', apiFunction: 'gui_circle_set_radius' },
        { property: 'fillColor', apiFunction: 'gui_circle_set_color', valueTransform: this.colorToGuiColor }
      ],
      eventHandlers: [
        { event: 'onClick', apiFunction: 'gui_circle_on_click' }
      ],
      includeHeader: 'gui_circle.h'
    });

    // 矩形
    this.mappings.set('hg_rect', {
      componentType: 'hg_rect',
      createFunction: 'gui_rect_create',
      propertySetters: [
        { property: 'borderRadius', apiFunction: 'gui_rect_set_radius' },
        { property: 'fillColor', apiFunction: 'gui_rect_set_color', valueTransform: this.colorToGuiColor }
      ],
      eventHandlers: [
        { event: 'onClick', apiFunction: 'gui_rect_on_click' }
      ],
      includeHeader: 'gui_rect.h'
    });

    // 列表控件
    this.mappings.set('hg_list', {
      componentType: 'hg_list',
      createFunction: 'gui_list_create',
      propertySetters: [],  // 属性设置在 ListGenerator 中专门处理
      eventHandlers: [],
      includeHeader: 'gui_list.h'
    });

    // 玻璃效果
    this.mappings.set('hg_glass', {
      componentType: 'hg_glass',
      createFunction: 'gui_glass_create_from_fs',
      propertySetters: [],
      eventHandlers: [],
      includeHeader: 'gui_glass.h'
    });
  }

  /**
   * 获取组件的API映射
   */
  getMapping(componentType: string): HoneyGuiApiMapping | null {
    return this.mappings.get(componentType) || null;
  }

  /**
   * 获取所有需要包含的头文件
   */
  getRequiredHeaders(componentTypes: string[]): string[] {
    const headers = new Set<string>();
    componentTypes.forEach(type => {
      const mapping = this.mappings.get(type);
      if (mapping?.includeHeader) {
        headers.add(mapping.includeHeader);
      }
    });
    return Array.from(headers);
  }

  /**
   * 颜色转换为十六进制
   */
  private colorToHex(color: string): string {
    if (color.startsWith('#')) {
      return '0x' + color.substring(1).toUpperCase();
    }
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return '0x' + (r + g + b).toUpperCase();
      }
    }
    return '0x000000';
  }

  /**
   * 颜色转换为 gui_rgba 宏调用（与 SDK 示例代码一致）
   * @param color 颜色字符串
   * @param opacity 可选的透明度覆盖值 (0-255)
   */
  public colorToGuiColor(color: string, opacity?: number): string {
    let r = 0, g = 0, b = 0, a = 255;
    
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (hex.length === 8) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        a = parseInt(hex.substring(6, 8), 16);
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        r = parseInt(match[0]);
        g = parseInt(match[1]);
        b = parseInt(match[2]);
        if (match.length >= 4) {
          a = Math.round(parseFloat(match[3]) * 255);
        }
      }
    }
    
    // 如果提供了 opacity 参数，使用它覆盖颜色中的 alpha 值
    if (opacity !== undefined) {
      a = Math.max(0, Math.min(255, Math.round(opacity)));
    }
    
    // 使用 gui_rgba 宏（与 SDK 示例代码一致）
    return `gui_rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * 添加自定义映射
   */
  addCustomMapping(mapping: HoneyGuiApiMapping): void {
    this.mappings.set(mapping.componentType, mapping);
  }
}
