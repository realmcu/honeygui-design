import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import './ComponentTree.css';

interface ComponentTreeNodeProps {
  componentId: string;
  level: number;
}

const ComponentTreeNode: React.FC<ComponentTreeNodeProps> = ({ componentId, level }) => {
  const {
    components,
    selectedComponent,
    selectedComponents,
    selectComponent,
    setSelectedComponents,
    updateComponent,
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

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const isSelected = selectedComponent === componentId;

  return (
    <div className={`tree-node ${isSelected ? 'selected' : ''}`}>
      <div
        className="tree-node-content"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <div className="tree-expand-icon" onClick={handleToggleExpand}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
        {!hasChildren && <div className="tree-spacer" />}

        <div className="tree-node-icon">📦</div>

        <div className="tree-node-label">{component.name}</div>

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
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ComponentTree: React.FC = () => {
  const { components } = useDesignerStore();

  const rootComponents = components.filter(c => c.parent === null);

  return (
    <div className="component-tree">
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
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ComponentTree;
