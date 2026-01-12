/**
 * 改进的HML解析器
 * 修复了组件过滤问题，支持更灵活的组件识别
 */

import { XMLParser } from 'fast-xml-parser';
import { Component, Meta, View, Document, ComponentPosition } from './types';
import type { EventConfig, Action, EventType, ActionType } from './eventTypes';
import { logger } from '../utils/Logger';

/**
 * 组件注册表 - 集中管理所有支持的组件类型
 */
class ComponentRegistry {
  private static readonly VALID_COMPONENTS = new Set([
    // HoneyGUI标准组件 (hg_前缀)
    'hg_button', 'hg_text', 'hg_image', 'hg_input',
    'hg_checkbox', 'hg_radio', 'hg_progressbar', 'hg_slider',
    'hg_switch', 'hg_canvas', 'hg_list', 'hg_list_item', 'hg_grid', 'hg_tab',
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
      parseAttributeValue: false,  // 关闭自动类型转换，所有属性值保持原始字符串
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
          logger.warn(`[HoneyGUI] 跳过未知组件: ${key}, 提示: 如果这是自定义组件，请使用 'custom_' 前缀或注册到组件表`);
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

    // 应用默认值（针对 list 控件）
    if (normalizedType === 'hg_list') {
      this._applyListDefaults(style, data);
    }

    // 解析事件配置
    const eventConfigs = this._parseEventConfigs(element);

    // 创建组件
    const component: Component = {
      id: componentId,
      type: normalizedType,
      name: attributes.name || componentId,
      position,
      style,
      data,
      events,
      eventConfigs,
      children: [],
      parent: parentId || null,
      visible: attributes.visible !== 'false',
      enabled: attributes.enabled !== 'false',
      locked: attributes.locked === 'true',
      zIndex: parseInt(attributes.zIndex || '0')
    };

    // 添加到映射
    componentMap.set(componentId, component);

    // 解析子组件
    this._parseChildren(element, componentMap, componentId, component);

    return component;
  }

  /**
   * 应用 list 控件的默认值
   */
  private _applyListDefaults(style: Record<string, any>, data: Record<string, any>): void {
    // 样式默认值
    if (style.itemWidth === undefined) style.itemWidth = 100;
    if (style.itemHeight === undefined) style.itemHeight = 100;
    if (style.space === undefined) style.space = 0;
    if (style.direction === undefined) style.direction = 'VERTICAL';
    if (style.style === undefined) style.style = 'LIST_CLASSIC';

    // 数据默认值
    if (data.noteNum === undefined) data.noteNum = 5;

    // 通用属性默认值
    if (data.autoAlign === undefined) data.autoAlign = true;
    if (data.inertia === undefined) data.inertia = true;
    if (data.loop === undefined) data.loop = false;
    if (data.createBar === undefined) data.createBar = false;
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
      'color', 'backgroundColor', 'fontWeight',
      'border', 'borderRadius', 'padding', 'margin',
      'overflow', 'title', 'titleBarHeight', 'titleBarColor',
      // 圆弧属性
      'radius', 'startAngle', 'endAngle', 'strokeWidth',
      // 矩形属性
      'fillColor',
      // 列表属性
      'itemWidth', 'itemHeight', 'direction', 'style', 'space', 'cardStackLocation',
      // 图像变换属性
      'transform',
      // 文本样式属性
      'align', 'hAlign', 'vAlign', 'letterSpacing', 'lineSpacing', 'wordWrap', 'wordBreak',
      // 渐变属性
      'useGradient', 'gradientType', 'gradientDirection'

    ]);

    // 需要转换为数字的属性
    const numericProps = new Set([
      'fontSize', 'borderRadius', 'padding', 'margin',
      'titleBarHeight', 'radius', 'startAngle', 'endAngle', 'strokeWidth',
      'itemWidth', 'itemHeight'
    ]);

    const dataProps = new Set([
      'text', 'src', 'value', 'placeholder', 'options',
      'min', 'max', 'step', 'checked', 'selected',
      // 列表数据属性
      'noteNum',
      // 列表通用属性
      'autoAlign', 'inertia', 'loop', 'createBar', 'offset', 'outScope',
      // 文本数据属性
      'fontFile', 'timeFormat',
      // 字体配置属性
      'fontType', 'renderMode', 'fontSize',
      // hg_view 特有属性
      'residentMemory', 'animateStep', 'opacity'
    ]);

    const metaProps = new Set([
      'id', 'name', 'x', 'y', 'width', 'height',
      'visible', 'enabled', 'locked', 'zIndex', 'parent'
    ]);

