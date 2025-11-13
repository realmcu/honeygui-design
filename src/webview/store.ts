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

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  // State
  components: [],
  selectedComponent: null,
  hoveredComponent: null,
  draggedComponent: null,
  zoom: 1,
  gridSize: 8,
  snapToGrid: true,
  canvasOffset: { x: 0, y: 0 },
  editingMode: 'select',
  undoStack: [],
  redoStack: [],
  vscodeAPI: null,

  // Actions
  setComponents: (components) => {
    set({ components });
  },

  addComponent: (component) => {
    const command = new AddComponentCommand(component, get());
    commandManager.execute(command);
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

    const children = state.components.filter((c) => c.parent === id);
    const command = new DeleteComponentCommand(component, children, state);
    commandManager.execute(command);
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
