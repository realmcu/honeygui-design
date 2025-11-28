import * as fs from 'fs';
import * as path from 'path';
import { Document as HmlDocument, Component } from './types';
import { HmlParser } from './HmlParser';

/**
 * HML序列化器类
 * 按照方案一：只支持标准格式 <hml><meta>...</meta><view>...</view></hml>
 */
export class HmlSerializer {
    // 存储所有组件的ID到组件的映射，用于递归序列化时查找子组件
    private componentMap = new Map<string, Component>();

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

                // 1) 生成临时路径
                const dir = path.dirname(filePath);
                const base = path.basename(filePath);
                const tempPath = path.join(dir, `.${base}.tmp`);

                // 2) 写入临时文件
                fs.writeFileSync(tempPath, content, 'utf8');

                // 3) 完整性校验（解析检查）
                try {
                    const parser = new HmlParser();
                    const parsed = parser.parse(content);
                    if (!parsed || !parsed.view) {
                        throw new Error('序列化结果校验失败：view 结构缺失');
                    }
                } catch (verifyErr) {
                    // 校验失败，删除临时文件并报错
                    try { fs.unlinkSync(tempPath); } catch {}
                    throw verifyErr;
                }

                // 不创建 .bak 备份文件，直接进行原子替换

                // 5) 原子替换：重命名临时文件到目标文件（不生成额外备份文件）
                fs.renameSync(tempPath, filePath);

                // 6) 再次快速读取并校验（保障落盘内容）
                const written = fs.readFileSync(filePath, 'utf8');
                if (!written || written.length === 0) {
                    throw new Error('写入后文件为空');
                }

                resolve();
            } catch (error) {
                reject(new Error(`保存HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`));
            }
        });
    }

    /**
     * 将HML文档对象序列化为字符串
     * 只支持标准格式：<?xml version="1.0" encoding="UTF-8"?>
     *                <hml>
     *                    <meta>...</meta>
     *                    <view>...</view>
     *                </hml>
     *
     * @param document HML文档对象
     * @returns 序列化后的HML字符串
     */
    public serialize(document: HmlDocument): string {
        try {
            return this._serializeStandardFormat(document);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`序列化HML内容失败: ${String(error)}`);
        }
    }

    /**
     * 使用标准格式序列化（meta + view结构）
     * 这是唯一的序列化格式
     */
    private _serializeStandardFormat(document: HmlDocument): string {
        // 清空并重新填充组件映射表
        this.componentMap.clear();
        if (document.view.components) {
            document.view.components.forEach(comp => {
                this.componentMap.set(comp.id, comp);
            });
        }

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
     * 序列化meta对象
     * @param meta meta对象
     * @returns 序列化后的meta XML字符串
     */
    private _serializeMeta(meta: any): string {
        if (!meta || typeof meta !== 'object') {
            return '    <meta />' + '\n';
        }

        let metaContent = '    <meta>' + '\n';

        // 序列化project信息（如果有）
        if (meta.project) {
            metaContent += this._serializeElement('project', meta.project, 2);
        }

        // 序列化author信息（如果有）
        if (meta.author) {
            metaContent += this._serializeElement('author', meta.author, 2);
        }

        // 序列化其他顶层meta信息（排除已处理的project和author）
        const specialKeys = ['project', 'author', 'components', 'title', 'width', 'height'];
        Object.keys(meta).forEach(key => {
            if (!specialKeys.includes(key)) {
                const value = meta[key];
                if (value !== undefined && value !== null && value !== '') {
                    metaContent += this._serializeElement(key, value, 2);
                }
            }
        });

        metaContent += '    </meta>' + '\n';
        return metaContent;
    }

    /**
     * 序列化view对象
     * @param view view对象，包含components数组
     * @returns 序列化后的view XML字符串
     */
    private _serializeView(view: { components?: Component[] }): string {
        let viewContent = '    <view>' + '\n';

        // 序列化组件树（从顶层组件开始）
        if (view && view.components && view.components.length > 0) {
            // 找到顶层组件（没有parent的组件）
            const topLevelComponents = view.components.filter(comp => !comp.parent);
            topLevelComponents.forEach(component => {
                viewContent += this._serializeComponent(component, 2);
            });
        }

        viewContent += '    </view>' + '\n';
        return viewContent;
    }

    /**
     * 递归序列化组件对象 - 从新格式序列化
     * @param component 组件对象
     * @param indentLevel 缩进级别
     * @returns 序列化后的组件XML字符串
     */
    private _serializeComponent(component: Component, indentLevel: number): string {
        const indent = ' '.repeat(indentLevel * 4);
        let componentContent = '';

        // 构建组件的属性字符串
        let attributesStr = ' id="' + component.id + '"';

        // 序列化位置属性（position.x/y/width/height）
        if (component.position) {
            attributesStr += ' x="' + component.position.x + '"';
            attributesStr += ' y="' + component.position.y + '"';
            attributesStr += ' width="' + component.position.width + '"';
            attributesStr += ' height="' + component.position.height + '"';
        }

        // 序列化样式属性（style对象）
        if (component.style) {
            Object.keys(component.style).forEach(propName => {
                const value = component.style![propName];
                if (value !== undefined && value !== null && value !== '') {
                    attributesStr += ' ' + propName + '="' + this._escapeXmlValue(this._convertToString(value)) + '"';
                }
            });
        }

        // 序列化数据属性（data对象）
        if (component.data) {
            Object.keys(component.data).forEach(propName => {
                const value = component.data![propName];
                if (value !== undefined && value !== null && value !== '') {
                    attributesStr += ' ' + propName + '="' + this._escapeXmlValue(this._convertToString(value)) + '"';
                }
            });
        }

        // 序列化元属性（name, visible, enabled, locked, zIndex）
        if (component.name) {
            attributesStr += ' name="' + this._escapeXmlValue(component.name) + '"';
        }
        if (component.visible === false) {
            attributesStr += ' visible="false"';
        }
        if (component.enabled === false) {
            attributesStr += ' enabled="false"';
        }
        if (component.locked === true) {
            attributesStr += ' locked="true"';
        }
        if (component.zIndex && component.zIndex !== 0) {
            attributesStr += ' zIndex="' + component.zIndex + '"';
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

            // 递归序列化子组件 - 根据ID从componentMap中查找组件对象
            component.children.forEach(childId => {
                const childComponent = this.componentMap.get(childId);
                if (childComponent) {
                    componentContent += this._serializeComponent(childComponent, indentLevel + 1);
                }
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
            // 简单值（字符串、数字等）
            const value = this._convertToString(attributes);
            if (value) {
                return indent + '<' + tagName + '>' + this._escapeXmlValue(value) + '</' + tagName + '>' + '\n';
            }
            return indent + '<' + tagName + ' />' + '\n';
        }

        // 对象类型，构建属性字符串
        let attributesStr = '';
        Object.keys(attributes).forEach(attrName => {
            const attrValue = attributes[attrName];
            if (attrValue !== undefined && attrValue !== null && attrValue !== '') {
                attributesStr += ' ' + attrName + '="' + this._escapeXmlValue(this._convertToString(attrValue)) + '"';
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
}