    Object.keys(attributes).forEach(key => {
      if (metaProps.has(key)) {
        return; // 跳过元属性
      }

      // 跳过组件类型属性（如 hg_button, hg_view 等），这些是冗余数据
      if (ComponentRegistry.isValidComponent(key)) {
        return;
      }

      if (key.startsWith('on')) {
        events[key] = attributes[key];
      } else if (styleProps.has(key)) {
        // 数字类型属性需要转换
        let value = attributes[key];
        if (numericProps.has(key) && typeof value === 'string') {
          const num = parseFloat(value);
          value = isNaN(num) ? value : num;
        }
        // transform 属性需要从 JSON 字符串解析为对象
        if (key === 'transform' && typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.warn(`Failed to parse transform JSON: ${value}`);
          }
        }
        // useGradient 布尔值转换
        if (key === 'useGradient') {
          value = value === 'true' || value === true;
        }
        style[key] = value;
      } else if (dataProps.has(key)) {
        data[key] = attributes[key];
      } else {
        // 未知属性放入data
        let value = attributes[key];
        // gradientStops 需要从 JSON 字符串解析为数组
        if (key === 'gradientStops' && typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.warn(`Failed to parse gradientStops JSON: ${value}`);
            value = [];
          }
        }
        // gradientStartAngle 和 gradientEndAngle 需要转换为数字
        if ((key === 'gradientStartAngle' || key === 'gradientEndAngle') && typeof value === 'string') {
          const num = parseFloat(value);
          value = isNaN(num) ? 0 : num;
        }
        // enableEndCap 需要转换为布尔值
        if (key === 'enableEndCap') {
          value = value === 'true' || value === true;
        }
        data[key] = value;
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
    let listItemIndex = 0; // 用于自动分配 list_item 的 index
    
    Object.keys(element).forEach(key => {
      if (key === '_attributes' || key === '_text' || key === 'events') {
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
          
          // 对于 hg_list 的 hg_list_item 子组件，如果没有 index 属性，自动分配
          if (parentComponent.type === 'hg_list' && childComponent.type === 'hg_list_item') {
            if (childComponent.data && childComponent.data.index === undefined) {
              childComponent.data.index = listItemIndex;
            }
            listItemIndex++;
          }
          
          parentComponent.children!.push(childComponent.id);
        });
      }
    });

    // 对于 hg_list 组件，按 y 坐标排序子组件（hg_list_item），并重新分配 index
    if (parentComponent.type === 'hg_list' && parentComponent.children && parentComponent.children.length > 0) {
      const childComponents = parentComponent.children
        .map(childId => componentMap.get(childId))
        .filter(child => child !== undefined) as Component[];
      
      // 按 y 坐标排序（对于垂直列表）或 x 坐标排序（对于水平列表）
      const direction = parentComponent.style?.direction || parentComponent.data?.direction || 'VERTICAL';
      childComponents.sort((a, b) => {
        if (direction === 'VERTICAL') {
          return a.position.y - b.position.y;
        } else {
          return a.position.x - b.position.x;
        }
      });
      
      // 重新分配 index（按排序后的顺序）
      childComponents.forEach((child, idx) => {
        if (child.data) {
          child.data.index = idx;
        } else {
          child.data = { index: idx };
        }
      });
      
      // 更新 children 数组为排序后的顺序
      parentComponent.children = childComponents.map(c => c.id);
    }
  }

  /**
   * 解析事件配置 (Event-Action)
   */
  private _parseEventConfigs(element: any): EventConfig[] | undefined {
    // 支持两种格式：events.event 和 eventConfigs.eventConfig
    const eventsSource = element.events?.event || element.eventConfigs?.eventConfig;
    
    if (!eventsSource) {
      return undefined;
    }

    const eventElements = Array.isArray(eventsSource)
      ? eventsSource
      : [eventsSource];

    const eventConfigs: EventConfig[] = [];

    eventElements.forEach((eventEl: any) => {
      const attrs = eventEl._attributes || eventEl;
      const eventType = attrs.type as EventType;
      
      if (!eventType) return;

      const eventConfig: EventConfig = {
        type: eventType,
        actions: [],
      };

      // onMessage 需要 message 属性
      if (eventType === 'onMessage' && attrs.message) {
        eventConfig.message = attrs.message;
      }

      // 解析 handler 属性（回调函数名）
      if (attrs.handler) {
        eventConfig.handler = attrs.handler;
      }

      // 解析动作
      if (eventEl.action) {
        const actionElements = Array.isArray(eventEl.action)
          ? eventEl.action
          : [eventEl.action];

        actionElements.forEach((actionEl: any) => {
          const actionAttrs = actionEl._attributes || actionEl;
          const action: Action = {
            type: actionAttrs.type as ActionType,
          };

          // 根据动作类型解析参数
          if (actionAttrs.target) action.target = actionAttrs.target;
          if (actionAttrs.message) action.message = actionAttrs.message;
          if (actionAttrs.functionName) action.functionName = actionAttrs.functionName;
          if (actionAttrs.switchOutStyle) action.switchOutStyle = actionAttrs.switchOutStyle;
          if (actionAttrs.switchInStyle) action.switchInStyle = actionAttrs.switchInStyle;

          eventConfig.actions.push(action);
        });
      }

      eventConfigs.push(eventConfig);
    });

    return eventConfigs.length > 0 ? eventConfigs : undefined;
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
