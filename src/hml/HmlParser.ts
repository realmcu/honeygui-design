import { Component, Document as HmlDocument, Meta, View, ComponentProperties } from './types';
import { xml2js } from 'xml-js';

// 导出类型以供其他模块使用
export type { Document as HmlDocument, Component, ComponentProperties } from './types';

/**
 * HML解析器，用于解析HML文件内容并转换为组件树
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

      // 解析元数据
      const meta = this._parseMetaXmlJs((result as any).meta);
      // 解析视图
      const view = this._parseViewXmlJs((result as any).view);
      
      // 构建组件树
      const components: Component[] = [];
      const componentMap = new Map<string, Component>();
      
      // 解析所有组件（排除meta和view）
      Object.entries(result as any).forEach(([key, value]) => {
        if (key !== 'meta' && key !== 'view' && typeof value === 'object') {
          const component = this._parseComponentXmlJs(key, value, componentMap, undefined);
          if (!component.parentId) {
            components.push(component);
          }
        }
      });
      
      // 确保组件树是扁平化的
      const flattenedComponents = this._flattenComponents(components);
      
      return {
        meta,
        view,
        components: flattenedComponents
      };
    } catch (error) {
      console.error('HML解析过程中出错:', error);
      return this._getDefaultDocument();
    }
  }
  
  /**
   * 获取默认文档（用于解析失败时返回）
   */
  private _getDefaultDocument(): HmlDocument {
    return {
      meta: {
        title: '未命名页面',
        description: 'HML解析失败',
        width: 480,
        height: 800
      },
      view: {
        id: 'screen',
        width: 480,
        height: 800,
        backgroundColor: '#ffffff'
      },
      components: [
        {
          id: 'screen',
          type: 'screen',
          x: 0,
          y: 0,
          width: 480,
          height: 800,
          properties: {
            backgroundColor: '#ffffff'
          },
          children: []
        },
        {
          id: 'error-text',
          type: 'text',
          x: 20,
          y: 100,
          width: 440,
          height: 40,
          properties: {
            text: 'HML解析失败，请检查文件格式',
            fontSize: 16,
            color: '#ff0000'
          },
          parentId: 'screen'
        }
      ]
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
    
    const attributes = metaElement._attributes || {};
    return {
      title: attributes.title || '未命名页面',
      description: attributes.description || '',
      width: parseInt(attributes.width || '480'),
      height: parseInt(attributes.height || '800')
    };
  }
  
  /**
   * 解析视图 (使用xml-js)
   */
  private _parseViewXmlJs(viewElement: any): View {
    if (!viewElement || typeof viewElement !== 'object') {
      return {
        id: 'screen',
        width: 480,
        height: 800,
        backgroundColor: '#ffffff'
      };
    }
    
    const attributes = viewElement._attributes || {};
    return {
      id: attributes.id || 'screen',
      width: parseInt(attributes.width || '480'),
      height: parseInt(attributes.height || '800'),
      backgroundColor: attributes.backgroundColor || '#ffffff'
    };
  }
  
  /**
   * 解析组件 (使用xml-js)
   */
  private _parseComponentXmlJs(tagName: string, element: any, componentMap: Map<string, Component>, parentId?: string): Component {
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
      type: tagName.toLowerCase(),
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
    Object.entries(element).forEach(([key, value]) => {
      if (key !== '_attributes' && key !== '_text' && typeof value === 'object') {
        // 处理数组和单个对象情况
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
  
  /**
   * 获取元素属性（保留此方法以兼容可能的未来使用）
   */
  private _getAttribute(element: any, name: string, defaultValue: string): string {
    if (!element || typeof element !== 'object') {
      return defaultValue;
    }
    const attributes = element._attributes || {};
    return attributes[name] !== undefined ? String(attributes[name]) : defaultValue;
  }
  
  /**
   * 扁平化组件树
   */
  private _flattenComponents(components: Component[]): Component[] {
    const flattened: Component[] = [];
    
    function flatten(component: Component) {
      // 创建一个不包含children数组的组件副本（因为children会通过parentId关联）
      const { children, ...componentCopy } = component;
      flattened.push(componentCopy);
      
      // 递归扁平化子组件
      if (children && children.length > 0) {
        children.forEach(child => flatten(child));
      }
    }
    
    components.forEach((child: Component) => flatten(child));
    return flattened;
  }
}