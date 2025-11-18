import * as vscode from 'vscode';
import * as path from 'path';
import { HmlParser, HmlDocument, Component } from './HmlParser';
import { HmlSerializer } from './HmlSerializer';

/**
 * HML控制器类，协调解析器和序列化器的工作
 */
export class HmlController {
    private readonly parser: HmlParser;
    private readonly serializer: HmlSerializer;
    private _currentDocument: HmlDocument | null = null;
    private _currentFilePath: string | null = null;
    private _documentVersion: number = 0;

    /**
     * 构造函数
     */
    constructor() {
        this.parser = new HmlParser();
        this.serializer = new HmlSerializer();
    }

    /**
     * 加载HML文件
     * @param filePath 文件路径
     * @returns 加载的HML文档对象
     */
    public async loadFile(filePath: string): Promise<HmlDocument> {
        try {
            // 解析文件内容
            const document = await this.parser.parseFromFile(filePath);
            
            // 检查并确保文档包含screen组件
            this._ensureScreenComponent(document);
            
            // 更新当前文档状态
            this._currentDocument = document;
            this._currentFilePath = filePath;
            this._documentVersion++;
            
            return document;
        } catch (error) {
            console.error('加载HML文件失败:', error);
            throw new Error(`加载HML文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 从字符串解析HML内容
     * @param content HML内容字符串
     * @returns 解析后的HML文档对象
     */
    public parseContent(content: string): HmlDocument {
        try {
            const document = this.parser.parse(content);
            
            // 更新当前文档状态
            this._currentDocument = document;
            this._documentVersion++;
            
            return document;
        } catch (error) {
            console.error('解析HML内容失败:', error);
            throw new Error(`解析HML内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 保存当前文档到文件
     * @param filePath 文件路径（可选，如果不提供则使用当前文件路径）
     * @returns 保存的文件路径
     */
    public async saveDocument(filePath?: string): Promise<string> {
        try {
            // 验证是否有文档可保存
            if (!this._currentDocument) {
                throw new Error('没有可保存的文档');
            }
            
            // 确定目标文件路径
            const targetPath = filePath || this._currentFilePath;
            if (!targetPath) {
                throw new Error('未指定保存路径');
            }
            
            // 保存文档
            await this.serializer.serializeToFile(this._currentDocument, targetPath);
            
            // 更新当前文件路径
            this._currentFilePath = targetPath;
            
            return targetPath;
        } catch (error) {
            console.error('保存HML文档失败:', error);
            throw new Error(`保存HML文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 将当前文档序列化为字符串
     * @returns 序列化后的HML字符串
     */
    public serializeDocument(): string {
        if (!this._currentDocument) {
            throw new Error('没有可序列化的文档');
        }
        
        return this.serializer.serialize(this._currentDocument);
    }

    /**
     * 创建新的HML文档
     * @param options 文档选项
     * @returns 新创建的HML文档对象
     */
    public createNewDocument(options: {
        projectName?: string;
        description?: string;
        version?: string;
        authorName?: string;
        authorEmail?: string;
    } = {}): HmlDocument {
        // 创建默认的HML文档结构
        const document: HmlDocument = {
            meta: {
                project: {
                    name: options.projectName || 'untitled',
                    description: options.description || 'HoneyGUI Project',
                    version: options.version || '1.0.0'
                },
                author: {
                    name: options.authorName || 'Anonymous',
                    email: options.authorEmail || ''
                }
            },
            view: {
                root: this._createDefaultRootComponent(),
                components: []
            }
        };
        
        // 更新当前文档状态
        this._currentDocument = document;
        this._currentFilePath = null; // 新建文档尚未保存，所以没有文件路径
        this._documentVersion++;
        
        // 生成组件列表
        document.view.components = this._flattenComponentTree(document.view.root);
        
        return document;
    }

    /**
     * 获取当前文档
     */
    public get currentDocument(): HmlDocument | null {
        return this._currentDocument;
    }

    /**
     * 获取当前文件路径
     */
    public get currentFilePath(): string | null {
        return this._currentFilePath;
    }

    /**
     * 获取当前文档版本号
     */
    public get documentVersion(): number {
        return this._documentVersion;
    }

    /**
     * 获取文档是否已修改
     */
    public get isModified(): boolean {
        // 在实际应用中，这里应该与文件系统中的版本进行比较
        // 这里简化处理，假设只要有版本变化就是已修改
        return this._documentVersion > 1;
    }

    /**
     * 更新文档元信息
     * @param meta 新的元信息
     */
    public updateMeta(meta: Partial<any>): void {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }
        
        // 合并元信息
        this._currentDocument.meta = { ...this._currentDocument.meta, ...meta };
        this._documentVersion++;
    }

    /**
     * 更新组件
     * @param componentId 组件ID
     * @param updates 更新内容
     */
    public updateComponent(componentId: string, updates: {
        type?: string;
        properties?: { [key: string]: any };
        events?: { [eventName: string]: string };
    }): Component | null {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }
        
        // 在组件树中查找组件
        const component = this._findComponentById(this._currentDocument.view.root, componentId);
        
        if (!component) {
            return null;
        }
        
        // 更新组件属性
        if (updates.type !== undefined) {
            component.type = updates.type;
        }
        
        if (updates.properties !== undefined) {
            component.properties = { ...component.properties, ...updates.properties };
        }
        
        if (updates.events !== undefined) {
            component.events = { ...component.events, ...updates.events };
        }
        
        // 更新文档版本
        this._documentVersion++;
        
        // 重新生成组件列表
        this._currentDocument.view.components = this._flattenComponentTree(this._currentDocument.view.root);
        
        return component;
    }

    /**
     * 添加组件
     * @param parentId 父组件ID
     * @param component 要添加的组件
     */
    public addComponent(parentId: string, component: Omit<Component, 'id'>): Component | null {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }
        
        // 在组件树中查找父组件
        const parent = this._findComponentById(this._currentDocument.view.root, parentId);
        
        if (!parent) {
            return null;
        }
        
        // 确保父组件有children数组
        if (!parent.children) {
            parent.children = [];
        }
        
        // 生成唯一ID
        const id = this._generateUniqueId(component.type);
        
        // 创建完整组件对象
        const newComponent: Component = {
            ...component,
            id,
            parentId
        };
        
        // 添加到父组件
        parent.children.push(newComponent);
        
        // 更新文档版本
        this._documentVersion++;
        
        // 重新生成组件列表
        this._currentDocument.view.components = this._flattenComponentTree(this._currentDocument.view.root);
        
        return newComponent;
    }

    /**
     * 删除组件
     * @param componentId 组件ID
     */
    public deleteComponent(componentId: string): boolean {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }
        
        // 如果要删除根组件，不允许操作
        if (componentId === this._currentDocument.view.root.id) {
            throw new Error('不能删除根组件');
        }
        
        // 查找并删除组件
        const success = this._deleteComponentFromTree(this._currentDocument.view.root, componentId);
        
        if (success) {
            // 更新文档版本
            this._documentVersion++;
            
            // 重新生成组件列表
            this._currentDocument.view.components = this._flattenComponentTree(this._currentDocument.view.root);
        }
        
        return success;
    }

    /**
     * 查找组件
     * @param componentId 组件ID
     */
    public findComponent(componentId: string): Component | null {
        if (!this._currentDocument) {
            return null;
        }
        
        return this._findComponentById(this._currentDocument.view.root, componentId);
    }

    /**
     * 创建默认的根组件
     */
    private _createDefaultRootComponent(): Component {
        return {
            id: 'main',
            type: 'div',
            properties: {
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                flexDirection: 'column'
            },
            children: [
                {
                    id: 'main_screen',
                    type: 'screen',
                    properties: {
                        id: 'main',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#f5f5f5',
                        flexDirection: 'column',
                        padding: 16
                    },
                    children: [
                        {
                            id: 'welcome',
                            type: 'text',
                            properties: {
                                text: '欢迎使用 HoneyGUI',
                                fontSize: 18,
                                color: '#333333',
                                marginTop: 20,
                                marginLeft: 20
                            }
                        },
                        {
                            id: 'subtitle',
                            type: 'text',
                            properties: {
                                text: '请开始设计您的界面',
                                fontSize: 14,
                                color: '#666666',
                                marginTop: 8,
                                marginLeft: 20
                            }
                        }
                    ]
                }
            ]
        };
    }

    /**
     * 递归查找组件
     */
    private _findComponentById(component: Component, id: string): Component | null {
        // 检查当前组件
        if (component.id === id) {
            return component;
        }
        
        // 检查子组件
        if (component.children) {
            for (const child of component.children) {
                const found = this._findComponentById(child, id);
                if (found) {
                    return found;
                }
            }
        }
        
        return null;
    }

    /**
     * 递归删除组件
     */
    private _deleteComponentFromTree(component: Component, id: string): boolean {
        if (!component.children) {
            return false;
        }
        
        // 查找子组件中的目标组件
        for (let i = 0; i < component.children.length; i++) {
            if (component.children[i].id === id) {
                // 找到目标组件，从父组件中删除
                component.children.splice(i, 1);
                return true;
            }
            
            // 递归搜索子组件
            if (this._deleteComponentFromTree(component.children[i], id)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 将组件树展平为数组
     */
    private _flattenComponentTree(root: Component): Component[] {
        const components: Component[] = [];
        
        const flatten = (component: Component) => {
            components.push(component);
            
            if (component.children) {
                component.children.forEach(child => flatten(child));
            }
        };
        
        flatten(root);
        return components;
    }

    /**
     * 生成唯一的组件ID
     */
    private _generateUniqueId(componentType: string): string {
        // 确保ID唯一
        let id = `${componentType.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // 如果有当前文档，检查ID是否已存在
        if (this._currentDocument) {
            let counter = 1;
            while (this._findComponentById(this._currentDocument.view.root, id)) {
                id = `${componentType.toLowerCase()}_${Date.now()}_${counter++}`;
            }
        }
        
        return id;
    }
    
    /**
     * 检查并确保文档包含screen组件
     * 如果没有screen组件，则将现有内容包装到screen组件中
     */
    private _ensureScreenComponent(document: HmlDocument): void {
        // 检查根组件的子组件中是否已经包含screen组件
        const root = document.view.root;
        let hasScreenComponent = false;
        
        if (root.children) {
            // 检查是否已经有screen类型的组件
            for (const child of root.children) {
                if (child.type === 'screen') {
                    hasScreenComponent = true;
                    break;
                }
            }
        }
        
        // 如果没有screen组件，则创建一个screen组件并将现有内容移到其中
        if (!hasScreenComponent) {
            // 保存现有的子组件
            const existingChildren = root.children || [];
            
            // 创建screen组件
            const screenComponent: Component = {
                id: 'main_screen',
                type: 'screen',
                properties: {
                    id: 'main',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f5f5f5',
                    flexDirection: 'column',
                    padding: 16
                },
                children: existingChildren
            };
            
            // 更新所有子组件的parentId为screen组件的ID
            for (const child of existingChildren) {
                child.parentId = screenComponent.id;
            }
            
            // 将screen组件设置为根组件的唯一子组件
            root.children = [screenComponent];
            
            // 重新生成组件列表
            document.view.components = this._flattenComponentTree(document.view.root);
        }
    }
}