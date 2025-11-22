/**
 * 改进的HML解析器
 * 修复了组件过滤问题，支持更灵活的组件识别
 */

import { XMLParser } from 'fast-xml-parser';
import { Component, Meta, View, Document, ComponentPosition } from './types';

/**
 * 组件注册表 - 集中管理所有支持的组件类型
 */
class ComponentRegistry {
  private static readonly VALID_COMPONENTS = new Set([
    // HoneyGUI标准组件 (hg_前缀)
    'hg_button', 'hg_panel', 'hg_text', 'hg_image', 'hg_input',
    'hg_checkbox', 'hg_radio', 'hg_progressbar', 'hg_slider',
    'hg_switch', 'hg_canvas', 'hg_list', 'hg_grid', 'hg_tab',
    'hg_label',
    
    // 容器组件
    'hg_window', 'hg_dialog', 'hg_container', 'hg_view'
  ]);

  static isValidComponent(name: string): boolean {
    return this.VALID_COMPONENTS.has(name) || name.startsWith('hg_') || name.startsWith('custom_');
  }

  static register(componentName: string): void {
    this.VALID_COMPONENTS.add(componentName);
  }
}

/**
 * HML解析器 (改进版本)
 */
export class HmlParser {
  private xmlParser: XMLParser;
  private idCounter = 0;

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
   * 解析HML内容
   */
  parse(content: string): Document {
    try {
      const parsed = this.xmlParser.parse(content);
      
      if (!parsed.hml) {
        throw new Error('Invalid HML: missing <hml> root element');
      }

      const meta = this._parseMeta(parsed.hml.meta || {});
      const view = this._parseView(parsed.hml.view || {}, meta);

      return { meta, view };
    } catch (error) {
      throw new Error(`HML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解析元数据
   */
  private _parseMeta(metaElement: any): Meta {
    const meta: Meta = {};

    // 基本属性
    if (metaElement.title) meta.title = String(metaElement.title);
    if (metaElement.description) meta.description = String(metaElement.description);

    // 项目信息
    if (metaElement.project) {
      meta.project = { ...metaElement.project };
    }

    // 作者信息
    if (metaElement.author) {
      meta.author = { ...metaElement.author };
    }

    // 默认值
    if (!meta.title) meta.title = '未命名页面';

    return meta;
  }

  /**
   * 解析视图
   */
  private _parseView(viewElement: any, meta: Meta): View {
    const components: Component[] = [];
    const componentMap = new Map<string, Component>();

    if (viewElement && typeof viewElement === 'object') {
      Object.keys(viewElement).forEach(key => {
        if (key === '_attributes' || key === '_text') {
          return;
        }

        // 使用改进的组件验证
        if (!ComponentRegistry.isValidComponent(key)) {
          console.warn(`[HoneyGUI] 跳过未知组件: ${key}`);
          console.warn(`[HoneyGUI] 提示: 如果这是自定义组件，请使用 'custom_' 前缀或注册到组件表`);
          return;
        }

        const element = viewElement[key];
        if (element && typeof element === 'object') {
          const elements = Array.isArray(element) ? element : [element];
          elements.forEach((child: any) => {
            const component = this._parseComponent(key, child, componentMap, undefined);
            components.push(component);
          });
        }
      });
    }

    return {
      components: Array.from(componentMap.values())
    };
  }

  /**
   * 解析组件
   */
  private _parseComponent(
    tagName: string,
    element: any,
    componentMap: Map<string, Component>,
    parentId?: string
  ): Component {
    // 优先从 _attributes 中获取，如果不存在则从 element 本身获取
    const attributes = element._attributes || element;
    // 确保正确提取 id，避免生成新ID
    const componentId = attributes.id || element.id || this._generateId(tagName);

    // 检查是否已存在
    if (componentMap.has(componentId)) {
      return componentMap.get(componentId)!;
    }

    // 直接使用tagName作为组件类型
    const normalizedType = tagName;

    // 解析位置和尺寸
    const position: ComponentPosition = {
      x: parseInt(attributes.x || '0'),
      y: parseInt(attributes.y || '0'),
      width: parseInt(attributes.width || '100'),
      height: parseInt(attributes.height || '40')
    };

    // 分离属性
    const { style, data, events } = this._categorizeAttributes(attributes);

    // 创建组件
    const component: Component = {
      id: componentId,
      type: normalizedType,
      name: attributes.name || componentId,
      position,
      style,
      data,
      events,
      children: [],
      parent: parentId || null,
      visible: attributes.visible !== false,
      enabled: attributes.enabled !== false,
      locked: attributes.locked === true,
      zIndex: parseInt(attributes.zIndex || '0')
    };

    // 添加到映射
    componentMap.set(componentId, component);

    // 解析子组件
    this._parseChildren(element, componentMap, componentId, component);

    return component;
  }

  /**
   * 分类属性到style、data、events
   */
  private _categorizeAttributes(attributes: any): {
    style: Record<string, any>;
    data: Record<string, any>;
    events: Record<string, any>;
  } {
    const style: Record<string, any> = {};
    const data: Record<string, any> = {};
    const events: Record<string, any> = {};

    const styleProps = new Set([
      'color', 'backgroundColor', 'fontSize', 'fontWeight',
      'border', 'borderRadius', 'padding', 'margin',
      'opacity', 'overflow', 'title', 'titleBarHeight', 'titleBarColor'
    ]);

    const dataProps = new Set([
      'text', 'src', 'value', 'placeholder', 'options',
      'min', 'max', 'step', 'checked', 'selected'
    ]);

    const metaProps = new Set([
      'id', 'name', 'x', 'y', 'width', 'height',
      'visible', 'enabled', 'locked', 'zIndex', 'parent'
    ]);

    Object.keys(attributes).forEach(key => {
      if (metaProps.has(key)) {
        return; // 跳过元属性
      }

      // 跳过组件类型属性（如 hg_button, hg_panel 等），这些是冗余数据
      if (ComponentRegistry.isValidComponent(key)) {
        return;
      }

      if (key.startsWith('on')) {
        events[key] = attributes[key];
      } else if (styleProps.has(key)) {
        style[key] = attributes[key];
      } else if (dataProps.has(key)) {
        data[key] = attributes[key];
      } else {
        // 未知属性放入data
        data[key] = attributes[key];
      }
    });

    return { style, data, events };
  }

  /**
   * 解析子组件
   */
  private _parseChildren(
    element: any,
    componentMap: Map<string, Component>,
    parentId: string,
    parentComponent: Component
  ): void {
    Object.keys(element).forEach(key => {
      if (key === '_attributes' || key === '_text') {
        return;
      }

      if (!ComponentRegistry.isValidComponent(key)) {
        return;
      }

      const childElement = element[key];
      if (childElement && typeof childElement === 'object') {
        const children = Array.isArray(childElement) ? childElement : [childElement];
        children.forEach((child: any) => {
          const childComponent = this._parseComponent(key, child, componentMap, parentId);
          parentComponent.children!.push(childComponent.id);
        });
      }
    });
  }

  /**
   * 生成唯一ID
   */
  private _generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${this.idCounter++}`;
  }
}

// 导出组件注册表供外部使用
export { ComponentRegistry };
