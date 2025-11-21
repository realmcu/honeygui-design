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
        this.clear();
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
 * 组件工厂类，用于创建各种组件
 */
export class ComponentFactory {
    /**
     * 创建组件
     */
    static createComponent(type: string, idPrefix?: string, resolution?: string): Component {
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
        
        return baseComponent;
    }
    
    /**
     * 获取组件显示名称
     */
    private static getComponentDisplayName(type: string): string {
        return type;
    }
    
    /**
     * 获取组件默认宽度
     */
    private static getDefaultWidth(type: string, resolution?: string): number {
        return 100;
    }
    
    /**
     * 获取组件默认高度
     */
    private static getDefaultHeight(type: string, resolution?: string): number {
        return 100;
    }
    
    private static getScaleFactorByResolution(resolution?: string): number {
        return 1;
    }
    
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