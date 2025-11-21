import { Component, Document as HmlDocument } from './types';
import { xml2js } from 'xml-js';

// 导出类型以供其他模块使用
export type { Document as HmlDocument, Component } from './types';

/**
 * HML解析器，用于解析HML文件内容并转换为组件树
 * 按照方案一：严格遵循标准格式
 */
export class HmlParser {
  /**
   * 检查是否为HoneyGUI组件
   * HoneyGUI组件统一使用hg_前缀以避免与React组件冲突
   */
  private _isHoneyGuiComponent(componentName: string): boolean {
    return componentName.startsWith('hg_');
  }

  /**
   * 解析HML内容
   * @param content HML文件内容
   * @returns 解析后的文档对象
   */
  parse(content: string): HmlDocument {
    try {
      // 使用xml-js解析XML内容
      const result = xml2js(content, {
        compact: true,
        ignoreDeclaration: true,
        ignoreInstruction: true,
        ignoreAttributes: false,
        ignoreComment: true,
        ignoreCdata: true,
        ignoreDoctype: true,
        textKey: '_text',
        attributesKey: '_attributes'
      });

      // 检查解析结果
      if (!result || typeof result !== 'object') {
        console.error('HML解析错误: 无效的XML格式');
        return this._getDefaultDocument();
      }

      // 确保根标签是hml
      const hmlElement = (result as any).hml || result;

      // 解析元数据
      const meta = this._parseMetaXmlJs((hmlElement as any).meta);

      // 解析视图
      const view = this._parseViewXmlJs((hmlElement as any).view, meta);

      // 构建完整的文档对象（新格式）
      const document: HmlDocument = {
        meta,
        view
      };

      return document;
    } catch (error) {
      console.error('HML解析过程中出错:', error);
      return this._getDefaultDocument();
    }
  }

  /**
   * 获取默认文档（用于解析失败时返回）
   */
  private _getDefaultDocument(): HmlDocument {
    // 创建包含screen的标准结构（新格式）
    const screenComponent: Component = {
      id: 'main_screen',
      type: 'hg_screen',
      name: 'Screen',
      position: {
        x: 0,
        y: 0,
        width: 480,
        height: 800
      },
      style: {
        backgroundColor: '#f5f5f5'
      },
      data: {
        text: 'Default Screen'
      },
      children: [],
      parent: null,
      visible: true,
      enabled: true,
      locked: false,
      zIndex: 0
    };

    return {
      meta: {
        title: '未命名页面',
        description: 'HML解析失败'
      },
      view: {
        components: [screenComponent]
      }
    };
  }

  /**
   * 生成唯一ID
   */
  private _generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * 解析元数据 (使用xml-js)
   * 返回新格式的meta
   * @param metaElement meta元素
   */
  private _parseMetaXmlJs(metaElement: any): any {
    if (!metaElement || typeof metaElement !== 'object') {
      return {
        title: '未命名页面',
        description: ''
      };
    }

    const meta: any = {};

    // 处理meta的直接属性
    const attributes = metaElement._attributes || {};
    if (attributes.title) meta.title = String(attributes.title);
    if (attributes.description) meta.description = String(attributes.description);

    // 处理meta的子元素（project, author等）
    const specialElements = ['project', 'author'];
    Object.keys(metaElement).forEach(key => {
      if (key !== '_attributes' && specialElements.includes(key)) {
        const element = metaElement[key];
        if (element && typeof element === 'object') {
          const elementAttrs = element._attributes || {};
          if (key === 'project') {
            meta.project = { ...elementAttrs };
          } else if (key === 'author') {
            meta.author = { ...elementAttrs };
          }
        }
      }
    });

    // 填充默认值
    if (!meta.title) meta.title = '未命名页面';

    return meta;
  }

  /**
   * 解析视图 (使用xml-js)
   * 返回新格式的view（只包含components）
   * @param viewElement view元素
   */
  private _parseViewXmlJs(viewElement: any, meta: any): any {
    // View现在是一个简单的对象，只包含components数组
    const view: any = {};

    const components: Component[] = [];
    const componentMap = new Map<string, Component>();

    if (viewElement && typeof viewElement === 'object') {
      Object.keys(viewElement).forEach(key => {
        if (key !== '_attributes') {
          if (!this._isHoneyGuiComponent(key)) {
            console.warn(`[HoneyGUI] 跳过非HoneyGUI组件: ${key}`);
            return;
          }
          const element = (viewElement as any)[key];
          if (element && typeof element === 'object') {
            const elements = Array.isArray(element) ? element : [element];
            elements.forEach((child: any) => {
              const component = this._parseComponentXmlJs(key, child, componentMap, undefined);
              if (!component.parent) {
                components.push(component);
              }
            });
          }
        }
      });
    }

    view.components = components;
    return view;
  }

  /**
   * 解析组件 (使用xml-js) - 生成新格式
   */
  private _parseComponentXmlJs(
    tagName: string,
    element: any,
    componentMap: Map<string, Component>,
    parentId?: string
  ): Component {
    const attributes = element._attributes || {};
    const componentId = attributes.id || this._generateId(tagName.toLowerCase());

    // 检查组件是否已经在map中
    if (componentMap.has(componentId)) {
      return componentMap.get(componentId)!;
    }

    // 提取位置和尺寸属性
    const x = parseInt(attributes.x || '0');
    const y = parseInt(attributes.y || '0');
    const width = parseInt(attributes.width || '100');
    const height = parseInt(attributes.height || '40');

    // 分离属性到style、data和其他properties
    const style: Record<string, any> = {};
    const data: Record<string, any> = {};
    const otherProps: Record<string, any> = {};

    // 定义常见的样式属性
    const styleProps = ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'border', 'borderRadius', 'padding', 'margin', 'overflow', 'title', 'titleBarHeight', 'titleBarColor'];

    // 定义常见的数据属性
    const dataProps = ['text', 'src', 'value', 'placeholder', 'options'];

    // 定义组件元属性
    const metaProps = ['name', 'visible', 'enabled', 'locked', 'zIndex'];

    Object.entries(attributes).forEach(([key, value]) => {
      if (!['id', 'x', 'y', 'width', 'height'].includes(key)) {
        if (styleProps.includes(key)) {
          style[key] = value;
        } else if (dataProps.includes(key)) {
          data[key] = value;
        } else if (metaProps.includes(key)) {
          // 这些会单独处理
        } else {
          otherProps[key] = value;
        }
      }
    });

    // 创建组件（新格式）
    const component: Component = {
      id: componentId,
      type: tagName,
      name: attributes.name || `${tagName}_${componentId.substr(-4)}`,
      position: {
        x,
        y,
        width,
        height
      },
      style,
      data,
      events: undefined,  // 可以后续添加事件处理
      children: [],
      parent: parentId || null,
      visible: attributes.visible !== 'false',  // 默认为true
      enabled: attributes.enabled !== 'false',  // 默认为true
      locked: attributes.locked === 'true',     // 默认为false
      zIndex: parseInt(attributes.zIndex || '0')
    };

    // 将组件添加到map中
    componentMap.set(componentId, component);

    // 递归解析子组件
    Object.keys(element).forEach(key => {
      if (key !== '_attributes' && key !== '_text' && typeof (element as any)[key] === 'object') {
        // 处理数组和单个对象情况
        const value = (element as any)[key];
        const children = Array.isArray(value) ? value : [value];
        children.forEach((child: any) => {
          const childComponent = this._parseComponentXmlJs(key, child, componentMap, componentId);
          // 只存储子组件ID引用
          if (component.children) {
            component.children.push(childComponent.id);
          }
        });
      }
    });

    return component;
  }
}
