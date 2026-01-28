import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { componentIconMap } from './ComponentLibrary';
import { t } from '../i18n';
import './ComponentTree.css';

interface ComponentTreeNodeProps {
  componentId: string;
  level: number;
  onContextMenu?: (e: React.MouseEvent, componentId: string) => void;
}

const ComponentTreeNode: React.FC<ComponentTreeNodeProps> = ({ componentId, level, onContextMenu }) => {
  const {
    components,
    selectedComponent,
    selectedComponents,
    selectComponent,
    setSelectedComponents,
    updateComponent,
    centerViewOnCanvas,
    moveComponent,
    reorderSiblings,
    moveComponentToPosition,
  } = useDesignerStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const component = components.find(c => c.id === componentId);
  if (!component) return null;

  const children = components.filter(c => c.parent === componentId);
  const hasChildren = children.length > 0;

  const clickTimerRef = React.useRef<number | null>(null);

  // 判断是否可以拖拽
  const canDrag = (comp: NonNullable<typeof component>) => {
    // hg_view 不能拖拽
    if (comp.type === 'hg_view') return false;
    // hg_list_item 不能拖拽（由 list 控件自动管理）
    if (comp.type === 'hg_list_item') return false;
    return true;
  };

  // 判断是否可以作为拖放目标
  const canDrop = (draggedComp: NonNullable<typeof component>, targetComp: NonNullable<typeof component>) => {
    // 不能拖到自己身上
    if (draggedComp.id === targetComp.id) return false;

    // hg_list_item 只能拖到 hg_list 中
    if (draggedComp.type === 'hg_list_item') {
      return targetComp.type === 'hg_list';
    }

    // 非 hg_list_item 不能拖到 hg_list 中
    if (targetComp.type === 'hg_list') {
      return false; // 前面已经处理了 hg_list_item 的情况
    }

    // 只有容器控件可以作为父组件
    const containerTypes = ['hg_view', 'hg_window', 'hg_list_item'];
    if (!containerTypes.includes(targetComp.type)) {
      return false;
    }

    // 不能拖到自己的子组件中
    const isDescendant = (parentId: string | null | undefined, targetId: string): boolean => {
      if (!parentId) return false;
      if (parentId === targetId) return true;
      const parent = components.find(c => c.id === parentId);
      return parent ? isDescendant(parent.parent, targetId) : false;
    };

    if (isDescendant(targetComp.id, draggedComp.id)) {
      return false;
    }

    return true;
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 清除之前的定时器，防止双击时触发单击逻辑
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    
    // 延迟执行单击逻辑，给双击事件判断的时间
    clickTimerRef.current = window.setTimeout(() => {
      if (multi) {
        const next = selectedComponents.includes(componentId)
          ? selectedComponents.filter((id: string) => id !== componentId)
          : [...selectedComponents, componentId];
        setSelectedComponents(next);
      } else {
        selectComponent(componentId);
      }
      clickTimerRef.current = null;
    }, 200);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 取消单击的延迟执行
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    
    selectComponent(componentId);
    centerViewOnCanvas(componentId);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateComponent(componentId, { visible: !component.visible });
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateComponent(componentId, { locked: !component.locked });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, componentId);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  // 拖拽事件处理
  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag(component)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('componentId', componentId);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    const draggedId = e.dataTransfer.types.includes('componentid') ? 'temp' : null;
    if (!draggedId) return;

    e.preventDefault();
    e.stopPropagation();

    // 计算鼠标在节点中的相对位置，决定是插入前、插入后还是作为子节点
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    // 如果是容器控件，支持三种放置方式
    const isContainer = component.type === 'hg_view' || 
                       component.type === 'hg_window' || 
                       component.type === 'hg_list' ||
                       component.type === 'hg_list_item';
    
    if (isContainer && hasChildren && isExpanded) {
      // 容器控件：上 1/4 插入前，中间 1/2 作为子节点，下 1/4 插入后
      if (y < height * 0.25) {
        setDropPosition('before');
      } else if (y > height * 0.75) {
        setDropPosition('after');
      } else {
        setDropPosition('inside');
      }
    } else if (isContainer) {
      // 容器控件但没有子节点或未展开：上 1/3 插入前，中间 1/3 作为子节点，下 1/3 插入后
      if (y < height * 0.33) {
        setDropPosition('before');
      } else if (y > height * 0.67) {
        setDropPosition('after');
      } else {
        setDropPosition('inside');
      }
    } else {
      // 非容器控件：上半部分插入前，下半部分插入后
      if (y < height * 0.5) {
        setDropPosition('before');
      } else {
        setDropPosition('after');
      }
    }
    
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = e.dataTransfer.getData('componentId');
    if (!draggedId || draggedId === componentId) {
      setIsDragOver(false);
      setDropPosition(null);
      return;
    }

    const draggedComp = components.find(c => c.id === draggedId);
    if (!draggedComp) {
      setIsDragOver(false);
      setDropPosition(null);
      return;
    }

    const position = dropPosition;
    setIsDragOver(false);
    setDropPosition(null);

    // 根据放置位置执行不同的操作
    if (position === 'inside') {
      // 作为子节点
      if (!canDrop(draggedComp, component)) {
        return;
      }
      moveComponent(draggedId, componentId);
    } else if (position === 'before' || position === 'after') {
      // 插入到兄弟位置
      // 验证：拖拽的组件和目标组件必须能有相同的父组件
      const targetParent = component.parent;
      
      // 特殊验证：如果目标是 hg_list_item，拖拽的也必须是 hg_list_item
      if (component.type === 'hg_list_item' && draggedComp.type !== 'hg_list_item') {
        return;
      }
      if (draggedComp.type === 'hg_list_item' && component.type !== 'hg_list_item') {
        return;
      }
      
      // 如果目标父组件存在，验证拖拽组件是否可以放入
      if (targetParent) {
        const parentComp = components.find(c => c.id === targetParent);
        if (parentComp && !canDrop(draggedComp, parentComp)) {
          return;
        }
      }
      
      // 执行插入操作
      insertComponentAt(draggedId, componentId, position);
    }
  };

  // 在指定组件前后插入
  const insertComponentAt = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    const state = useDesignerStore.getState();
    const draggedComp = state.components.find(c => c.id === draggedId);
    const targetComp = state.components.find(c => c.id === targetId);
    
    if (!draggedComp || !targetComp) return;
    
    const targetParent = targetComp.parent;
    
    // 获取同级组件列表
    const siblings = state.components.filter(c => c.parent === targetParent);
    const targetIndex = siblings.findIndex(c => c.id === targetId);
    const draggedIndex = siblings.findIndex(c => c.id === draggedId);
    
    // 如果已经在同一父组件下，只需要调整顺序
    if (draggedComp.parent === targetParent) {
      // 计算新的索引
      let newIndex = targetIndex;
      if (position === 'after') {
        newIndex = targetIndex + 1;
      }
      
      // 如果拖拽组件在目标组件之前，需要调整索引
      if (draggedIndex < targetIndex && position === 'before') {
        newIndex = targetIndex - 1;
      }
      
      if (draggedIndex !== newIndex) {
        reorderSiblings(draggedId, targetParent, newIndex);
      }
    } else {
      // 需要改变父组件并插入到指定位置
      moveComponentToPosition(draggedId, targetParent, targetId, position);
    }
  };

  const isSelected = selectedComponent === componentId;

  // 获取组件图标
  const getComponentIcon = () => {
    // 使用组件库中定义的图标
    return componentIconMap[component.type] || '📦';
  };

  // 获取组件显示名称
  const getComponentDisplayName = () => {
    // 对于 list_item，显示索引编号
    if (component.type === 'hg_list_item' && component.data?.index !== undefined) {
      return `List Item ${component.data.index}`;
    }
    return component.name;
  };

  return (
    <div 
      className={`tree-node ${isSelected ? 'selected' : ''} ${isDragOver && dropPosition ? `drag-${dropPosition}` : ''}`}
      draggable={canDrag(component)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="tree-node-content"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {hasChildren && (
          <div className="tree-expand-icon" onClick={handleToggleExpand}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
        {!hasChildren && <div className="tree-spacer" />}

        <div className="tree-node-icon">{getComponentIcon()}</div>

        <div className="tree-node-label">{getComponentDisplayName()}</div>

        <div className="tree-node-actions">
          <div
            className="tree-action-button"
            onClick={handleToggleVisibility}
            title={component.visible ? t('Hide') : t('Show')}
          >
            {component.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </div>
          <div
            className="tree-action-button"
            onClick={handleToggleLock}
            title={component.locked ? t('Unlock') : t('Lock')}
          >
            {component.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="tree-children">
          {children.map(child => (
            <ComponentTreeNode
              key={child.id}
              componentId={child.id}
              level={level + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ComponentTree: React.FC<{ onContextMenu?: (e: React.MouseEvent, componentId: string) => void }> = ({ onContextMenu }) => {
  const { components, allHmlFiles, currentFilePath, vscodeAPI } = useDesignerStore();

  const rootComponents = components.filter(c => c.parent === null);

  const handleFileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPath = e.target.value;
    if (selectedPath && selectedPath !== currentFilePath && vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'switchFile',
        filePath: selectedPath
      });
    }
  };

  return (
    <div className="component-tree">
      {allHmlFiles && allHmlFiles.length > 1 && (
        <div className="tree-file-selector">
          <select 
            value={currentFilePath || ''} 
            onChange={handleFileChange}
            className="file-select"
          >
            {allHmlFiles.map((file: {path: string, name: string, relativePath: string}) => (
              <option key={file.path} value={file.path}>
                {file.relativePath}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="tree-content">
        {rootComponents.length === 0 ? (
          <div className="tree-empty">
            {t('No components')}
            <div className="tree-empty-tip">
              {t('Drag from component library to add')}
            </div>
          </div>
        ) : (
          rootComponents.map(component => (
            <ComponentTreeNode
              key={component.id}
              componentId={component.id}
              level={0}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ComponentTree;
