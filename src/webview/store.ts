/**
 * Zustand Store for HoneyGUI Designer
 * 管理设计器的状态和逻辑
 */

import { create } from 'zustand';
import { Component, ComponentType, DesignerState, VSCodeAPI, AssetFile, ConversionConfig, ItemSettings } from './types';
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
  
  // 更新重排后的同级组件的 zIndex（按新顺序分配 zIndex）
  const reorderedSiblingsWithZIndex = reorderedSiblings.map((sibling, index) => ({
    ...sibling,
    zIndex: index
  }));
  
  const result: Component[] = [];
  let siblingsInserted = false;

  for (const comp of components) {
    if (siblingIds.has(comp.id)) {
      // 遇到第一个同级组件时，插入所有重排后的同级组件（已更新 zIndex）
      if (!siblingsInserted) {
        result.push(...reorderedSiblingsWithZIndex);
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
  saveViewState: (uiState?: { leftPanelTab?: 'components' | 'assets' | 'tree'; leftPanelVisible?: boolean; rightPanelVisible?: boolean; leftPanelWidth?: number; rightPanelWidth?: number }) => void;
  restoreViewState: (filePath: string) => { restored: boolean; state?: ViewState };
  
  // View connections
  showViewConnections: boolean;
  setShowViewConnections: (show: boolean) => void;
  showViewRelationModal: boolean;
  setShowViewRelationModal: (show: boolean) => void;
  
  // Alignment guides
  showAlignmentGuides: boolean;
  setShowAlignmentGuides: (show: boolean) => void;

  // Simulation status
  setSimulationRunning: (running: boolean) => void;

  // Assets
  setAssetCategory: (category: 'all' | 'images' | 'svgs' | 'videos' | 'models' | 'fonts' | 'glass' | 'lottie' | 'trmap') => void;

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
  reorderSiblings: (componentId: string, parentId: string | null | undefined, newIndex: number) => void;
  moveComponentToPosition: (componentId: string, newParentId: string | null | undefined, targetId: string, position: 'before' | 'after') => void;
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

  // Conversion config (资源转换配置)
  selectedAsset: AssetFile | null;
  conversionConfig: ConversionConfig | null;
  setSelectedAsset: (asset: AssetFile | null) => void;
  setConversionConfig: (config: ConversionConfig | null) => void;
  /**
   * 更新资源配置
   * @param path 资源路径（相对于 assets 目录）
   * @param settings 配置设置
   * @param changedField 变更的字段名（可选，用于触发特定行为如代码生成）
   */
  updateAssetConfig: (path: string, settings: ItemSettings, changedField?: string) => void;

  // Collaboration (多人协作)
  collaborationRole: 'none' | 'host' | 'guest';
  collaborationStatus: 'disconnected' | 'connecting' | 'connected' | 'hosting';
  collaborationHostAddress: string;
  collaborationHostPort: number;
  collaborationPeerCount: number;
  collaborationError: string | null;
  setCollaborationState: (state: {
    role?: 'none' | 'host' | 'guest';
    status?: 'disconnected' | 'connecting' | 'connected' | 'hosting';
    hostAddress?: string;
    hostPort?: number;
    peerCount?: number;
    error?: string | null;
  }) => void;
  resetCollaborationState: () => void;
  startHost: (port: number) => void;
  stopHost: () => void;
  joinSession: (address: string) => void;
  leaveSession: () => void;
  
  // 远程增量更新（协作模式，不触发保存）
  remoteAddComponent: (component: Component) => void;
  remoteUpdateComponent: (id: string, updates: Partial<Component>) => void;
  remoteDeleteComponent: (id: string) => void;
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

// 视图状态存储（按文件路径保存）
interface ViewState {
  zoom: number;
  canvasOffset: { x: number; y: number };
  selectedComponent: string | null;  // 选中的组件
  leftPanelTab: 'components' | 'assets' | 'tree';  // 左侧面板 Tab
  leftPanelVisible: boolean;  // 左侧面板是否可见
  rightPanelVisible: boolean;  // 右侧面板是否可见
  leftPanelWidth?: number;  // 左侧面板宽度
  rightPanelWidth?: number;  // 右侧面板宽度
}

// 使用 localStorage 持久化视图状态
const VIEW_STATE_STORAGE_KEY = 'honeygui-designer-view-states';

const viewStateStorage = {
  get: (filePath: string): ViewState | undefined => {
    try {
      const stored = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
      if (!stored) return undefined;
      const allStates = JSON.parse(stored) as Record<string, ViewState>;
      return allStates[filePath];
    } catch (e) {
      console.error('[ViewState] 读取失败:', e);
      return undefined;
    }
  },
  set: (filePath: string, state: ViewState): void => {
    try {
      const stored = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
      const allStates = stored ? JSON.parse(stored) : {};
      allStates[filePath] = state;
      localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(allStates));
    } catch (e) {
      console.error('[ViewState] 保存失败:', e);
    }
  }
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
  assetCategory: 'all' as 'all' | 'images' | 'svgs' | 'videos' | 'models' | 'fonts' | 'glass' | 'lottie' | 'trmap', // 资源面板分类
  clipboard: null, // 剪贴板
  clipboardMultiple: [], // 多选剪贴板
  isSimulationRunning: false, // 仿真运行状态
  selectedAsset: null, // 选中的资源（文件夹或图片）
  conversionConfig: null, // 转换配置

  // Collaboration state (多人协作状态)
  collaborationRole: 'none' as 'none' | 'host' | 'guest',
  collaborationStatus: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'hosting',
  collaborationHostAddress: '',
  collaborationHostPort: 3000,
  collaborationPeerCount: 0,
  collaborationError: null as string | null,

  // Actions
  setComponents: (components) => {
    // 确保至少有一个 entry view
    let newComponents = components;
    const hasEntry = components.some(c => c.type === 'hg_view' && (c.data?.entry === true || c.data?.entry === 'true'));
    
    if (!hasEntry && components.some(c => c.type === 'hg_view')) {
      const firstViewIndex = components.findIndex(c => c.type === 'hg_view');
      if (firstViewIndex !== -1) {
        newComponents = [...components];
        newComponents[firstViewIndex] = {
          ...newComponents[firstViewIndex],
          data: { ...newComponents[firstViewIndex].data, entry: true }
        };
      }
    }

    set({ components: newComponents });
  },

  addComponent: (component, options?: { save?: boolean }) => {
    const shouldSave = options?.save !== false; // 默认为true
    set((state) => {
      const newComponents = [...state.components];

      // 检查是否已存在相同ID的组件
      if (newComponents.some(c => c.id === component.id)) {
        return state;
      }

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
    
    // 发送添加组件消息给后端广播（用于协同）
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'addComponent',
        parentId: component.parent,
        component: component
      });
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
    
    // 防止取消唯一的 entry
    if (before.type === 'hg_view' && (before.data?.entry === true || before.data?.entry === 'true')) {
      if (finalUpdates.data) {
        const newEntry = finalUpdates.data.entry;
        if (newEntry === false || newEntry === 'false') {
          const hasOtherEntry = state.components.some(c => c.id !== id && c.type === 'hg_view' && (c.data?.entry === true || c.data?.entry === 'true'));
          if (!hasOtherEntry) {
            if (vscodeAPI) {
              vscodeAPI.postMessage({ command: 'showError', text: '必须至少保留一个入口视图(Entry View)' });
            }
            // 必须创建一个新对象，避免修改原始引用
            finalUpdates.data = { ...finalUpdates.data, entry: true };
          }
        }
      }
    }
    
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

    // 发送更新组件消息给后端广播（用于协同）
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'updateComponent',
        componentId: id,
        updates: finalUpdates
      });
    }

    get().saveToFile();
  },

  renameComponent: (oldId, newId) => {
    const state = get();
    
    // 检查新 ID 是否已存在
    if (state.components.some(c => c.id === newId)) {
      return false;
    }
    
    // 获取被重命名的组件
    const targetComponent = state.components.find(c => c.id === oldId);
    
    // 如果是 hg_list 组件，需要同步重命名其子 hg_list_item
    const listItemRenames: Map<string, string> = new Map();
    if (targetComponent?.type === 'hg_list') {
      // 找到所有子 hg_list_item
      const listItems = state.components.filter(
        c => c.type === 'hg_list_item' && c.parent === oldId
      );
      
      // 为每个 list_item 生成新的 ID
      listItems.forEach(item => {
        // 从旧 ID 中提取 item 后缀（如 _item_1）
        const oldItemId = item.id;
        const itemSuffix = oldItemId.replace(oldId, '');
        const newItemId = newId + itemSuffix;
        
        // 检查新 ID 是否已存在
        if (!state.components.some(c => c.id === newItemId)) {
          listItemRenames.set(oldItemId, newItemId);
        }
      });
    }
    
    // 更新组件 ID 和所有引用
    set((state) => ({
      // 更新选中状态
      selectedComponent: state.selectedComponent === oldId ? newId : 
        (listItemRenames.has(state.selectedComponent || '') ? listItemRenames.get(state.selectedComponent!)! : state.selectedComponent),
      selectedComponents: state.selectedComponents.map(id => {
        if (id === oldId) return newId;
        if (listItemRenames.has(id)) return listItemRenames.get(id)!;
        return id;
      }),
      // 更新组件列表
      components: state.components.map((comp) => {
        let updated = comp;
        
        // 更新组件自身的 id 和 name
        if (comp.id === oldId) {
          updated = { ...updated, id: newId, name: newId };
        } else if (listItemRenames.has(comp.id)) {
          // 更新 list_item 的 id 和 name
          const newItemId = listItemRenames.get(comp.id)!;
          updated = { ...updated, id: newItemId, name: newItemId };
        }
        
        // 更新子组件的 parent 引用
        if (comp.parent === oldId) {
          updated = { ...updated, parent: newId };
        } else if (listItemRenames.has(comp.parent || '')) {
          updated = { ...updated, parent: listItemRenames.get(comp.parent!)! };
        }
        
        // 更新父组件的 children 数组
        if (comp.children) {
          let childrenUpdated = false;
          const newChildren = comp.children.map(c => {
            if (c === oldId) {
              childrenUpdated = true;
              return newId;
            }
            if (listItemRenames.has(c)) {
              childrenUpdated = true;
              return listItemRenames.get(c)!;
            }
            return c;
          });
          if (childrenUpdated) {
            updated = { ...updated, children: newChildren };
          }
        }
        
        // 更新事件配置中的 target 引用
        if (comp.eventConfigs) {
          const updatedConfigs = comp.eventConfigs.map(ec => ({
            ...ec,
            actions: ec.actions.map(action => {
              if (action.target === oldId) {
                return { ...action, target: newId };
              }
              if (listItemRenames.has(action.target || '')) {
                return { ...action, target: listItemRenames.get(action.target!)! };
              }
              return action;
            })
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

    // 禁止删除默认主视图 mainView 或入口视图
    const isEntryView = component.type === 'hg_view' && (component.data?.entry === true || component.data?.entry === 'true');
    if (id === 'mainView' || isEntryView) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({ command: 'notify', text: '主视图(Entry View)不可删除' });
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
      // 协同：发送 deleteComponent 消息以便后端广播
      vscodeAPI.postMessage({ command: 'deleteComponent', componentId: id });

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
    
    // 过滤掉 mainView 和入口视图，不允许删除
    const state = get();
    const filteredIds = ids.filter(id => {
      const comp = state.components.find(c => c.id === id);
      const isEntry = comp?.type === 'hg_view' && (comp.data?.entry === true || comp.data?.entry === 'true');
      return id !== 'mainView' && !isEntry;
    });
    
    if (filteredIds.length === 0) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({ command: 'notify', text: '主视图(Entry View)不可删除' });
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

  selectComponent: (id) => {
    set({ selectedComponent: id, selectedComponents: id ? [id] : [] });
    // 保存选中状态
    get().saveViewState();
  },
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
  setZoom: (zoom) => {
    set({ zoom });
    // 立即保存视图状态（不使用防抖，确保切换文件前保存）
    get().saveViewState();
  },
  setCanvasOffset: (offset) => {
    set({ canvasOffset: offset });
    // 立即保存视图状态（不使用防抖，确保切换文件前保存）
    get().saveViewState();
  },
  setEditingMode: (mode) => set({ editingMode: mode }),
  setCanvasBackgroundColor: (color) => set({ canvasBackgroundColor: color }),
  setShowViewConnections: (show) => set({ showViewConnections: show }),
  setShowViewRelationModal: (show) => set({ showViewRelationModal: show }),
  setShowAlignmentGuides: (show) => set({ showAlignmentGuides: show }),
  setAssetCategory: (category) => set({ assetCategory: category }),
  setSimulationRunning: (running) => set({ isSimulationRunning: running }),
  
  // 保存当前视图状态
  saveViewState: (uiState) => {
    const state = get();
    if (state.currentFilePath) {
      const viewState: ViewState = {
        zoom: state.zoom,
        canvasOffset: state.canvasOffset,
        selectedComponent: state.selectedComponent,
        leftPanelTab: uiState?.leftPanelTab || 'components',
        leftPanelVisible: uiState?.leftPanelVisible ?? true,
        rightPanelVisible: uiState?.rightPanelVisible ?? true,
        leftPanelWidth: uiState?.leftPanelWidth,
        rightPanelWidth: uiState?.rightPanelWidth,
      };
      viewStateStorage.set(state.currentFilePath, viewState);
      console.log('[ViewState] 保存视图状态:', state.currentFilePath, viewState);
    }
  },
  
  // 恢复视图状态
  restoreViewState: (filePath: string) => {
    const savedState = viewStateStorage.get(filePath);
    console.log('[ViewState] 尝试恢复视图状态:', filePath, savedState);
    if (savedState) {
      // 【修复闪烁】不在这里直接 set，而是返回状态让调用者批量更新
      // set({
      //   zoom: savedState.zoom,
      //   canvasOffset: savedState.canvasOffset,
      //   selectedComponent: savedState.selectedComponent,
      // });
      console.log('[ViewState] 已找到保存的视图状态:', savedState);
      return { restored: true, state: savedState };
    } else {
      // 如果没有保存的状态，不重置（保持当前状态）
      console.log('[ViewState] 无保存状态，保持当前视图');
      return { restored: false };
    }
  },
  
  // 将指定组件居中显示在画布上
  centerViewOnCanvas: (componentId) => {
    const state = get();
    const component = state.components.find(c => c.id === componentId);
    if (!component || !component.position) {
      console.log('[centerViewOnCanvas] Component not found or no position:', componentId);
      return;
    }
    
    // 获取画布可视区域的尺寸（使用容器而不是画布本身）
    const containerElement = document.querySelector('.designer-canvas-container');
    if (!containerElement) {
      console.log('[centerViewOnCanvas] Canvas container not found');
      return;
    }
    
    const rect = containerElement.getBoundingClientRect();
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
    
    console.log('[centerViewOnCanvas]', {
      componentId,
      absPos: { x: absX, y: absY },
      compCenter: { x: compCenterX, y: compCenterY },
      viewport: { width: viewportWidth, height: viewportHeight },
      zoom: state.zoom,
      effectiveZoom,
      offset: { x: offsetX, y: offsetY }
    });
    
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
    const { components } = get();
    const component = components.find((c) => c.id === id);
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
    
    // 递归获取所有子组件
    const getAllChildren = (parentId: string): Component[] => {
      const children = components.filter(c => c.parent === parentId);
      const result: Component[] = [...children];
      children.forEach(child => {
        result.push(...getAllChildren(child.id));
      });
      return result;
    };
    
    // 收集组件及其所有子组件
    const allComponents = [component, ...getAllChildren(component.id)];
    
    // 如果有子组件，使用 clipboardMultiple；否则使用 clipboard
    if (allComponents.length > 1) {
      set({ clipboardMultiple: allComponents, clipboard: null });
    } else {
      set({ clipboard: component, clipboardMultiple: [] });
    }
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
      
      // 创建旧ID到新ID的映射表
      const idMap = new Map<string, string>();
      clipboardMultiple.forEach((comp, index) => {
        const newId = `${comp.id}_copy_${timestamp}_${index}`;
        idMap.set(comp.id, newId);
      });
      
      // 找出所有顶层组件（没有父组件或父组件不在复制列表中）
      const topLevelComponents = clipboardMultiple.filter(comp => 
        !comp.parent || !idMap.has(comp.parent)
      );
      
      // 计算顶层组件的边界框
      const minX = Math.min(...topLevelComponents.map(c => c.position.x));
      const minY = Math.min(...topLevelComponents.map(c => c.position.y));
      
      clipboardMultiple.forEach((comp, index) => {
        const newId = idMap.get(comp.id)!;
        
        // 检查父组件是否在复制的组件中
        let newParent: string | null = null;
        if (comp.parent) {
          if (idMap.has(comp.parent)) {
            // 父组件也在复制列表中，使用新的父组件ID
            newParent = idMap.get(comp.parent)!;
          } else if (components.some((c) => c.id === comp.parent)) {
            // 父组件不在复制列表中，但存在于画布中，保持原父组件
            newParent = comp.parent;
          }
          // 否则 newParent 为 null（父组件不存在）
        }
        
        // 更新 children 数组中的 ID
        let newChildren: string[] | undefined = undefined;
        if (comp.children && comp.children.length > 0) {
          newChildren = comp.children
            .map(childId => idMap.get(childId))
            .filter((id): id is string => id !== undefined);
        }
        
        // 计算新位置
        let newPosition;
        if (newParent && idMap.has(comp.parent!)) {
          // 子组件：保持相对于父组件的原始位置（不改变）
          newPosition = {
            x: comp.position.x,
            y: comp.position.y,
            width: comp.position.width,
            height: comp.position.height,
          };
        } else {
          // 顶层组件：应用偏移量
          const offsetX = comp.position.x - minX;
          const offsetY = comp.position.y - minY;
          
          newPosition = position ? {
            x: position.x + offsetX,
            y: position.y + offsetY,
            width: comp.position.width,
            height: comp.position.height,
          } : {
            x: comp.position.x + 20,
            y: comp.position.y + 20,
            width: comp.position.width,
            height: comp.position.height,
          };
        }
        
        const newComponent: Component = {
          ...comp,
          id: newId,
          name: `${comp.name}_copy`,
          parent: newParent,
          children: newChildren,
          position: newPosition,
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
    
    // 获取所有选中的组件（排除列表项）
    const directlySelected = components.filter((c) => 
      selectedComponents.includes(c.id) && c.type !== 'hg_list_item'
    );
    
    if (directlySelected.length === 0) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '列表项不支持复制或剪切操作'
        });
      }
      return;
    }
    
    // 递归获取所有子组件
    const getAllChildren = (parentId: string): Component[] => {
      const children = components.filter(c => c.parent === parentId);
      const result: Component[] = [...children];
      children.forEach(child => {
        result.push(...getAllChildren(child.id));
      });
      return result;
    };
    
    // 收集所有需要复制的组件（包括子组件）
    const componentsToCopy = new Set<Component>(directlySelected);
    directlySelected.forEach(comp => {
      const children = getAllChildren(comp.id);
      children.forEach(child => componentsToCopy.add(child));
    });
    
    // 按照层级顺序排序（父组件在前，子组件在后）
    const sortedComponents = Array.from(componentsToCopy).sort((a, b) => {
      // 如果 a 是 b 的祖先，a 应该在前
      let current: Component | undefined = b;
      while (current) {
        if (current.parent === a.id) return -1;
        current = components.find(c => c.id === current!.parent);
      }
      // 如果 b 是 a 的祖先，b 应该在前
      current = a;
      while (current) {
        if (current.parent === b.id) return 1;
        current = components.find(c => c.id === current!.parent);
      }
      return 0;
    });
    
    set({ clipboardMultiple: sortedComponents, clipboard: null });
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
    const state = get();
    const component = state.components.find((c) => c.id === id);
    if (!component) return;

    // 验证规则
    // 1. hg_view 不能移动（只能是根组件）
    if (component.type === 'hg_view') {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: 'hg_view 只能作为根组件，无法移动'
        });
      }
      return;
    }

    // 2. hg_list_item 只能在 hg_list 中
    if (component.type === 'hg_list_item') {
      const newParentComp = newParent ? state.components.find(c => c.id === newParent) : null;
      if (!newParentComp || newParentComp.type !== 'hg_list') {
        if (vscodeAPI) {
          vscodeAPI.postMessage({
            command: 'showInfo',
            text: 'list_item 只能在 hg_list 控件中'
          });
        }
        return;
      }
    }

    // 3. 非 hg_list_item 不能移动到 hg_list 中
    if (component.type !== 'hg_list_item' && newParent) {
      const newParentComp = state.components.find(c => c.id === newParent);
      if (newParentComp && newParentComp.type === 'hg_list') {
        if (vscodeAPI) {
          vscodeAPI.postMessage({
            command: 'showInfo',
            text: 'hg_list 只能包含 list_item 子组件'
          });
        }
        return;
      }
    }

    // 4. 不能移动到自己的子组件中（避免循环引用）
    const isDescendant = (parentId: string | null | undefined, targetId: string): boolean => {
      if (!parentId) return false;
      if (parentId === targetId) return true;
      const parent = state.components.find(c => c.id === parentId);
      return parent ? isDescendant(parent.parent, targetId) : false;
    };

    if (newParent && isDescendant(newParent, id)) {
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'showInfo',
          text: '不能将组件移动到自己的子组件中'
        });
      }
      return;
    }

    // 5. 只有容器控件（hg_view, hg_window）可以作为父组件
    if (newParent) {
      const newParentComp = state.components.find(c => c.id === newParent);
      if (newParentComp && 
          newParentComp.type !== 'hg_view' && 
          newParentComp.type !== 'hg_window' &&
          newParentComp.type !== 'hg_list' &&
          newParentComp.type !== 'hg_list_item') {
        if (vscodeAPI) {
          vscodeAPI.postMessage({
            command: 'showInfo',
            text: '只有容器控件（hg_view, hg_window）可以包含子组件'
          });
        }
        return;
      }
    }

    set((state) => {
      const component = state.components.find((c) => c.id === id);
      if (!component) return state;

      return {
        components: state.components.map((comp) => {
          if (comp.id === id) {
            return { ...comp, parent: newParent };
          }
          // Update old parent's children
          if (comp.id === component.parent) {
            return {
              ...comp,
              children: comp.children?.filter((childId) => childId !== id),
            };
          }
          // Update new parent's children
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

  // 重新排序同级组件
  reorderSiblings: (componentId: string, parentId: string | null | undefined, newIndex: number) => {
    set((state) => {
      // 获取同级组件
      const siblings = state.components.filter(c => c.parent === parentId);
      const currentIndex = siblings.findIndex(c => c.id === componentId);
      
      if (currentIndex === -1 || currentIndex === newIndex) {
        return state;
      }
      
      // 重新排列同级组件
      const reordered = [...siblings];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(newIndex, 0, moved);
      
      // 更新重排后的同级组件的 zIndex（按新顺序分配 zIndex）
      const reorderedWithZIndex = reordered.map((sibling, index) => ({
        ...sibling,
        zIndex: index
      }));
      
      // 重建整个 components 数组，保持新的顺序
      const siblingIds = new Set(siblings.map(s => s.id));
      const newComponents: typeof state.components = [];
      let siblingsInserted = false;
      
      for (const comp of state.components) {
        if (siblingIds.has(comp.id)) {
          // 遇到第一个同级组件时，插入所有重排后的同级组件（已更新 zIndex）
          if (!siblingsInserted) {
            newComponents.push(...reorderedWithZIndex);
            siblingsInserted = true;
          }
          // 跳过原来的同级组件（已在上面插入）
        } else {
          // 如果是父组件，更新其 children 数组
          if (comp.id === parentId) {
            newComponents.push({
              ...comp,
              children: reorderedWithZIndex.map(c => c.id)
            });
          } else {
            newComponents.push(comp);
          }
        }
      }
      
      return { components: newComponents };
    });
    get().saveToFile();
  },

  // 移动组件到指定位置（改变父组件并插入到指定位置）
  moveComponentToPosition: (componentId: string, newParentId: string | null | undefined, targetId: string, position: 'before' | 'after') => {
    const state = get();
    const component = state.components.find(c => c.id === componentId);
    const targetComp = state.components.find(c => c.id === targetId);
    
    if (!component || !targetComp) return;
    
    // 先移动到新父组件
    set((state) => {
      const oldParentId = component.parent;
      
      return {
        components: state.components.map((comp) => {
          // 更新组件的父引用
          if (comp.id === componentId) {
            return { ...comp, parent: newParentId };
          }
          // 从旧父组件的 children 中移除
          if (comp.id === oldParentId) {
            return {
              ...comp,
              children: comp.children?.filter((childId) => childId !== componentId),
            };
          }
          // 添加到新父组件的 children（先添加到末尾，后面会调整顺序）
          if (comp.id === newParentId) {
            return {
              ...comp,
              children: [...(comp.children || []), componentId],
            };
          }
          return comp;
        }),
      };
    });
    
    // 然后调整顺序（使用更新后的状态）
    const updatedState = get();
    const siblings = updatedState.components.filter(c => c.parent === newParentId);
    const targetIndex = siblings.findIndex(c => c.id === targetId);
    const newIndex = position === 'before' ? targetIndex : targetIndex + 1;
    
    get().reorderSiblings(componentId, newParentId, newIndex);
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

      return { components: newComponents };
    });
    
    // 在 set 完成后立即保存到文件
    get().saveToFile();
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

  // ============ 资源转换配置 ============

  /**
   * 设置选中的资源（文件夹或图片）
   * @param asset 资源对象，null 表示取消选中
   */
  setSelectedAsset: (asset: AssetFile | null) => {
    set({ selectedAsset: asset });
  },

  /**
   * 设置转换配置
   * @param config 转换配置对象
   */
  setConversionConfig: (config: ConversionConfig | null) => {
    set({ conversionConfig: config });
  },

  /**
   * 更新指定资源路径的配置
   * @param path 资源路径（相对于 assets 目录）
   * @param settings 配置设置
   * @param changedField 变更的字段名（可选，用于触发特定行为如代码生成）
   */
  updateAssetConfig: (path: string, settings: ItemSettings, changedField?: string) => {
    const state = get();
    const currentConfig = state.conversionConfig;
    
    if (!currentConfig) {
      // 如果没有配置，创建新配置
      const newConfig: ConversionConfig = {
        version: '1.0',
        defaultSettings: {
          format: 'adaptive16',
          compression: 'adaptive'
        },
        items: {
          [path]: settings
        }
      };
      set({ conversionConfig: newConfig });
      
      // 通知后端保存配置
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'saveConversionConfig',
          config: newConfig,
          changedPath: path,
          changedField: changedField
        });
      }
      return;
    }
    
    // 更新现有配置
    const newConfig: ConversionConfig = {
      ...currentConfig,
      items: {
        ...currentConfig.items,
        [path]: settings
      }
    };
    
    set({ conversionConfig: newConfig });
    
    // 通知后端保存配置
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'saveConversionConfig',
        config: newConfig,
        changedPath: path,
        changedField: changedField
      });
    }
  },

  // Collaboration methods (多人协作方法)
  setCollaborationState: (state) => {
    set((current) => ({
      collaborationRole: state.role ?? current.collaborationRole,
      collaborationStatus: state.status ?? current.collaborationStatus,
      collaborationHostAddress: state.hostAddress ?? current.collaborationHostAddress,
      collaborationHostPort: state.hostPort ?? current.collaborationHostPort,
      collaborationPeerCount: state.peerCount ?? current.collaborationPeerCount,
      collaborationError: state.error !== undefined ? state.error : current.collaborationError,
    }));
  },

  resetCollaborationState: () => {
    set({
      collaborationRole: 'none',
      collaborationStatus: 'disconnected',
      collaborationHostAddress: '',
      collaborationHostPort: 3000,
      collaborationPeerCount: 0,
      collaborationError: null,
    });
  },

  startHost: (port: number) => {
    set({
      collaborationStatus: 'connecting',
      collaborationHostPort: port,
      collaborationError: null,
    });
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'startHost',
        port: port,
      });
    }
  },

  stopHost: () => {
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'stopHost',
      });
    }
    set({
      collaborationRole: 'none',
      collaborationStatus: 'disconnected',
      collaborationHostAddress: '',
      collaborationPeerCount: 0,
      collaborationError: null,
    });
  },

  joinSession: (address: string) => {
    set({
      collaborationStatus: 'connecting',
      collaborationHostAddress: address,
      collaborationError: null,
    });
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'joinSession',
        address: address,
      });
    }
  },

  leaveSession: () => {
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'leaveSession',
      });
    }
    set({
      collaborationRole: 'none',
      collaborationStatus: 'disconnected',
      collaborationHostAddress: '',
      collaborationPeerCount: 0,
      collaborationError: null,
    });
  },

  // 远程增量更新方法（协作模式，不触发保存和广播）
  remoteAddComponent: (component: Component) => {
    set((state) => {
      const newComponents = [...state.components];
      
      // 检查是否已存在相同ID的组件
      if (newComponents.some(c => c.id === component.id)) {
        return state;
      }
      
      // 如果组件有父组件引用，更新父组件的children数组
      if (component.parent && typeof component.parent === 'string') {
        const parentIndex = newComponents.findIndex(comp => comp.id === component.parent);
        if (parentIndex !== -1) {
          if (!newComponents[parentIndex].children) {
            newComponents[parentIndex] = { ...newComponents[parentIndex], children: [] };
          }
          if (!newComponents[parentIndex].children!.includes(component.id)) {
            newComponents[parentIndex] = {
              ...newComponents[parentIndex],
              children: [...newComponents[parentIndex].children!, component.id]
            };
          }
        }
      }
      
      newComponents.push(component);
      return { components: newComponents };
    });
  },

  remoteUpdateComponent: (id: string, updates: Partial<Component>) => {
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === id ? { ...comp, ...updates } : comp
      ),
    }));
  },

  remoteDeleteComponent: (id: string) => {
    set((state) => {
      const component = state.components.find(c => c.id === id);
      if (!component) return state;
      
      // 收集要删除的组件ID（包括子组件）
      const idsToDelete = new Set<string>();
      const collectIds = (compId: string) => {
        idsToDelete.add(compId);
        const comp = state.components.find(c => c.id === compId);
        if (comp?.children) {
          comp.children.forEach(childId => collectIds(childId));
        }
      };
      collectIds(id);
      
      return {
        components: state.components
          .filter(c => !idsToDelete.has(c.id))
          .map(c => {
            // 更新父组件的 children 数组
            if (c.children && c.children.includes(id)) {
              return { ...c, children: c.children.filter(childId => childId !== id) };
            }
            return c;
          }),
        // 如果删除的是当前选中的组件，清除选中状态
        selectedComponent: state.selectedComponent && idsToDelete.has(state.selectedComponent) ? null : state.selectedComponent,
        selectedComponents: state.selectedComponents.filter(sid => !idsToDelete.has(sid)),
      };
    });
  },
}));

// Helper function to generate unique ID
export const generateId = (): string => {
  return `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
