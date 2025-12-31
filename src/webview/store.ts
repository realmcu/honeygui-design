/**
 * Zustand Store for HoneyGUI Designer
 * 管理设计器的状态和逻辑
 */

import { create } from 'zustand';
import { Component, ComponentType, DesignerState, VSCodeAPI } from './types';
import { 
  alignComponents, 
  distributeComponents, 
  resizeComponents,
  AlignType,
  DistributeType,
  ResizeType
} from './utils/alignmentUtils';

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

// ============ 辅助函数：深度克隆组件 ============

/**
 * 深度克隆组件及其子组件
 * @param component 要克隆的组件
 * @param newIdSuffix 新ID的后缀
 * @returns 克隆后的组件
 */
function cloneComponent(component: Component, newIdSuffix: string): Component {
  const newId = `${component.id}_${newIdSuffix}`;
  return {
    ...component,
    id: newId,
    name: `${component.name}_copy`,
    // 如果有子组件ID数组，也需要更新
    children: component.children?.map(childId => `${childId}_${newIdSuffix}`)
  };
}

/**
 * 递归克隆组件树（包括所有子组件）
 * @param components 所有组件数组
 * @param rootComponent 要克隆的根组件
 * @param newIdSuffix 新ID的后缀
 * @returns 克隆后的组件数组（包括根组件和所有子组件）
 */
function cloneComponentTree(components: Component[], rootComponent: Component, newIdSuffix: string): Component[] {
  const clonedComponents: Component[] = [];
  const clonedRoot = cloneComponent(rootComponent, newIdSuffix);
  clonedComponents.push(clonedRoot);
  
  // 递归克隆所有子组件
  if (rootComponent.children && rootComponent.children.length > 0) {
    rootComponent.children.forEach(childId => {
      const childComponent = components.find(c => c.id === childId);
      if (childComponent) {
        const clonedChildren = cloneComponentTree(components, childComponent, newIdSuffix);
        clonedComponents.push(...clonedChildren);
      }
    });
  }
  
  return clonedComponents;
}

// ============ Store 定义 ============

export interface DesignerStore extends DesignerState {
  // Actions
  setComponents: (components: Component[]) => void;
  addComponent: (component: Component, options?: { save?: boolean }) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  renameComponent: (oldId: string, newId: string) => boolean;
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
  centerViewOnCanvas: (componentId: string) => void;
  
  // View connections
  showViewConnections: boolean;
  setShowViewConnections: (show: boolean) => void;
  showViewRelationModal: boolean;
  setShowViewRelationModal: (show: boolean) => void;
  
  // Alignment guides
  showAlignmentGuides: boolean;
  setShowAlignmentGuides: (show: boolean) => void;

  // Assets
  setAssetCategory: (category: 'all' | 'images' | 'svgs' | 'videos' | 'models' | 'fonts') => void;

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
  
  // Clipboard operations
  clipboard: Component | null;
  clipboardMultiple: Component[];
  copyComponent: (id: string) => void;
  cutComponent: (id: string) => void;
  pasteComponent: (position?: { x: number; y: number }) => void;
  copySelectedComponents: () => void;
  cutSelectedComponents: () => void;

  // Alignment operations
  alignSelectedComponents: (type: import('./utils/alignmentUtils').AlignType) => void;
  distributeSelectedComponents: (type: import('./utils/alignmentUtils').DistributeType) => void;
  resizeSelectedComponents: (type: import('./utils/alignmentUtils').ResizeType) => void;

  // Selection
  getSelectedComponent: () => Component | undefined;
  getSelectedComponents: () => Component[];
  getComponentById: (id: string) => Component | undefined;

  // List Item management
  syncListItems: (listId: string) => void;

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
  allViews: [] as Array<{id: string, name: string, file: string, edges: Array<{target: string, event: string, switchOutStyle?: string, switchInStyle?: string}>}>, // 项目中所有 view（含跳转关系）
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
  showAlignmentGuides: true, // 默认显示智能辅助线
  undoStack: [],
  redoStack: [],
  vscodeAPI: null,
  assetCategory: 'all' as 'all' | 'images' | 'svgs' | 'videos' | 'models' | 'fonts', // 资源面板分类
  clipboard: null, // 剪贴板
  clipboardMultiple: [], // 多选剪贴板

