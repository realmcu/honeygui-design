/**
 * Zustand Store for HoneyGUI Designer
 * 管理设计器的状态和逻辑
 */

import { create } from 'zustand';
import { Component, ComponentType, DesignerState, VSCodeAPI } from './types';

export interface DesignerStore extends DesignerState {
  // Actions
  setComponents: (components: Component[]) => void;
  addComponent: (component: Component, options?: { save?: boolean }) => void;
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

// 解析分辨率字符串
const parseResolutionStr = (res?: string): { width: number; height: number } => {
  if (!res) return { width: 800, height: 480 };
  const parts = res.split('X');
  return {
    width: parseInt(parts[0]) || 800,
    height: parseInt(parts[1]) || 480,
  };
};

// 创建默认hg_screen容器
const createDefaultScreen = (resolution?: string): Component => {
  const generateSimpleId = (): string => `hg_screen_${Date.now()}`;
  const size = parseResolutionStr(resolution);
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
  components: [], // 初始化时不创建hg_screen，等待projectConfig加载
  projectConfig: null as any, // 项目配置（分辨率等）
  selectedComponent: null,
  selectedComponents: [],
  hoveredComponent: null,
  draggedComponent: null,
  zoom: 1,
  gridSize: 8,
  snapToGrid: true,
  canvasOffset: { x: 0, y: 0 },
  canvasSize: { width: 800, height: 480 }, // 默认画布尺寸
  canvasBackgroundColor: '#f0f0f0', // 默认画布背景色为灰色
  editingMode: 'select',
  undoStack: [],
  redoStack: [],
  vscodeAPI: null,

  // Actions
  setComponents: (components) => {
    set({ components });
  },

  addComponent: (component, options?: { save?: boolean }) => {
    const shouldSave = options?.save !== false; // 默认为true
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
    // 根据选项决定是否保存
    if (shouldSave) {
      get().saveToFile();
    }
  },

  updateComponent: (id, updates) => {
    const state = get();
    const before = state.components.find(c => c.id === id);
    if (!before) return;
    
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
    // TODO: 实现撤销功能
    console.log('撤销功能待实现');
  },

  redo: () => {
    // TODO: 实现重做功能
    console.log('重做功能待实现');
  },

  canUndo: () => false,
  canRedo: () => false,
  getUndoLabel: () => null,
  getRedoLabel: () => null,

  // VSCode communication
  setVSCodeAPI: (api) => {
    vscodeAPI = api;
    set({ vscodeAPI: api });
  },

  saveToFile: () => {
    const state = get();
    if (!vscodeAPI) return;

    console.log('[Webview Store] 准备保存到文件');
    console.log('[Webview Store] 当前组件数量:', state.components.length);
    console.log('[Webview Store] 当前组件详情:',
      state.components.map((c: any) =>
        `${c.type}(id=${c.id})`).join(', '));

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
    set({ projectConfig: config, canvasSize: parseResolutionStr(config?.resolution) });
    // 不再自动创建默认hg_screen，信任从后端加载的数据
    // 如果确实需要hg_screen，后端会在loadHml时提供
  },

  // Initialize with project config
  initializeWithProjectConfig: (config) => {
    // 信任从后端加载的组件数据，不再自动创建默认hg_screen
    // 后端会在loadHml时提供正确的组件树
    set({
      projectConfig: config,
      selectedComponent: null,
      hoveredComponent: null,
      draggedComponent: null,
      zoom: 1,
      gridSize: 8,
      snapToGrid: true,
      canvasOffset: { x: 0, y: 0 },
      canvasSize: parseResolutionStr(config?.resolution),
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
