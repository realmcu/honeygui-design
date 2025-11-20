import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HmlParser } from './HmlParser';
import { Document as HmlDocument, Component } from './types';
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
            // 同步读取文件内容，避免 Promise 相关问题
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const document = this.parser.parse(fileContent);

            // 更新当前文档状态
            this._currentDocument = document;
            this._currentFilePath = filePath;
            this._documentVersion++;

            console.log(`Successfully loaded HML file: ${filePath}`);
            console.log(`Parsed ${document.view.components?.length || 0} components`);

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

            console.log('[HmlController] 当前文档组件数量:', this._currentDocument.view.components?.length || 0);

            // 确定目标文件路径
            const targetPath = filePath || this._currentFilePath;
            if (!targetPath) {
                throw new Error('未指定保存路径');
            }

            console.log('[HmlController] 保存路径:', targetPath);

            // 先序列化内容，打印出来看看
            const serialized = this.serializer.serialize(this._currentDocument);
            console.log('[HmlController] 序列化内容:', serialized);

            // 保存文档（格式已统一，无需转换）
            await this.serializer.serializeToFile(this._currentDocument, targetPath);

            // 更新当前文件路径
            this._currentFilePath = targetPath;

            console.log(`Successfully saved HML file: ${targetPath}`);

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
     * 使用前端组件列表更新当前文档（用于Webview状态同步）
     * 格式已统一，直接保存所有组件
     * @param frontendComponents 前端组件数组（包含所有组件，扁平化存储）
     */
    public updateFromFrontendComponents(frontendComponents: Component[]): void {
        if (!frontendComponents || !Array.isArray(frontendComponents)) {
            throw new Error('无效的前端组件数据');
        }
        if (!this._currentDocument) {
            this._currentDocument = { meta: {}, view: { components: [] } } as HmlDocument;
        }

        // 格式已统一，直接保存所有组件（扁平化存储，包含所有层级）
        // 注意：前端发送的是包含所有组件的扁平数组
        this._currentDocument.view.components = [...frontendComponents];
        this._documentVersion++;
    }

    /**
     * 创建新的HML文档（新格式）
     * @param options 文档选项
     * @returns 新创建的HML文档对象
     */
    public createNewDocument(options: {
        projectName?: string;
        description?: string;
        version?: string;
        authorName?: string;
        authorEmail?: string;
        resolution?: string;
    } = {}): HmlDocument {
        // 创建默认的screen组件（新格式）
        const resolution = options.resolution || '480X272';
        const size = this._parseResolution(resolution);

        const screenComponent: Component = {
            id: 'hg_screen_' + Date.now(),
            type: 'hg_screen',
            name: 'Screen',
            position: {
                x: 50,
                y: 50,
                width: size.width,
                height: size.height
            },
            style: {
                backgroundColor: '#000000'
            },
            data: {},
            events: undefined,
            children: [],
            parent: null,
            visible: true,
            enabled: true,
            locked: false,
            zIndex: 0
        };

        const document: HmlDocument = {
            meta: {
                project: {
                    name: options.projectName || 'untitled',
                    description: options.description || 'HoneyGUI Project',
                    version: options.version || '1.0.0',
                    resolution: resolution,
                    minSdk: 'API 2: Persim Wear V1.1.0',
                    pixelMode: 'ARGB8888'
                },
                author: {
                    name: options.authorName || 'Anonymous',
                    email: options.authorEmail || ''
                }
            },
            view: {
                components: [screenComponent]
            }
        };

        // 更新当前文档状态
        this._currentDocument = document;
        this._currentFilePath = null; // 新建文档尚未保存，所以没有文件路径
        this._documentVersion++;

        return document;
    }

    /**
     * 解析分辨率字符串
     * @private
     */
    private _parseResolution(resolution: string): { width: number; height: number } {
        if (!resolution) return { width: 480, height: 272 };
        const parts = resolution.split('X');
        return {
            width: parseInt(parts[0]) || 480,
            height: parseInt(parts[1]) || 272
        };
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
     * 更新组件（新格式）
     * @param componentId 组件ID
     * @param updates 更新内容
     */
    public updateComponent(componentId: string, updates: {
        type?: string;
        position?: { x?: number; y?: number; width?: number; height?: number };
        style?: { [key: string]: any };
        data?: { [key: string]: any };
        events?: { [eventName: string]: string };
        visible?: boolean;
        enabled?: boolean;
        locked?: boolean;
        zIndex?: number;
        children?: string[];
        parent?: string | null;
    }): Component | null {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }

        // 在扁平数组中查找组件
        const component = this._currentDocument.view.components?.find(c => c.id === componentId);
        if (!component) {
            return null;
        }

        // 更新组件属性
        if (updates.type !== undefined) {
            component.type = updates.type;
        }

        if (updates.position !== undefined) {
            component.position = { ...component.position, ...updates.position };
        }

        if (updates.style !== undefined) {
            component.style = { ...component.style, ...updates.style };
        }

        if (updates.data !== undefined) {
            component.data = { ...component.data, ...updates.data };
        }

        if (updates.events !== undefined) {
            component.events = { ...component.events, ...updates.events };
        }

        if (updates.visible !== undefined) {
            component.visible = updates.visible;
        }

        if (updates.enabled !== undefined) {
            component.enabled = updates.enabled;
        }

        if (updates.locked !== undefined) {
            component.locked = updates.locked;
        }

        if (updates.zIndex !== undefined) {
            component.zIndex = updates.zIndex;
        }

        if (updates.children !== undefined) {
            component.children = updates.children;
        }

        if (updates.parent !== undefined) {
            component.parent = updates.parent;
        }

        // 更新文档版本
        this._documentVersion++;

        return component;
    }

    /**
     * 添加组件（新格式）
     * @param component 要添加的完整组件（必须包含id）
     */
    public addComponent(component: Component): Component {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }

        // 直接添加到components数组（扁平存储）
        if (!this._currentDocument.view.components) {
            this._currentDocument.view.components = [];
        }
        this._currentDocument.view.components.push(component);

        // 如果组件有父组件，更新父组件的children数组
        if (component.parent) {
            const parent = this._currentDocument.view.components.find(c => c.id === component.parent);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                if (!parent.children.includes(component.id)) {
                    parent.children.push(component.id);
                }
            }
        }

        // 更新文档版本
        this._documentVersion++;

        return component;
    }

    /**
     * 删除组件（新格式）
     * @param componentId 组件ID
     */
    public deleteComponent(componentId: string): boolean {
        if (!this._currentDocument) {
            throw new Error('没有可更新的文档');
        }

        if (!this._currentDocument.view.components) {
            return false;
        }

        // 找到要删除的组件
        const componentIndex = this._currentDocument.view.components.findIndex(c => c.id === componentId);
        if (componentIndex === -1) {
            return false;
        }

        const component = this._currentDocument.view.components[componentIndex];

        // 更新父组件的children数组
        if (component.parent) {
            const parent = this._currentDocument.view.components.find(c => c.id === component.parent);
            if (parent && parent.children) {
                parent.children = parent.children.filter(id => id !== componentId);
            }
        }

        // 递归删除所有子组件
        if (component.children && component.children.length > 0) {
            const childIds = [...component.children]; // 复制一份，避免在遍历中修改
            childIds.forEach(childId => this.deleteComponent(childId));
        }

        // 从数组中删除组件
        this._currentDocument.view.components.splice(componentIndex, 1);

        // 更新文档版本
        this._documentVersion++;

        return true;
    }

    /**
     * 查找组件（新格式）
     * @param componentId 组件ID
     */
    public findComponent(componentId: string): Component | null {
        if (!this._currentDocument) {
            return null;
        }

        // 在扁平数组中查找
        const component = this._currentDocument.view.components?.find(c => c.id === componentId);
        return component || null;
    }

    /**
     * 更新_view中的components数组（确保包含所有组件）
     * 当添加新组件时调用
     */
    private _ensureAllComponentsInView(component: Component): void {
        if (!this._currentDocument?.view.components) {
            return;
        }

        // 如果组件不在数组中，添加它
        if (!this._currentDocument.view.components.find(c => c.id === component.id)) {
            this._currentDocument.view.components.push(component);
        }
    }

    /**
     * 生成唯一的组件ID
     */
    private _generateUniqueId(componentType: string): string {
        // 确保ID唯一
        let id = `${componentType.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 如果有当前文档，检查ID是否已存在
        if (this._currentDocument && this._currentDocument.view.components) {
            let counter = 1;
            while (this._currentDocument.view.components.find(c => c.id === id)) {
                id = `${componentType.toLowerCase()}_${Date.now()}_${counter++}`;
                counter++;
            }
        }

        return id;
    }
    

    /**
     * 为前端准备组件数据
     * 格式已统一，直接返回所有组件
     * @param document HML文档对象
     */
    public prepareComponentsForFrontend(document: HmlDocument): Component[] {
        // 格式已统一，直接返回所有组件
        return document.view.components || [];
    }

    /**
     * 已废弃：格式已统一，无需转换
     * @private
     */
    private _convertForSerialization(document: HmlDocument): HmlDocument {
        // 不再需要转换，直接返回原文档
        return document;
    }
}