  // Actions
  setComponents: (components) => {
    set({ components });
  },

  addComponent: (component, options?: { save?: boolean }) => {
    const shouldSave = options?.save !== false; // 默认为true
    set((state) => {
      const newComponents = [...state.components];

      // 如果是 hg_view，检查是否是第一个，设置 entry 属性
      if (component.type === 'hg_view') {
        const existingViews = newComponents.filter(c => c.type === 'hg_view');
        if (existingViews.length === 0) {
          // 第一个 hg_view，设置 entry="true"
          component.data = { ...component.data, entry: true };
        }
      }

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
    
    // 如果是 list 控件，自动初始化 list_item 子组件
    if (component.type === 'hg_list') {
      // 使用 setTimeout 确保组件已经添加到 state 中
      setTimeout(() => {
        get().syncListItems(component.id);
      }, 0);
    }
    
    // 根据选项决定是否保存
    if (shouldSave) {
      get().saveToFile();
    }
  },

  updateComponent: (id, updates) => {
    const state = get();
    const before = state.components.find(c => c.id === id);
    if (!before) return;
    
    // 对于 list 控件，验证属性值
    let finalUpdates = { ...updates };
    
    if (before.type === 'hg_list') {
      // 验证 data 属性
      if (updates.data) {
        const validatedData = { ...updates.data };
        
        // 验证 noteNum >= 1
        if ('noteNum' in validatedData) {
          const noteNum = validatedData.noteNum as number;
          if (noteNum < 1) {
            validatedData.noteNum = 1;
            if (vscodeAPI) {
              vscodeAPI.postMessage({
                command: 'showError',
                text: '项数量必须大于等于 1'
              });
            }
          }
        }
        
        finalUpdates.data = validatedData;
      }
      
      // 验证 style 属性
      if (updates.style) {
        const validatedStyle = { ...updates.style };
        
        // 验证 itemWidth >= 1
        if ('itemWidth' in validatedStyle) {
          const itemWidth = validatedStyle.itemWidth as number;
          if (itemWidth < 1) {
            validatedStyle.itemWidth = 1;
            if (vscodeAPI) {
              vscodeAPI.postMessage({
                command: 'showError',
                text: '项宽度必须大于等于 1'
              });
            }
          }
        }
        
        // 验证 itemHeight >= 1
        if ('itemHeight' in validatedStyle) {
          const itemHeight = validatedStyle.itemHeight as number;
          if (itemHeight < 1) {
            validatedStyle.itemHeight = 1;
            if (vscodeAPI) {
              vscodeAPI.postMessage({
                command: 'showError',
                text: '项高度必须大于等于 1'
              });
            }
          }
        }
        
        // 验证 space >= 0
        if ('space' in validatedStyle) {
          const space = validatedStyle.space as number;
          if (space < 0) {
            validatedStyle.space = 0;
            if (vscodeAPI) {
              vscodeAPI.postMessage({
                command: 'showError',
                text: '项间距必须大于等于 0'
              });
            }
          }
        }
        
        finalUpdates.style = validatedStyle;
      }
    }
    
    // 对于几何控件，如果修改了半径或线宽，自动调整 width 和 height
    if (before.type === 'hg_arc' && updates.style) {
      const currentStyle = before.style || {};
      const newStyle = { ...currentStyle, ...updates.style };
      const radius = newStyle.radius ?? 40;
      const strokeWidth = newStyle.strokeWidth ?? 8;
      
      // 自动调整尺寸：width = height = 2 * (radius + strokeWidth)
      const newSize = 2 * (radius + strokeWidth);
      
      finalUpdates.position = {
        ...before.position,
        ...finalUpdates.position,
        width: newSize,
        height: newSize,
      };
    }
    
    if (before.type === 'hg_circle' && updates.style) {
      const currentStyle = before.style || {};
      const newStyle = { ...currentStyle, ...updates.style };
      const radius = newStyle.radius ?? 40;
      
      // 自动调整尺寸：width = height = 2 * radius
      const newSize = 2 * radius;
      
      finalUpdates.position = {
        ...before.position,
        ...finalUpdates.position,
        width: newSize,
        height: newSize,
      };
    }
    
    // 对于 hg_view，如果设置 entry=true，需要将其他 hg_view 的 entry 设为 false
    if (before.type === 'hg_view' && finalUpdates.data?.entry === true) {
      set((state) => ({
        components: state.components.map((comp) => {
          if (comp.id === id) {
            return { ...comp, ...finalUpdates };
          }
          // 其他 hg_view 的 entry 设为 false
          if (comp.type === 'hg_view' && comp.data?.entry === true) {
            return { ...comp, data: { ...comp.data, entry: false } };
          }
          return comp;
        }),
      }));
      get().saveToFile();
      return;
    }
    
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === id ? { ...comp, ...finalUpdates } : comp
      ),
    }));
    get().saveToFile();
  },

  renameComponent: (oldId, newId) => {
    const state = get();
    
    // 检查新 ID 是否已存在
    if (state.components.some(c => c.id === newId)) {
      return false;
    }
    
    // 更新组件 ID 和所有引用
    set((state) => ({
      // 更新选中状态
      selectedComponent: state.selectedComponent === oldId ? newId : state.selectedComponent,
      selectedComponents: state.selectedComponents.map(id => id === oldId ? newId : id),
      // 更新组件列表
      components: state.components.map((comp) => {
        let updated = comp;
        
        // 更新组件自身的 id 和 name
        if (comp.id === oldId) {
          updated = { ...updated, id: newId, name: newId };
        }
        
        // 更新子组件的 parent 引用
        if (comp.parent === oldId) {
          updated = { ...updated, parent: newId };
        }
        
        // 更新父组件的 children 数组
        if (comp.children?.includes(oldId)) {
          updated = { ...updated, children: comp.children.map(c => c === oldId ? newId : c) };
        }
        
        // 更新事件配置中的 target 引用
        if (comp.eventConfigs) {
          const updatedConfigs = comp.eventConfigs.map(ec => ({
            ...ec,
            actions: ec.actions.map(action => 
              action.target === oldId ? { ...action, target: newId } : action
            )
          }));
          updated = { ...updated, eventConfigs: updatedConfigs };
        }
        
        return updated;
      }),
    }));
    get().saveToFile();
    return true;
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

    // 禁止删除列表项
    if (component.type === 'hg_list_item') {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项由 list 控件自动管理，请修改 noteNum 属性来调整数量'
        });
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
  setShowAlignmentGuides: (show) => set({ showAlignmentGuides: show }),
  setAssetCategory: (category) => set({ assetCategory: category }),
  
  // 将指定组件居中显示在画布上
  centerViewOnCanvas: (componentId) => {
    const state = get();
    const component = state.components.find(c => c.id === componentId);
    if (!component || !component.position) return;
    
    // 获取画布容器的实际尺寸
    const canvasElement = document.querySelector('.designer-canvas');
    if (!canvasElement) return;
    
    const rect = canvasElement.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;
    
    // 实际缩放比例（与 DesignerCanvas 中的 transform 一致）
    const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
    
    // 计算组件的绝对位置（累加所有父组件的偏移）
    let absX = component.position.x;
    let absY = component.position.y;
    let parentId = component.parent;
    while (parentId) {
      const parent = state.components.find(c => c.id === parentId);
      if (parent && parent.position) {
        absX += parent.position.x;
        absY += parent.position.y;
      }
      parentId = parent?.parent || null;
    }
    
    // 计算组件中心点（在画布坐标系中）
    const compCenterX = absX + component.position.width / 2;
    const compCenterY = absY + component.position.height / 2;
    
    // 计算需要的偏移量，使组件中心对齐视口中心
    // 公式：视口中心 = 组件中心 * effectiveZoom + offset
    // 所以：offset = 视口中心 - 组件中心 * effectiveZoom
    const offsetX = viewportWidth / 2 - compCenterX * effectiveZoom;
    const offsetY = viewportHeight / 2 - compCenterY * effectiveZoom;
    
    set({ canvasOffset: { x: offsetX, y: offsetY } });
  },

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

  // Undo/Redo (由后端管理)
  undo: () => {
    window.vscodeAPI?.postMessage({ command: 'undo' });
  },

  redo: () => {
    window.vscodeAPI?.postMessage({ command: 'redo' });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  getUndoLabel: () => get().canUndo() ? '撤销' : null,
  getRedoLabel: () => get().canRedo() ? '重做' : null,

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

  // Clipboard operations
  copyComponent: (id) => {
    const component = get().components.find((c) => c.id === id);
    if (!component) return;
    
    // 禁止复制列表项
    if (component.type === 'hg_list_item') {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项不支持复制或剪切操作'
        });
      }
      return;
    }
    
    set({ clipboard: component });
  },

  cutComponent: (id) => {
    const component = get().components.find((c) => c.id === id);
    if (!component) return;
    
    // 禁止剪切列表项
    if (component.type === 'hg_list_item') {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项不支持复制或剪切操作'
        });
      }
      return;
    }
    
    get().copyComponent(id);
    get().removeComponent(id);
  },

  pasteComponent: (position) => {
    const { clipboard, clipboardMultiple, components } = get();
    
    // 多选粘贴
    if (clipboardMultiple.length > 0) {
      const newIds: string[] = [];
      const timestamp = Date.now();
      
      // 计算所有组件的边界框
      const minX = Math.min(...clipboardMultiple.map(c => c.position.x));
      const minY = Math.min(...clipboardMultiple.map(c => c.position.y));
      
      clipboardMultiple.forEach((comp, index) => {
        const parentExists = comp.parent 
          ? components.some((c) => c.id === comp.parent)
          : true;
        
        const offsetX = comp.position.x - minX;
        const offsetY = comp.position.y - minY;
        
        const newComponent: Component = {
          ...comp,
          id: `${comp.id}_copy_${timestamp}_${index}`,
          name: `${comp.name}_copy`,
          parent: parentExists ? comp.parent : null,
          position: position ? {
            x: position.x + offsetX,
            y: position.y + offsetY,
            width: comp.position.width,
            height: comp.position.height,
          } : {
            x: comp.position.x + 20,
            y: comp.position.y + 20,
            width: comp.position.width,
            height: comp.position.height,
          },
        };
        
        get().addComponent(newComponent);
        newIds.push(newComponent.id);
      });
      
      get().setSelectedComponents(newIds);
      return;
    }
    
    // 单选粘贴
    if (!clipboard) return;
    
    const parentExists = clipboard.parent 
      ? components.some((c) => c.id === clipboard.parent)
      : true;
    
    const newComponent: Component = {
      ...clipboard,
      id: `${clipboard.id}_copy_${Date.now()}`,
      name: `${clipboard.name}_copy`,
      parent: parentExists ? clipboard.parent : null,
      position: position ? {
        x: position.x,
        y: position.y,
        width: clipboard.position.width,
        height: clipboard.position.height,
      } : {
        x: clipboard.position.x + 20,
        y: clipboard.position.y + 20,
        width: clipboard.position.width,
        height: clipboard.position.height,
      },
    };
    
    get().addComponent(newComponent);
    get().selectComponent(newComponent.id);
  },

  copySelectedComponents: () => {
    const { selectedComponents, components } = get();
    if (!selectedComponents.length) return;
    
    const componentsToCopy = components.filter((c) => 
      selectedComponents.includes(c.id) && c.type !== 'hg_list_item'
    );
    
    if (componentsToCopy.length === 0) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项不支持复制或剪切操作'
        });
      }
      return;
    }
    
    set({ clipboardMultiple: componentsToCopy, clipboard: null });
  },

  cutSelectedComponents: () => {
    const { selectedComponents, components } = get();
    if (!selectedComponents.length) return;
    
    const componentsToCut = components.filter((c) => 
      selectedComponents.includes(c.id) && c.type !== 'hg_list_item'
    );
    
    if (componentsToCut.length === 0) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项不支持复制或剪切操作'
        });
      }
      return;
    }
    
    get().copySelectedComponents();
    componentsToCut.forEach((c) => get().removeComponent(c.id));
  },

  // ============ 对齐操作 ============
  
  alignSelectedComponents: (type: AlignType) => {
    const { selectedComponents, components, updateComponent } = get();
    
    if (selectedComponents.length < 2) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '请至少选择 2 个组件进行对齐'
        });
      }
      return;
    }
    
    const selected = components.filter((c) => selectedComponents.includes(c.id));
    
    // 检查是否所有组件都在同一父容器
    // 特殊处理：如果父容器都是 list_item，检查它们是否属于同一个 list
    const parents = selected.map((c) => c.parent);
    const uniqueParents = new Set(parents);
    
    if (uniqueParents.size > 1) {
      // 检查是否所有父容器都是 list_item，且属于同一个 list
      const parentComponents = parents
        .map(parentId => components.find(c => c.id === parentId))
        .filter(p => p !== undefined) as Component[];
      
      const allParentsAreListItems = parentComponents.every(p => p.type === 'hg_list_item');
      
      if (allParentsAreListItems) {
        // 检查所有 list_item 是否属于同一个 list
        const listParents = new Set(parentComponents.map(p => p.parent));
        if (listParents.size !== 1) {
          if (vscodeAPI) {
            vscodeAPI.postMessage({
              command: 'showInfo',
              text: '只能对齐同一 list 控件内的组件'
            });
          }
          return;
        }
        // 属于同一个 list，允许对齐
      } else {
        // 不是 list_item 的情况，必须在同一父容器
        if (vscodeAPI) {
          vscodeAPI.postMessage({
            command: 'showInfo',
            text: '只能对齐同一容器内的组件'
          });
        }
        return;
      }
    }
    
    // 重新排序：将最后选中的组件放在第一位（作为参考）
    const lastSelectedId = selectedComponents[selectedComponents.length - 1];
    const reordered = [
      ...selected.filter(c => c.id === lastSelectedId),
      ...selected.filter(c => c.id !== lastSelectedId)
    ];
    
    const updates = alignComponents(reordered, type);
    
    // 直接批量更新组件位置，避免触发几何控件的尺寸自动调整
    set((state) => {
      const newComponents = state.components.map((comp) => {
        const update = updates.find(u => u.id === comp.id);
        if (update && Object.keys(update.position).length > 0) {
          return {
            ...comp,
            position: { ...comp.position, ...update.position }
          };
        }
        return comp;
      });
      return { components: newComponents };
    });
    
    // 保存到文件
    get().saveToFile();
  },

  distributeSelectedComponents: (type: DistributeType) => {
    const { selectedComponents, components, updateComponent } = get();
    if (selectedComponents.length < 3) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '请至少选择 3 个组件进行分布'
        });
      }
      return;
    }
    
    const selected = components.filter((c) => selectedComponents.includes(c.id));
    
    // 检查是否所有组件都在同一父容器
    const parents = new Set(selected.map((c) => c.parent));
    if (parents.size > 1) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '只能分布同一容器内的组件'
        });
      }
      return;
    }
    
    const updates = distributeComponents(selected, type);
    
    updates.forEach(({ id, position }) => {
      if (Object.keys(position).length > 0) {
        const comp = components.find((c) => c.id === id);
        if (comp) {
          updateComponent(id, {
            position: { ...comp.position, ...position }
          });
        }
      }
    });
  },

  resizeSelectedComponents: (type: ResizeType) => {
    const { selectedComponents, components, updateComponent } = get();
    if (selectedComponents.length < 2) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '请至少选择 2 个组件进行尺寸调整'
        });
      }
      return;
    }
    
    const selected = components.filter((c) => selectedComponents.includes(c.id));
    
    // 尺寸调整不需要同一父容器限制
    const updates = resizeComponents(selected, type, 'first');
    
    updates.forEach(({ id, position }) => {
      if (Object.keys(position).length > 0) {
        const comp = components.find((c) => c.id === id);
        if (comp) {
          updateComponent(id, {
            position: { ...comp.position, ...position }
          });
        }
      }
    });
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

  // ============ List Item 管理 ============
  
  /**
   * 同步 list 控件的 list_item 子组件数量
   * @param listId list 控件的 ID
   */
  syncListItems: (listId: string) => {
    set((state) => {
      const listComponent = state.components.find(c => c.id === listId);
      if (!listComponent || listComponent.type !== 'hg_list') {
        return state;
      }
      
      // 获取 noteNum 属性（默认为 5）
      const noteNum = (listComponent.data?.noteNum as number) || 5;
      
      // 获取当前所有 list_item 子组件，并按 index 排序
      const currentItems = state.components
        .filter(c => c.type === 'hg_list_item' && c.parent === listId)
        .sort((a, b) => {
          const indexA = (a.data?.index as number) ?? 0;
          const indexB = (b.data?.index as number) ?? 0;
          return indexA - indexB;
        });
      const currentCount = currentItems.length;
      
      // 如果数量已经匹配，不需要调整
      if (currentCount === noteNum) {
        return state;
      }
      
      let newComponents = [...state.components];
      
      if (noteNum > currentCount) {
        // 需要添加新的 list_item
        const firstItem = currentItems[0];
        
        for (let i = currentCount; i < noteNum; i++) {
          const newItemId = `${listId}_item_${i}`;
          const newItem: Component = {
            id: newItemId,
            name: `hg_list_item${i}`,
            type: 'hg_list_item',
            parent: listId,
            position: { x: 0, y: 0, width: 0, height: 0 },
            data: { index: i },
            children: [],
            visible: true,
            enabled: true,
            locked: false,
            zIndex: 0
          };
          
          // 如果存在第一个 item，复制第一个 item 的子组件作为模板
          if (firstItem && firstItem.children && firstItem.children.length > 0) {
            const clonedChildren: Component[] = [];
            
            // 递归克隆第一个 item 的所有子组件
            firstItem.children.forEach(childId => {
              const childComponent = state.components.find(c => c.id === childId);
              if (childComponent) {
                const suffix = `item${i}`;
                const clonedTree = cloneComponentTree(state.components, childComponent, suffix);
                
                // 更新克隆组件的 parent 为新的 list_item
                clonedTree.forEach((clonedComp, index) => {
                  if (index === 0) {
                    // 根组件的 parent 是新的 list_item
                    clonedComp.parent = newItemId;
                  }
                });
                
                clonedChildren.push(...clonedTree);
                newItem.children!.push(clonedTree[0].id);
              }
            });
            
            // 将克隆的子组件添加到 components 数组
            newComponents.push(...clonedChildren);
          }
          
          // 添加新的 list_item
          newComponents.push(newItem);
          
          // 更新 list 组件的 children 数组
          const listIndex = newComponents.findIndex(c => c.id === listId);
          if (listIndex !== -1) {
            const updatedList = { ...newComponents[listIndex] };
            if (!updatedList.children) {
              updatedList.children = [];
            }
            if (!updatedList.children.includes(newItemId)) {
              updatedList.children.push(newItemId);
            }
            newComponents[listIndex] = updatedList;
          }
        }
      } else if (noteNum < currentCount) {
        // 需要删除多余的 list_item
        const itemsToRemove = currentItems.slice(noteNum);
        const idsToRemove = new Set<string>();
        
        // 收集要删除的 list_item 及其所有子组件的 ID
        itemsToRemove.forEach(item => {
          idsToRemove.add(item.id);
          
          // 递归收集所有子组件 ID
          const collectChildIds = (parentId: string) => {
            const children = newComponents.filter(c => c.parent === parentId);
            children.forEach(child => {
              idsToRemove.add(child.id);
              collectChildIds(child.id);
            });
          };
          
          collectChildIds(item.id);
        });
        
        // 过滤掉要删除的组件
        newComponents = newComponents.filter(c => !idsToRemove.has(c.id));
        
        // 更新 list 组件的 children 数组
        const listIndex = newComponents.findIndex(c => c.id === listId);
        if (listIndex !== -1) {
          const updatedList = { ...newComponents[listIndex] };
          updatedList.children = updatedList.children?.filter(
            childId => !idsToRemove.has(childId)
          ) || [];
          newComponents[listIndex] = updatedList;
        }
      }
      
      // 最后，确保 list 的 children 数组按 index 排序
      const finalListIndex = newComponents.findIndex(c => c.id === listId);
      if (finalListIndex !== -1) {
        const finalList = { ...newComponents[finalListIndex] };
        if (finalList.children && finalList.children.length > 0) {
          // 获取所有 list_item 子组件
          const listItems = finalList.children
            .map(childId => newComponents.find(c => c.id === childId))
            .filter(child => child !== undefined && child.type === 'hg_list_item') as Component[];
          
          // 按 index 排序
          listItems.sort((a, b) => {
            const indexA = a.data?.index ?? 0;
            const indexB = b.data?.index ?? 0;
            return indexA - indexB;
          });
          
          // 更新 children 数组为排序后的顺序
          finalList.children = listItems.map(c => c.id);
          newComponents[finalListIndex] = finalList;
        }
      }
      
      return { components: newComponents };
    });
    
    // 保存到文件
    get().saveToFile();
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
