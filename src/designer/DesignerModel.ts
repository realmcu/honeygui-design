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
     * @param component 要添加的组件
     * @param parentId 父组件ID（可选，不提供则添加到根级别）
     */
    addComponent(component: Component, parentId?: string): void {
        if (parentId) {
            // 添加到指定父组件
            const parent = this._findComponentRecursive(parentId, this._components);
            if (parent) {
                parent.children.push(component);
                this._notifyChange();
                return;
            }
        }
        // 添加到根级别
        this._components.push(component);
        this._notifyChange();
    }
    
    /**
     * 删除组件
     */
    removeComponent(componentId: string): void {
        // 尝试在根级别删除
        const rootIndex = this._components.findIndex(c => c.id === componentId);
        if (rootIndex !== -1) {
            this._components.splice(rootIndex, 1);
            if (this._selectedComponent?.id === componentId) {
                this._selectedComponent = null;
            }
            this._notifyChange();
            return;
        }
        
        // 在所有组件的子组件中递归查找并删除
        if (this._removeComponentRecursive(componentId, this._components)) {
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
        // 尝试在根级别更新
        const rootIndex = this._components.findIndex(c => c.id === updatedComponent.id);
        if (rootIndex !== -1) {
            this._components[rootIndex] = updatedComponent;
            if (this._selectedComponent?.id === updatedComponent.id) {
                this._selectedComponent = updatedComponent;
            }
            this._notifyChange();
            return;
        }
        
        // 在所有组件的子组件中递归查找并更新
        if (this._updateComponentRecursive(updatedComponent, this._components)) {
            if (this._selectedComponent?.id === updatedComponent.id) {
                this._selectedComponent = updatedComponent;
            }
            this._notifyChange();
        }
    }
    
    /**
     * 递归查找组件
     */
    private _findComponentRecursive(componentId: string, components: Component[]): Component | null {
        for (const component of components) {
            if (component.id === componentId) {
                return component;
            }
            
            if (component.children && component.children.length > 0) {
                const found = this._findComponentRecursive(componentId, component.children);
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
    private _removeComponentRecursive(componentId: string, components: Component[]): boolean {
        for (let i = 0; i < components.length; i++) {
            if (components[i].children && components[i].children.length > 0) {
                const childIndex = components[i].children.findIndex(c => c.id === componentId);
                if (childIndex !== -1) {
                    components[i].children.splice(childIndex, 1);
                    return true;
                }
                
                // 继续在孙组件中查找
                if (this._removeComponentRecursive(componentId, components[i].children)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * 递归更新组件
     */
    private _updateComponentRecursive(updatedComponent: Component, components: Component[]): boolean {
        for (const component of components) {
            if (component.children && component.children.length > 0) {
                const childIndex = component.children.findIndex(c => c.id === updatedComponent.id);
                if (childIndex !== -1) {
                    component.children[childIndex] = updatedComponent;
                    return true;
                }
                
                // 继续在孙组件中查找
                if (this._updateComponentRecursive(updatedComponent, component.children)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * 获取组件（支持递归查找）
     */
    getComponent(id: string): Component | undefined {
        // 先在根级别查找
        const rootComponent = this._components.find(c => c.id === id);
        if (rootComponent) {
            return rootComponent;
        }
        
        // 在所有组件的子组件中递归查找
        const found = this._findComponentRecursive(id, this._components);
        return found || undefined;
    }
    
    /**
     * 获取指定父组件下的所有子组件
     */
    getChildComponents(parentId?: string): Component[] {
        if (!parentId) {
            return this._components;
        }
        
        const parent = this.getComponent(parentId);
        return parent ? parent.children : [];
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
     * 获取组件的完整路径（包含所有父组件ID）
     */
    getComponentPath(componentId: string): string[] {
        const path: string[] = [];
        this._findComponentPath(componentId, this._components, path);
        return path;
    }
    
    /**
     * 递归查找组件路径
     */
    private _findComponentPath(componentId: string, components: Component[], path: string[]): boolean {
        for (const component of components) {
            // 检查当前组件是否是目标组件
            if (component.id === componentId) {
                path.push(component.id);
                return true;
            }
            
            // 检查子组件
            if (component.children && component.children.length > 0) {
                path.push(component.id);
                const found = this._findComponentPath(componentId, component.children, path);
                if (found) {
                    return true;
                }
                path.pop(); // 回溯
            }
        }
        return false;
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
    static createComponent(type: ComponentType, idPrefix?: string, resolution?: string): Component {
        const id = idPrefix ? `${idPrefix}_${Date.now()}` : `${type}_${Date.now()}`;
        
        const baseComponent: Component = {
            id,
            type: type.toString(),
            name: this.getComponentDisplayName(type),
            x: 100,
            y: 100,
            width: this.getDefaultWidth(type, resolution),
            height: this.getDefaultHeight(type, resolution),
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
                // 根据分辨率设置窗口默认大小
                const windowSize = this.getWindowSizeByResolution(resolution);
                baseComponent.width = windowSize.width;
                baseComponent.height = windowSize.height;
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
    private static getDefaultWidth(type: ComponentType, resolution?: string): number {
        const baseWidths: Record<ComponentType, number> = {
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
        
        const scaleFactor = this.getScaleFactorByResolution(resolution);
        
        // 窗口组件的宽度由getWindowSizeByResolution专门处理
        if (type === ComponentType.Window) {
            return baseWidths[type];
        }
        
        // 对其他组件应用缩放因子
        return Math.round(baseWidths[type] * scaleFactor);
    }
    
    /**
     * 获取组件默认高度
     */
    private static getDefaultHeight(type: ComponentType, resolution?: string): number {
        const baseHeights: Record<ComponentType, number> = {
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
        
        const scaleFactor = this.getScaleFactorByResolution(resolution);
        
        // 窗口组件的高度由getWindowSizeByResolution专门处理
        if (type === ComponentType.Window) {
            return baseHeights[type];
        }
        
        // 对其他组件应用缩放因子
        return Math.round(baseHeights[type] * scaleFactor);
    }
    
    /**
     * 根据分辨率获取缩放因子
     */
    private static getScaleFactorByResolution(resolution?: string): number {
        // 默认分辨率为800x480，缩放因子为1.0
        if (!resolution) {
            return 1.0;
        }
        
        // 根据不同分辨率设置不同的缩放因子
        switch (resolution) {
            case '480X272':
                return 0.6; // 较小的分辨率，组件尺寸缩小
            case '800X480':
                return 1.0; // 基准分辨率
            case '1024X600':
                return 1.2; // 较大的分辨率，组件尺寸适当放大
            case '1280X720':
                return 1.5; // 高分辨率，组件尺寸放大更多
            default:
                return 1.0;
        }
    }
    
    /**
     * 根据分辨率获取窗口默认大小
     */
    private static getWindowSizeByResolution(resolution?: string): { width: number; height: number } {
        if (!resolution) {
            return { width: 800, height: 480 }; // 默认分辨率
        }
        
        // 根据分辨率字符串解析宽高
        const parts = resolution.split('X');
        if (parts.length === 2) {
            const width = parseInt(parts[0], 10);
            const height = parseInt(parts[1], 10);
            
            if (!isNaN(width) && !isNaN(height)) {
                return { width, height };
            }
        }
        
        // 如果解析失败，返回默认值
        return { width: 800, height: 480 };
    }
}