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
      createFunction: 'gui_view_create',
      propertySetters: [
        { property: 'backgroundColor', apiFunction: 'gui_obj_set_color', valueTransform: this.colorToHex }
      ],
      eventHandlers: [],
      includeHeader: 'gui_view.h'
    });

    // 按钮
    this.mappings.set('hg_button', {
      componentType: 'hg_button',
      createFunction: 'gui_button_create',
      propertySetters: [
        { property: 'text', apiFunction: 'gui_button_set_text' },
        { property: 'backgroundColor', apiFunction: 'gui_button_set_color', valueTransform: this.colorToHex }
      ],
      eventHandlers: [
        { event: 'onClick', apiFunction: 'gui_button_set_click_cb' }
      ],
      includeHeader: 'gui_button.h'
    });

    // 文本标签
    this.mappings.set('hg_label', {
      componentType: 'hg_label',
      createFunction: 'gui_text_create',
      propertySetters: [
        { property: 'text', apiFunction: 'gui_text_set' },
        { property: 'fontSize', apiFunction: 'gui_text_set_font_size' },
        { property: 'color', apiFunction: 'gui_text_set_color', valueTransform: this.colorToHex }
      ],
      eventHandlers: [],
      includeHeader: 'gui_text.h'
    });

    // 图片
    this.mappings.set('hg_image', {
      componentType: 'hg_image',
      createFunction: 'gui_img_create',
      propertySetters: [
        { property: 'src', apiFunction: 'gui_img_set_attribute' }
      ],
      eventHandlers: [],
      includeHeader: 'gui_img.h'
    });

    // 输入框
    this.mappings.set('hg_input', {
      componentType: 'hg_input',
      createFunction: 'gui_textbox_create',
      propertySetters: [
        { property: 'placeholder', apiFunction: 'gui_textbox_set_placeholder' },
        { property: 'text', apiFunction: 'gui_textbox_set_text' }
      ],
      eventHandlers: [],
      includeHeader: 'gui_textbox.h'
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
   * 添加自定义映射
   */
  addCustomMapping(mapping: HoneyGuiApiMapping): void {
    this.mappings.set(mapping.componentType, mapping);
  }
}
