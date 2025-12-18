/**
 * Zustand Store for HoneyGUI Designer
 * 管理设计器的状态和逻辑
 */

import { create } from 'zustand';
import { Component, ComponentType, DesignerState, VSCodeAPI } from './types';

// ============ 层级调整辅助函数 ============

type LayerDirection = 'up' | 'down' | 'top' | 'bottom';

/**
 * 计算组件在同级中的新索引
 */
function calculateNewIndex(currentIndex: number, direction: LayerDirection, maxIndex: number): number {
  switch (direction) {
    case 'up':    return Math.min(currentIndex + 1, maxIndex);
    case 'down':  return Math.max(currentIndex - 1, 0);
    case 'top':   return maxIndex;
    case 'bottom': return 0;
  }
}

/**
 * 重新排列数组中的元素
 */
function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

/**
 * 重建 components 数组，应用新的同级组件顺序
 */
function rebuildComponentsArray(
  components: Component[],
  reorderedSiblings: Component[],
  parentId: string | null | undefined
): Component[] {
  const siblingIds = new Set(reorderedSiblings.map(s => s.id));
  const newChildrenOrder = reorderedSiblings.map(s => s.id);
  const result: Component[] = [];
  let siblingsInserted = false;

  for (const comp of components) {
    if (siblingIds.has(comp.id)) {
      // 遇到第一个同级组件时，插入所有重排后的同级组件
      if (!siblingsInserted) {
        result.push(...reorderedSiblings);
        siblingsInserted = true;
      }
      // 跳过原来的同级组件（已在上面插入）
    } else if (parentId && comp.id === parentId) {
      // 更新父组件的 children 数组顺序
      result.push({ ...comp, children: newChildrenOrder });
    } else {
      result.push(comp);
    }
  }

  return result;
}

