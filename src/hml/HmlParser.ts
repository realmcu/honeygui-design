import { Component, Document as HmlDocument, Meta, View, ComponentProperties } from './types';
import { xml2js } from 'xml-js';

// 导出类型以供其他模块使用
export type { Document as HmlDocument, Component, ComponentProperties } from './types';

/**
 * HML解析器，用于解析HML文件内容并转换为组件树
 * 按照方案一：严格遵循标准格式
 */
export class HmlParser {
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

      // 构建完整的文档对象
      const document: HmlDocument = {
        meta,
        view
      };

      // 如果view中有components数组，直接添加到文档
      if (view.components && view.components.length > 0) {
        document.components = view.components;
      }

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
    // 创建包含screen的标准结构
    const screenComponent: Component = {
      id: 'main_screen',
      type: 'screen',
      x: 0,
      y: 0,
      width: 480,
      height: 800,
      properties: {
        backgroundColor: '#f5f5f5',
        title: 'Default Screen'
      },
      children: []
    };

    return {
      meta: {
        title: '未命名页面',
        description: 'HML解析失败',
        width: 480,
        height: 800
      },
      view: {
        id: 'main_view',
        width: 480,
        height: 800,
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
   * @param metaElement meta元素
   */
  private _parseMetaXmlJs(metaElement: any): Meta {
    if (!metaElement || typeof metaElement !== 'object') {
      return {
        title: '未命名页面',
        description: '',
        width: 480,
        height: 800
      };
    }

    const meta: Meta = {};

    // 处理meta的直接属性
    const attributes = metaElement._attributes || {};
    if (attributes.title) meta.title = String(attributes.title);
    if (attributes.description) meta.description = String(attributes.description);
    if (attributes.width) meta.width = parseInt(attributes.width);
    if (attributes.height) meta.height = parseInt(attributes.height);

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
    if (!meta.width) meta.width = 480;
    if (!meta.height) meta.height = 800;

    return meta;
  }

  /**
   * 解析视图 (使用xml-js)
   * @param viewElement view元素
   * @param meta meta对象（用于获取宽高等信息）
   */
  private _parseViewXmlJs(viewElement: any, meta: Meta): View {
    if (!viewElement || typeof viewElement !== 'object') {
      return {
        id: 'main_view',
        width: meta.width || 480,
        height: meta.height || 800,
        components: []
      };
    }

    const attributes = viewElement._attributes || {};
    const view: View = {
      id: attributes.id || 'main_view',
      width: parseInt(attributes.width || meta.width?.toString() || '480'),
      height: parseInt(attributes.height || meta.height?.toString() || '800')
    };

    // 解析view中的组件
    const components: Component[] = [];
    const componentMap = new Map<string, Component>();

    // 递归解析view中的所有子组件（排除_attributes）
    Object.keys(viewElement).forEach(key => {
      if (key !== '_attributes') {
        const element = (viewElement as any)[key];
        if (element && typeof element === 'object') {
          // 处理数组和单个对象情况
          const elements = Array.isArray(element) ? element : [element];
          elements.forEach((child: any) => {
            const component = this._parseComponentXmlJs(key, child, componentMap, undefined);
            if (!component.parentId) {
              components.push(component);
            }
          });
        }
      }
    });

    view.components = components;
    return view;
  }

  /**
   * 解析组件 (使用xml-js)
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

    // 提取其他属性
    const properties: Record<string, any> = {};
    Object.entries(attributes).forEach(([key, value]) => {
      if (!['id', 'x', 'y', 'width', 'height'].includes(key)) {
        properties[key] = value;
      }
    });

    const component: Component = {
      id: componentId,
      type: tagName,
      x,
      y,
      width,
      height,
      properties,
      children: [],
      parentId
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
          if (component.children) {
            component.children.push(childComponent);
          }
        });
      }
    });

    return component;
  }
}
