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
  selectComponent: (id: string | null) => void;
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
  getComponentById: (id: string) => Component | undefined;
}

let vscodeAPI: VSCodeAPI | null = null;

// 创建默认screen容器
const createDefaultScreen = (): Component => {
  // 内联简化版ID生成器，避免store初始化时的模块依赖问题
  const generateSimpleId = (): string => `screen_0`;

  return {
    id: generateSimpleId(),
    type: 'screen',
    name: 'Default Screen',
    position: {
      x: 50,
      y: 50,
      width: 1024,
      height: 768
    },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 0,
    children: [], // 子组件数组
    parent: null // 顶级容器
  };
};

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  // State
  components: [createDefaultScreen()], // 初始化时创建默认screen容器
  selectedComponent: null,
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
    get().saveToFile();
  },

  selectComponent: (id) => set({ selectedComponent: id }),
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

  getComponentById: (id) => {
    return get().components.find((c) => c.id === id);
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
