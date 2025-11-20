/**
 * Zustand Store for HoneyGUI Designer
 * 管理设计器的状态和逻辑
 */

import { create } from 'zustand';
import { Component, ComponentType, DesignerState, VSCodeAPI } from './types';
import { CommandManager, AddComponentCommand, DeleteComponentCommand, MoveComponentCommand, UpdatePropertyCommand } from './utils/undoRedo';

export interface DesignerStore extends DesignerState {
  // Actions
  setComponents: (components: Component[]) => void;
  addComponent: (component: Component) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  removeComponents: (ids: string[]) => void;
  selectComponent: (id: string | null) => void;
  setSelectedComponents: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  setHoveredComponent: (id: string | null) => void;
  setDraggedComponent: (id: string | null) => void;

  // Canvas operations
  setZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setGridSize: (size: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  setEditingMode: (mode: 'select' | 'move' | 'resize') => void;
  setCanvasBackgroundColor: (color: string) => void;

  // Drag and drop
  startDrag: (componentId: string, mousePos: { x: number; y: number }) => void;
  drag: (mousePos: { x: number; y: number }) => void;
  endDrag: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getUndoLabel: () => string | null;
  getRedoLabel: () => string | null;

  // VSCode communication
  vscodeAPI: VSCodeAPI | null;
  setVSCodeAPI: (api: VSCodeAPI) => void;
  saveToFile: () => void;
  generateCode: (language: 'cpp' | 'c') => void;

  // Component management
  duplicateComponent: (id: string) => void;
  moveComponent: (id: string, newParent: string | null) => void;
  reorderComponent: (id: string, newIndex: number) => void;

  // Selection
  getSelectedComponent: () => Component | undefined;
  getSelectedComponents: () => Component[];
  getComponentById: (id: string) => Component | undefined;

  // Project configuration
  setProjectConfig: (config: any) => void;
  initializeWithProjectConfig: (config: any) => void;
}

let vscodeAPI: VSCodeAPI | null = null;

// 创建默认screen容器
const createDefaultScreen = (resolution?: string): Component => {
  const generateSimpleId = (): string => `hg_screen_${Date.now()}`;
  const parseResolution = (res?: string) => {
    if (!res) return { width: 1024, height: 768 };
    const parts = res.split('X');
    return {
      width: parseInt(parts[0]) || 1024,
      height: parseInt(parts[1]) || 768
    };
  };
  const size = parseResolution(resolution);
  return {
    id: generateSimpleId(),
    type: 'hg_screen' as ComponentType,
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
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 0,
    children: [],
    parent: null
  };
};

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  // State
  components: [], // 初始化时不创建screen，等待projectConfig加载
  projectConfig: null as any, // 项目配置（分辨率等）
  selectedComponent: null,
  selectedComponents: [],
  hoveredComponent: null,
  draggedComponent: null,
  zoom: 1,
  gridSize: 8,
  snapToGrid: true,
  canvasOffset: { x: 0, y: 0 },
  canvasSize: { width: 1024, height: 768 }, // 默认画布尺寸
  canvasBackgroundColor: '#f0f0f0', // 默认画布背景色为灰色
  editingMode: 'select',
  undoStack: [],
  redoStack: [],
  vscodeAPI: null,

  // Actions
  setComponents: (components) => {
    set({ components });
  },

  addComponent: (component) => {
    set((state) => {
      const newComponents = [...state.components];
      
      // 如果组件有父组件引用，需要将其添加到父组件的children数组中
      if (component.parent && typeof component.parent === 'string') {
        const parentIndex = newComponents.findIndex(comp => comp.id === component.parent);
        
        if (parentIndex !== -1) {
          // 确保父组件有children数组
          if (!newComponents[parentIndex].children) {
            newComponents[parentIndex] = { ...newComponents[parentIndex], children: [] };
          }
          
          // 将当前组件的ID添加到父组件的children数组中
          if (newComponents[parentIndex]?.children && !newComponents[parentIndex].children.includes(component.id)) {
            newComponents[parentIndex].children.push(component.id);
          }
        }
      }
      
      // 添加新组件到components数组
      newComponents.push(component);
      
      return { components: newComponents };
    });
    get().saveToFile();
  },

