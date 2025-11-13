import * as vscode from 'vscode';

/**
 * 设计器模型类，管理UI组件树和状态
 */
export class DesignerModel {
    private _components: Component[] = [];
    private _selectedComponent: Component | null = null;
    private _onChangeCallback: ((model: DesignerModel) => void) | null = null;
    
    /**
     * 获取所有组件
     */
    get components(): Component[] {
        return this._components;
    }
    
    /**
     * 获取选中的组件
     */
    get selectedComponent(): Component | null {
        return this._selectedComponent;
    }
    
    /**
     * 设置选中的组件
     */
    set selectedComponent(component: Component | null) {
        this._selectedComponent = component;
        this._notifyChange();
    }
    
    /**
     * 添加组件变更回调
     */
    set onChange(callback: (model: DesignerModel) => void) {
        this._onChangeCallback = callback;
    }
    
    /**
     * 添加组件
     */
    addComponent(component: Component): void {
        this._components.push(component);
        this._notifyChange();
    }
    
    /**
     * 删除组件
     */
    removeComponent(componentId: string): void {
        const index = this._components.findIndex(c => c.id === componentId);
        if (index !== -1) {
            this._components.splice(index, 1);
            if (this._selectedComponent?.id === componentId) {
                this._selectedComponent = null;
            }
            this._notifyChange();
        }
    }
    
    /**
     * 更新组件
     */
    updateComponent(updatedComponent: Component): void {
        const index = this._components.findIndex(c => c.id === updatedComponent.id);
        if (index !== -1) {
            this._components[index] = updatedComponent;
            if (this._selectedComponent?.id === updatedComponent.id) {
                this._selectedComponent = updatedComponent;
            }
            this._notifyChange();
        }
    }
    
    /**
     * 获取组件
     */
    getComponent(id: string): Component | undefined {
        return this._components.find(c => c.id === id);
    }
    
    /**
     * 清空所有组件
     */
    clear(): void {
        this._components = [];
        this._selectedComponent = null;
        this._notifyChange();
    }
    
    /**
     * 从HML内容加载模型
     */
    loadFromHml(hmlContent: string): void {
        // TODO: 实现HML解析逻辑
        // 这里先创建一个默认的窗口组件
        this.clear();
        const windowComponent: Component = {
            id: 'mainWindow',
            type: 'window',
            name: '主窗口',
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            properties: {},
            children: []
        };
        this.addComponent(windowComponent);
    }
    
    /**
     * 导出为HML内容
     */
    exportToHml(): string {
        // TODO: 实现HML生成逻辑
        return '<?xml version="1.0" encoding="UTF-8"?><hml><window id="mainWindow" width="800" height="600"></window></hml>';
    }
    
    /**
     * 通知模型变更
     */
    private _notifyChange(): void {
        if (this._onChangeCallback) {
            this._onChangeCallback(this);
        }
    }
}

/**
 * 组件接口定义
 */
export interface Component {
    id: string;
    type: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties: Record<string, any>;
    children: Component[];
}

/**
 * 支持的组件类型枚举
 */
export enum ComponentType {
    Window = 'window',
    Label = 'label',
    Button = 'button',
    Input = 'input',
    Checkbox = 'checkbox',
    Radio = 'radio',
    Select = 'select',
    Image = 'image',
    ProgressBar = 'progressBar',
    List = 'list',
    Panel = 'panel',
    VBox = 'vbox',
    HBox = 'hbox',
    Grid = 'grid'
}

/**
 * 组件工厂类，用于创建各种组件
 */
export class ComponentFactory {
    /**
     * 创建组件
     */
    static createComponent(type: ComponentType, idPrefix?: string): Component {
        const id = idPrefix ? `${idPrefix}_${Date.now()}` : `${type}_${Date.now()}`;
        
        const baseComponent: Component = {
            id,
            type: type.toString(),
            name: this.getComponentDisplayName(type),
            x: 100,
            y: 100,
            width: this.getDefaultWidth(type),
            height: this.getDefaultHeight(type),
            properties: {},
            children: []
        };
        
        // 设置特定组件的默认属性
        switch (type) {
            case ComponentType.Label:
                baseComponent.properties = { text: '标签文本' };
                break;
            case ComponentType.Button:
                baseComponent.properties = { text: '按钮', onClick: '' };
                break;
            case ComponentType.Input:
                baseComponent.properties = { text: '', placeholder: '请输入...' };
                break;
            case ComponentType.Window:
                baseComponent.x = 0;
                baseComponent.y = 0;
                baseComponent.width = 800;
                baseComponent.height = 600;
                break;
        }
        
        return baseComponent;
    }
    
    /**
     * 获取组件显示名称
     */
    private static getComponentDisplayName(type: ComponentType): string {
        const displayNames: Record<ComponentType, string> = {
            [ComponentType.Window]: '窗口',
            [ComponentType.Label]: '标签',
            [ComponentType.Button]: '按钮',
            [ComponentType.Input]: '输入框',
            [ComponentType.Checkbox]: '复选框',
            [ComponentType.Radio]: '单选框',
            [ComponentType.Select]: '下拉框',
            [ComponentType.Image]: '图片',
            [ComponentType.ProgressBar]: '进度条',
            [ComponentType.List]: '列表',
            [ComponentType.Panel]: '面板',
            [ComponentType.VBox]: '垂直布局',
            [ComponentType.HBox]: '水平布局',
            [ComponentType.Grid]: '网格布局'
        };
        
        return displayNames[type] || type.toString();
    }
    
    /**
     * 获取组件默认宽度
     */
    private static getDefaultWidth(type: ComponentType): number {
        const widths: Record<ComponentType, number> = {
            [ComponentType.Window]: 800,
            [ComponentType.Label]: 100,
            [ComponentType.Button]: 80,
            [ComponentType.Input]: 200,
            [ComponentType.Checkbox]: 20,
            [ComponentType.Radio]: 20,
            [ComponentType.Select]: 150,
            [ComponentType.Image]: 100,
            [ComponentType.ProgressBar]: 200,
            [ComponentType.List]: 300,
            [ComponentType.Panel]: 300,
            [ComponentType.VBox]: 300,
            [ComponentType.HBox]: 400,
            [ComponentType.Grid]: 400
        };
        
        return widths[type] || 100;
    }
    
    /**
     * 获取组件默认高度
     */
    private static getDefaultHeight(type: ComponentType): number {
        const heights: Record<ComponentType, number> = {
            [ComponentType.Window]: 600,
            [ComponentType.Label]: 30,
            [ComponentType.Button]: 30,
            [ComponentType.Input]: 30,
            [ComponentType.Checkbox]: 30,
            [ComponentType.Radio]: 30,
            [ComponentType.Select]: 30,
            [ComponentType.Image]: 100,
            [ComponentType.ProgressBar]: 20,
            [ComponentType.List]: 200,
            [ComponentType.Panel]: 200,
            [ComponentType.VBox]: 200,
            [ComponentType.HBox]: 100,
            [ComponentType.Grid]: 300
        };
        
        return heights[type] || 30;
    }
}