// ============ Store 定义 ============

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
  setEditingMode: (mode: 'select' | 'move' | 'resize') => void;
  setCanvasBackgroundColor: (color: string) => void;
  
  // View connections
  showViewConnections: boolean;
  setShowViewConnections: (show: boolean) => void;
  showViewRelationModal: boolean;
  setShowViewRelationModal: (show: boolean) => void;

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

  // Component management
  duplicateComponent: (id: string) => void;
  moveComponent: (id: string, newParent: string | null) => void;
  reorderComponent: (id: string, newIndex: number) => void;
  moveComponentLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;

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

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  // State
  components: [],
  projectConfig: null as any, // 项目配置（分辨率等）
  allViews: [] as Array<{id: string, name: string, file: string}>, // 项目中所有 view
  allHmlFiles: [] as Array<{path: string, name: string, relativePath: string}>, // 项目中所有 HML 文件
  currentFilePath: '' as string, // 当前打开的文件路径
  selectedComponent: null,
  selectedComponents: [],
  hoveredComponent: null,
  draggedComponent: null,
  zoom: 1,
  canvasOffset: { x: 0, y: 0 },
  canvasSize: { width: 800, height: 480 }, // 默认画布尺寸
  canvasBackgroundColor: '#3c3c3c', // 默认画布背景色为深灰色
  editingMode: 'select',
  showViewConnections: true, // 默认显示视图连接
  showViewRelationModal: false,
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

    // 禁止删除默认主视图 mainView
    if (id === 'mainView') {
      if (vscodeAPI) {
        vscodeAPI.postMessage({ command: 'notify', text: '主视图 mainView 不可删除' });
      }
      return;
    }

    // 统计清理的引用数量
    let cleanedCount = 0;
    if (component.type === 'hg_view') {
      state.components.forEach(c => {
        if (c.eventConfigs) {
          c.eventConfigs.forEach(eventConfig => {
            eventConfig.actions.forEach(action => {
              if (action.type === 'switchView' && action.target === id) {
                cleanedCount++;
              }
            });
          });
        }
      });
    }

    set((state) => ({
      components: state.components
        .filter((c) => c.id !== id && c.parent !== id)
        .map(c => {
          // 清理 eventConfigs 中的 switchView 引用
          if (c.eventConfigs && component.type === 'hg_view') {
            const newEventConfigs = c.eventConfigs.map(eventConfig => ({
              ...eventConfig,
              actions: eventConfig.actions.filter(action => 
                !(action.type === 'switchView' && action.target === id)
              )
            })).filter(eventConfig => eventConfig.actions.length > 0);
            
            return {
              ...c,
              eventConfigs: newEventConfigs.length > 0 ? newEventConfigs : undefined
            };
          }
          return c;
        })
    }));
    
    if (vscodeAPI) {
      vscodeAPI.postMessage({ command: 'delete', content: { ids: [id], components: get().components } });
      let message = `删除控件: ${id}`;
      if (cleanedCount > 0) {
        message += `，已清理 ${cleanedCount} 个视图切换引用`;
      }
      vscodeAPI.postMessage({ command: 'notify', text: message });
    }
    get().saveToFile();
  },

  removeComponents: (ids) => {
    if (!ids || ids.length === 0) return;
    
    // 过滤掉 mainView，不允许删除
    const state = get();
    const filteredIds = ids.filter(id => id !== 'mainView');
    
    if (filteredIds.length === 0) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({ command: 'notify', text: '主视图 mainView 不可删除' });
      }
      return;
    }
    
    // 统计清理的引用数量
    let cleanedCount = 0;
    const deletedViews = state.components.filter(c => filteredIds.includes(c.id) && c.type === 'hg_view');
    const deletedViewIds = deletedViews.map(v => v.id);
    
    if (deletedViews.length > 0) {
      state.components.forEach(c => {
        if (c.eventConfigs) {
          c.eventConfigs.forEach(eventConfig => {
            eventConfig.actions.forEach(action => {
              if (action.type === 'switchView' && action.target && deletedViewIds.includes(action.target)) {
                cleanedCount++;
              }
            });
          });
        }
      });
    }
    
    set((state) => ({
      components: state.components
        .filter((c) => !filteredIds.includes(c.id) && !filteredIds.includes(c.parent as any))
        .map(c => {
          // 清理 eventConfigs 中的 switchView 引用
          if (c.eventConfigs && deletedViews.length > 0) {
            const newEventConfigs = c.eventConfigs.map(eventConfig => ({
              ...eventConfig,
              actions: eventConfig.actions.filter(action => 
                !(action.type === 'switchView' && action.target && deletedViewIds.includes(action.target))
              )
            })).filter(eventConfig => eventConfig.actions.length > 0);
            
            return {
              ...c,
              eventConfigs: newEventConfigs.length > 0 ? newEventConfigs : undefined
            };
          }
          return c;
        })
    }));
    
    if (vscodeAPI) {
      vscodeAPI.postMessage({ command: 'delete', content: { ids: filteredIds, components: get().components } });
      let message = `批量删除控件: ${filteredIds.length} 个`;
      if (filteredIds.length < ids.length) {
        message = '根视图已跳过，其他组件已删除';
      }
      if (cleanedCount > 0) {
        message += `，已清理 ${cleanedCount} 个视图切换引用`;
      }
      vscodeAPI.postMessage({ command: 'notify', text: message });
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
  setEditingMode: (mode) => set({ editingMode: mode }),
  setCanvasBackgroundColor: (color) => set({ canvasBackgroundColor: color }),
  setShowViewConnections: (show) => set({ showViewConnections: show }),
  setShowViewRelationModal: (show) => set({ showViewRelationModal: show }),

  // Drag and drop
  startDrag: (componentId, mousePos) => {
    set({ draggedComponent: componentId });
  },

  drag: (mousePos) => {
    const state = get();
    if (!state.draggedComponent) return;

    const component = state.components.find((c) => c.id === state.draggedComponent);
    if (!component) return;

    const x = mousePos.x - state.canvasOffset.x;
    const y = mousePos.y - state.canvasOffset.y;

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
    
    // 调试：打印所有 eventConfigs
    state.components.forEach(c => {
      if (c.eventConfigs && c.eventConfigs.length > 0) {
        console.log(`[Webview Store] ${c.id} 的 eventConfigs:`, JSON.stringify(c.eventConfigs));
      }
    });

    vscodeAPI.postMessage({
      command: 'save',
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

  // 调整组件层级
  moveComponentLayer: (componentId: string, direction: LayerDirection) => {
    set((state) => {
      const comp = state.components.find(c => c.id === componentId);
      if (!comp) return state;

      // 找到同级组件
      const siblings = state.components.filter(c => c.parent === comp.parent);
      if (siblings.length <= 1) return state;

      const currentIndex = siblings.findIndex(c => c.id === componentId);
      const newIndex = calculateNewIndex(currentIndex, direction, siblings.length - 1);
      if (newIndex === currentIndex) return state;

      // 重新排列同级组件并重建数组
      const reorderedSiblings = reorderArray(siblings, currentIndex, newIndex);
      const newComponents = rebuildComponentsArray(state.components, reorderedSiblings, comp.parent);

      // 保存到后端
      state.vscodeAPI?.postMessage({ command: 'save', components: newComponents });

      return { components: newComponents };
    });
  },

  // Project configuration
  setProjectConfig: (config) => {
    set({ projectConfig: config, canvasSize: parseResolutionStr(config?.resolution) });
  },

  // Initialize with project config
  initializeWithProjectConfig: (config) => {
    set({
      projectConfig: config,
      selectedComponent: null,
      hoveredComponent: null,
      draggedComponent: null,
      zoom: 1,
      canvasOffset: { x: 0, y: 0 },
      canvasSize: parseResolutionStr(config?.resolution),
      canvasBackgroundColor: '#3c3c3c',
      editingMode: 'select',
    });
  },
}));

// Helper function to generate unique ID
export const generateId = (): string => {
  return `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