  updateComponent: (id, updates) => {
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === id ? { ...comp, ...updates } : comp
      ),
    }));
    get().saveToFile();
  },

  removeComponent: (id) => {
    const state = get();
    const component = state.components.find((c) => c.id === id);
    if (!component) return;

    // 直接修改状态，不通过命令模式，避免无限递归
    set((state) => ({
      components: state.components.filter((c) => c.id !== id && c.parent !== id)
    }));
    if (vscodeAPI) {
      vscodeAPI.postMessage({ command: 'delete', content: { ids: [id], components: get().components } });
      vscodeAPI.postMessage({ command: 'notify', text: `删除控件: ${id}` });
    }
    get().saveToFile();
  },

  removeComponents: (ids) => {
    if (!ids || ids.length === 0) return;
    set((state) => ({
      components: state.components.filter((c) => !ids.includes(c.id) && !ids.includes(c.parent as any))
    }));
    if (vscodeAPI) {
      vscodeAPI.postMessage({ command: 'delete', content: { ids, components: get().components } });
      vscodeAPI.postMessage({ command: 'notify', text: `批量删除控件: ${ids.length} 个` });
    }
    get().saveToFile();
  },

  selectComponent: (id) => set({ selectedComponent: id, selectedComponents: id ? [id] : [] }),
  setSelectedComponents: (ids) => set({ selectedComponents: ids, selectedComponent: ids.length ? ids[0] : null }),
  addToSelection: (id) => {
    const current = get().selectedComponents;
    if (!current.includes(id)) set({ selectedComponents: [...current, id] });
  },
  removeFromSelection: (id) => {
    const current = get().selectedComponents;
    set({ selectedComponents: current.filter(i => i !== id) });
  },
  clearSelection: () => set({ selectedComponents: [], selectedComponent: null }),
  setHoveredComponent: (id) => set({ hoveredComponent: id }),
  setDraggedComponent: (id) => set({ draggedComponent: id }),

  // Canvas operations
  setZoom: (zoom) => set({ zoom }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  setGridSize: (size) => set({ gridSize: size }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setEditingMode: (mode) => set({ editingMode: mode }),
  setCanvasBackgroundColor: (color) => set({ canvasBackgroundColor: color }),

  // Drag and drop
  startDrag: (componentId, mousePos) => {
    set({ draggedComponent: componentId });
  },

  drag: (mousePos) => {
    const state = get();
    if (!state.draggedComponent) return;

    const component = state.components.find((c) => c.id === state.draggedComponent);
    if (!component) return;

    const x = state.snapToGrid
      ? Math.round((mousePos.x - state.canvasOffset.x) / state.gridSize) * state.gridSize
      : mousePos.x - state.canvasOffset.x;

    const y = state.snapToGrid
      ? Math.round((mousePos.y - state.canvasOffset.y) / state.gridSize) * state.gridSize
      : mousePos.y - state.canvasOffset.y;

    get().updateComponent(component.id, {
      position: { ...component.position, x, y },
    });
  },

  endDrag: () => {
    set({ draggedComponent: null });
  },

  // Undo/Redo
  undo: () => {
    commandManager.undo();
  },

  redo: () => {
    commandManager.redo();
  },

  canUndo: () => commandManager.canUndo(),
  canRedo: () => commandManager.canRedo(),
  getUndoLabel: () => commandManager.getUndoLabel(),
  getRedoLabel: () => commandManager.getRedoLabel(),

  // VSCode communication
  setVSCodeAPI: (api) => {
    vscodeAPI = api;
    set({ vscodeAPI: api });
  },

  saveToFile: () => {
    const state = get();
    if (!vscodeAPI) return;

    vscodeAPI.postMessage({
      command: 'save',
      content: {
        components: state.components,
      },
    });
  },

  generateCode: (language) => {
    const state = get();
    if (!vscodeAPI) return;

    vscodeAPI.postMessage({
      command: 'codegen',
      language,
      content: {
        components: state.components,
      },
    });
  },

  // Utility methods
  duplicateComponent: (id) => {
    const state = get();
    const component = state.components.find((c) => c.id === id);
    if (!component) return;

    const newComponent: Component = {
      ...component,
      id: `${component.id}_copy_${Date.now()}`,
      name: `${component.name}_copy`,
      position: {
        x: component.position.x + 20,
        y: component.position.y + 20,
        width: component.position.width,
        height: component.position.height,
      },
    };

    get().addComponent(newComponent);
  },

  moveComponent: (id, newParent) => {
    set((state) => {
      const component = state.components.find((c) => c.id === id);
      if (!component) return state;

      return {
        components: state.components.map((comp) => {
          if (comp.id === id) {
            return { ...comp, parent: newParent };
          }
          // Update parent's children
          if (comp.id === component.parent) {
            return {
              ...comp,
              children: comp.children?.filter((childId) => childId !== id),
            };
          }
          if (comp.id === newParent) {
            return {
              ...comp,
              children: [...(comp.children || []), id],
            };
          }
          return comp;
        }),
      };
    });
    get().saveToFile();
  },

  reorderComponent: (id, newIndex) => {
    // Implement reorder logic
    get().saveToFile();
  },

  getSelectedComponent: () => {
    const state = get();
    return state.components.find((c) => c.id === state.selectedComponent);
  },

  getSelectedComponents: () => {
    const state = get();
    return state.components.filter((c) => state.selectedComponents.includes(c.id));
  },

  getComponentById: (id) => {
    return get().components.find((c) => c.id === id);
  },

  // Project configuration
  setProjectConfig: (config) => {
    set({ projectConfig: config });
    const state = get();
    const hasScreen = state.components.some(c => c.type === 'hg_screen');
    if (!hasScreen) {
      const screen = createDefaultScreen(config?.resolution);
      set({ components: [screen, ...state.components] });
    }
  },

  // Initialize with project config
  initializeWithProjectConfig: (config) => {
    const resolution = config?.resolution;
    const current = get().components;
    let components = current;
    if (!current || current.length === 0) {
      components = resolution ? [createDefaultScreen(resolution)] : [createDefaultScreen()];
    } else if (!current.some(c => c.type === 'hg_screen')) {
      const screen = createDefaultScreen(resolution);
      components = [screen, ...current];
    }
    set({
      components,
      projectConfig: config,
      selectedComponent: null,
      hoveredComponent: null,
      draggedComponent: null,
      zoom: 1,
      gridSize: 8,
      snapToGrid: true,
      canvasOffset: { x: 0, y: 0 },
      canvasSize: { width: 1024, height: 768 },
      canvasBackgroundColor: '#f0f0f0',
      editingMode: 'select',
    });
  },
}));

// Helper function to snap to grid
export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

// Helper function to generate unique ID
export const generateId = (): string => {
  return `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Command manager instance
export const commandManager = new CommandManager(50);
