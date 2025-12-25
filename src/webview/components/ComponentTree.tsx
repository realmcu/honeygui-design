import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
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
  } = useDesignerStore();

  const [isExpanded, setIsExpanded] = useState(true);

  const component = components.find(c => c.id === componentId);
  if (!component) return null;

  const children = components.filter(c => c.parent === componentId);
  const hasChildren = children.length > 0;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      const next = selectedComponents.includes(componentId)
        ? selectedComponents.filter((id: string) => id !== componentId)
        : [...selectedComponents, componentId];
      setSelectedComponents(next);
    } else {
      selectComponent(componentId);
      // 如果是 hg_view，自动居中显示
      if (component.type === 'hg_view') {
        centerViewOnCanvas(componentId);
      }
    }
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

  const isSelected = selectedComponent === componentId;

  // 获取组件图标
  const getComponentIcon = () => {
    if (component.type === 'hg_list') {
      return '📋';
    } else if (component.type === 'hg_list_item') {
      return '📄';
    }
    return '📦';
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
    <div className={`tree-node ${isSelected ? 'selected' : ''}`}>
      <div
        className="tree-node-content"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
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
            title={component.visible ? '隐藏' : '显示'}
          >
            {component.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </div>
          <div
            className="tree-action-button"
            onClick={handleToggleLock}
            title={component.locked ? '解锁' : '锁定'}
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
            暂无组件
            <div className="tree-empty-tip">
              从组件库拖拽添加组件
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
