import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HmlDocument, Component, ComponentProperties } from './HmlParser';

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
     * @param document HML文档对象
     * @returns 序列化后的HML字符串
     */
    public serialize(document: HmlDocument): string {
        try {
            let hmlContent = '<?xml version="1.0" encoding="UTF-8"?>' + '\n';
            hmlContent += '<hml>' + '\n';
            
            // 序列化meta部分
            hmlContent += this._serializeMeta(document.meta);
            
            // 序列化view部分
            hmlContent += this._serializeView(document.view);
            
            hmlContent += '</hml>';
            
            return hmlContent;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`序列化HML内容失败: ${String(error)}`);
        }
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
    private _serializeView(view: { root: Component; components: Component[] }): string {
        let viewContent = '    <view>' + '\n';
        
        // 序列化组件树（从根组件开始）
        if (view && view.root) {
            viewContent += this._serializeComponent(view.root, 2);
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
        
        // 序列化常规属性
        if (component.properties) {
            Object.keys(component.properties).forEach(propName => {
                const value = component.properties![propName];
                attributesStr += ' ' + propName + '="' + this._escapeXmlValue(this._convertToString(value)) + '"';
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
            component.children.forEach(child => {
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