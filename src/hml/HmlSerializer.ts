import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Document as HmlDocument, Component, ComponentProperties } from './types';

/**
 * HML序列化器类
 */
export class HmlSerializer {
    /**
     * 将HML文档对象序列化为文件
     * @param document HML文档对象
     * @param filePath 目标文件路径
     * @returns Promise
     */
    public serializeToFile(document: HmlDocument, filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const content = this.serialize(document);
                fs.writeFileSync(filePath, content, 'utf8');
                resolve();
            } catch (error) {
                reject(new Error(`保存HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`));
            }
        });
    }

    /**
     * 将HML文档对象序列化为字符串
     * 支持两种格式：
     * 1. 原始格式（带有screen容器）：<hml id="..." width="..." height="..."><screen>...</screen></hml>
     * 2. 标准格式：<hml><meta>...</meta><view>...</view></hml>
     *
     * @param document HML文档对象
     * @returns 序列化后的HML字符串
     */
    public serialize(document: HmlDocument): string {
        try {
            // 检查是否包含screen格式的组件（原始格式）
            const hasScreenFormat = this._hasScreenFormat(document);

            if (hasScreenFormat) {
                // 使用原始screen格式序列化
                return this._serializeScreenFormat(document);
            } else {
                // 使用标准格式序列化
                return this._serializeStandardFormat(document);
            }
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`序列化HML内容失败: ${String(error)}`);
        }
    }

    /**
     * 检查文档是否使用screen格式（原始格式）
     */
    private _hasScreenFormat(document: HmlDocument): boolean {
        if (!document.view?.components) {
            return false;
        }

        // 检查是否有screen类型的组件
        const hasScreenComponent = document.view.components.some(comp => comp.type === 'screen');

        // 检查meta中是否有id、width、height属性（原始格式的特征）
        const hasMetaAttributes = !!(document.meta?.title || document.meta?.width || document.meta?.height);

        return hasScreenComponent || hasMetaAttributes;
    }

    /**
     * 使用标准格式序列化（meta + view结构）
     */
    private _serializeStandardFormat(document: HmlDocument): string {
        let hmlContent = '<?xml version="1.0" encoding="UTF-8"?>' + '\n';
        hmlContent += '<hml>' + '\n';

        // 序列化meta部分
        hmlContent += this._serializeMeta(document.meta);

        // 序列化view部分
        hmlContent += this._serializeView(document.view);

        hmlContent += '</hml>';

        return hmlContent;
    }

    /**
     * 使用screen格式序列化（原始格式）
     */
    private _serializeScreenFormat(document: HmlDocument): string {
        let hmlContent = '';

        // 获取注释信息（项目配置信息）
        const comments = this._extractComments(document.meta);
        if (comments) {
            hmlContent += comments + '\n';
        }

        // 序列化<hml>根标签及其属性
        const hmlAttributes = this._serializeHmlAttributes(document.meta);
        hmlContent += `<hml${hmlAttributes}>` + '\n';

        // 查找并序列化screen组件及其子组件
        const screenComponent = this._findScreenComponent(document);
        if (screenComponent) {
            hmlContent += this._serializeComponent(screenComponent, 1);
        } else {
            // 如果没有screen组件，序列化所有顶层组件
            const topLevelComponents = document.view.components?.filter(comp => !comp.parentId) || [];
            topLevelComponents.forEach(component => {
                hmlContent += this._serializeComponent(component, 1);
            });
        }

        hmlContent += '</hml>';

        return hmlContent;
    }

    /**
     * 提取注释信息（项目配置信息）
     */
    private _extractComments(meta: any): string {
        if (!meta) return '';

        const lines: string[] = [];

        // 项目名称
        if (meta.title) {
            lines.push(`${meta.title} UI definition`);
        }

        // APP ID
        if (meta.appId) {
            lines.push(`APP ID: ${meta.appId}`);
        }

        // 分辨率
        if (meta.width && meta.height) {
            lines.push(`Resolution: ${meta.width}X${meta.height}`);
        } else if (meta.resolution) {
            lines.push(`Resolution: ${meta.resolution}`);
        }

        // 最小SDK
        if (meta.minSdk) {
            lines.push(`Min SDK: ${meta.minSdk}`);
        }

        // 像素模式
        if (meta.pixelMode) {
            lines.push(`Pixel Mode: ${meta.pixelMode}`);
        }

        if (lines.length === 0) return '';

        return lines.map(line => `<!-- ${line} -->`).join('\n');
    }

    /**
     * 序列化<hml>标签的属性
     */
    private _serializeHmlAttributes(meta: any): string {
        const attrs: string[] = [];

        if (!meta) return '';

        // id 属性
        if (meta.id || meta.title) {
            attrs.push(`id="${meta.id || meta.title}"`);
        }

        // width 属性
        if (meta.width) {
            attrs.push(`width="${meta.width}"`);
        }

        // height 属性
        if (meta.height) {
            attrs.push(`height="${meta.height}"`);
        }

        return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    }

    /**
     * 查找screen组件
     */
    private _findScreenComponent(document: HmlDocument): any {
        if (!document.view?.components) {
            return null;
        }

        // 查找screen类型的组件
        return document.view.components.find(comp => comp.type === 'screen');
    }

    /**
     * 序列化meta对象
     * @param meta meta对象
     * @returns 序列化后的meta XML字符串
     */
    private _serializeMeta(meta: any): string {
        let metaContent = '    <meta>' + '\n';
        
        // 序列化project信息
        if (meta && meta.project) {
            metaContent += this._serializeElement('project', meta.project, 2);
        }
        
        // 序列化author信息
        if (meta && meta.author) {
            metaContent += this._serializeElement('author', meta.author, 2);
        }
        
        // 序列化其他meta信息
        if (meta) {
            Object.keys(meta).forEach(key => {
                if (key !== 'project' && key !== 'author') {
                    metaContent += this._serializeElement(key, meta[key], 2);
                }
            });
        }
        
        metaContent += '    </meta>' + '\n';
        return metaContent;
    }

    /**
     * 序列化view对象
     * @param view view对象，包含root组件和components数组
     * @returns 序列化后的view XML字符串
     */
    private _serializeView(view: { components?: Component[] }): string {
        let viewContent = '    <view>' + '\n';
        
        // 序列化组件树（从顶层组件开始）
        if (view && view.components && view.components.length > 0) {
            // 找到顶层组件（没有parentId的组件）
            const topLevelComponents = view.components.filter(comp => !comp.parentId);
            topLevelComponents.forEach(component => {
                viewContent += this._serializeComponent(component, 2);
            });
        }
        
        viewContent += '    </view>' + '\n';
        return viewContent;
    }

    /**
     * 递归序列化组件对象
     * @param component 组件对象
     * @param indentLevel 缩进级别
     * @returns 序列化后的组件XML字符串
     */
    private _serializeComponent(component: Component, indentLevel: number): string {
        const indent = ' '.repeat(indentLevel * 4);
        let componentContent = '';

        // 构建组件的属性字符串
        let attributesStr = ' id="' + component.id + '"';

        // 序列化位置属性（x, y, width, height）
        if (component.x !== undefined && component.x !== null) {
            attributesStr += ' x="' + component.x + '"';
        }
        if (component.y !== undefined && component.y !== null) {
            attributesStr += ' y="' + component.y + '"';
        }
        if (component.width !== undefined && component.width !== null) {
            attributesStr += ' width="' + component.width + '"';
        }
        if (component.height !== undefined && component.height !== null) {
            attributesStr += ' height="' + component.height + '"';
        }

        // 序列化其他属性
        if (component.properties) {
            Object.keys(component.properties).forEach(propName => {
                const value = component.properties![propName];
                // 跳过已经序列化的属性
                if (!['x', 'y', 'width', 'height', 'id'].includes(propName)) {
                    attributesStr += ' ' + propName + '="' + this._escapeXmlValue(this._convertToString(value)) + '"';
                }
            });
        }

        // 序列化事件处理
        if (component.events) {
            Object.keys(component.events).forEach(eventName => {
                const handler = component.events![eventName];
                attributesStr += ' on:' + eventName + '="' + this._escapeXmlValue(handler) + '"';
            });
        }

        // 检查是否有子组件
        if (component.children && component.children.length > 0) {
            // 有子组件，使用开始和结束标签
            componentContent += indent + '<' + component.type + attributesStr + '>' + '\n';

            // 递归序列化子组件
            component.children.forEach((child: Component) => {
                componentContent += this._serializeComponent(child, indentLevel + 1);
            });

            componentContent += indent + '</' + component.type + '>' + '\n';
        } else {
            // 没有子组件，使用自闭合标签
            componentContent += indent + '<' + component.type + attributesStr + ' />' + '\n';
        }

        return componentContent;
    }

    /**
     * 序列化单个元素
     * @param tagName 标签名
     * @param attributes 属性对象
     * @param indentLevel 缩进级别
     * @returns 序列化后的元素XML字符串
     */
    private _serializeElement(tagName: string, attributes: any, indentLevel: number): string {
        const indent = ' '.repeat(indentLevel * 4);
        
        if (!attributes || typeof attributes !== 'object') {
            return indent + '<' + tagName + ' />' + '\n';
        }
        
        let attributesStr = '';
        Object.keys(attributes).forEach(attrName => {
            if (attributes[attrName] !== undefined && attributes[attrName] !== null) {
                attributesStr += ' ' + attrName + '="' + this._escapeXmlValue(this._convertToString(attributes[attrName])) + '"';
            }
        });
        
        return indent + '<' + tagName + attributesStr + ' />' + '\n';
    }

    /**
     * 将JavaScript值转换为字符串
     * @param value JavaScript值
     * @returns 转换后的字符串
     */
    private _convertToString(value: any): string {
        if (value === undefined || value === null) {
            return '';
        }
        
        if (typeof value === 'object') {
            // 对于对象和数组，使用JSON字符串表示
            return JSON.stringify(value);
        }
        
        return String(value);
    }

    /**
     * 转义XML特殊字符
     * @param value 需要转义的字符串
     * @returns 转义后的字符串
     */
    private _escapeXmlValue(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 格式化XML字符串（美化输出）
     * @param xml XML字符串
     * @returns 格式化后的XML字符串
     */
    public formatXml(xml: string): string {
        // 简单的XML格式化实现
        let formatted = '';
        let indent = 0;
        let inComment = false;
        let inCdata = false;
        let lastChar = '';
        
        for (let i = 0; i < xml.length; i++) {
            const char = xml.charAt(i);
            const nextChar = i < xml.length - 1 ? xml.charAt(i + 1) : '';
            
            // 检查是否在注释中
            if (lastChar === '-' && char === '-') {
                inComment = true;
            } else if (lastChar === '-' && char === '>' && inComment) {
                inComment = false;
            }
            
            // 检查是否在CDATA中
            if (lastChar === ']' && char === ']' && nextChar === '>') {
                inCdata = false;
                i += 2;
                formatted += ']]>';
                continue;
            } else if (char === '<' && nextChar === '!' && xml.substring(i + 2, i + 9) === '[CDATA[') {
                inCdata = true;
                formatted += '<![CDATA[';
                i += 8;
                continue;
            }
            
            // 如果在注释或CDATA中，直接添加字符
            if (inComment || inCdata) {
                formatted += char;
                lastChar = char;
                continue;
            }
            
            // 处理标签结束
            if (char === '>' && lastChar !== '/') {
                if (xml.charAt(i - 1) === '/') {
                    formatted += '>\n';
                } else {
                    const currentIndent = ' '.repeat(indent * 4);
                    formatted += '>\n';
                    
                    // 检查下一个标签是否是结束标签
                    const nextStartTagPos = xml.indexOf('<', i);
                    if (nextStartTagPos > 0 && xml.charAt(nextStartTagPos + 1) === '/') {
                        // 没有子内容
                    } else {
                        indent++;
                    }
                }
            } 
            // 处理开始标签
            else if (char === '<' && nextChar !== '/' && nextChar !== '!') {
                const currentIndent = ' '.repeat(indent * 4);
                formatted += currentIndent + '<';
            } 
            // 处理结束标签
            else if (char === '<' && nextChar === '/') {
                indent = Math.max(0, indent - 1);
                const currentIndent = ' '.repeat(indent * 4);
                formatted += currentIndent + '<';
            } 
            // 其他情况直接添加字符
            else {
                formatted += char;
            }
            
            lastChar = char;
        }
        
        return formatted;
    }
}