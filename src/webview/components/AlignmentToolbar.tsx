/**
 * 对齐工具栏组件
 * 
 * 提供对齐、分布、尺寸调整功能的下拉菜单
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { 
  AlignType, 
  DistributeType, 
  ResizeType,
  getAlignmentConfigsByCategory 
} from '../utils/alignmentUtils';
import './AlignmentToolbar.css';

/**
 * 对齐图标 SVG
 */
const AlignIcons: Record<string, React.ReactNode> = {
  left: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="2" height="12" />
      <rect x="6" y="4" width="8" height="3" />
      <rect x="6" y="9" width="5" height="3" />
    </svg>
  ),
  right: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="12" y="2" width="2" height="12" />
      <rect x="2" y="4" width="8" height="3" />
      <rect x="5" y="9" width="5" height="3" />
    </svg>
  ),
  top: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="12" height="2" />
      <rect x="4" y="6" width="3" height="8" />
      <rect x="9" y="6" width="3" height="5" />
    </svg>
  ),
  bottom: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="12" width="12" height="2" />
      <rect x="4" y="2" width="3" height="8" />
      <rect x="9" y="5" width="3" height="5" />
    </svg>
  ),
  centerH: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="7" y="2" width="2" height="12" />
      <rect x="2" y="4" width="12" height="3" />
      <rect x="4" y="9" width="8" height="3" />
    </svg>
  ),
  centerV: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="7" width="12" height="2" />
      <rect x="4" y="2" width="3" height="12" />
      <rect x="9" y="4" width="3" height="8" />
    </svg>
  ),
  horizontal: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="4" width="3" height="8" />
      <rect x="6.5" y="4" width="3" height="8" />
      <rect x="11" y="4" width="3" height="8" />
    </svg>
  ),
  vertical: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="2" width="8" height="3" />
      <rect x="4" y="6.5" width="8" height="3" />
      <rect x="4" y="11" width="8" height="3" />
    </svg>
  ),
  sameWidth: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="4" width="5" height="3" />
      <rect x="2" y="9" width="5" height="3" />
      <path d="M9 5.5h5M9 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
    </svg>
  ),
  sameHeight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="2" width="3" height="5" />
      <rect x="9" y="2" width="3" height="5" />
      <path d="M5.5 9v5M10.5 9v5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
    </svg>
  ),
};

interface DropdownMenuProps {
  title: string;
  items: Array<{
    type: string;
    label: string;
    shortcut?: string;
    minComponents: number;
  }>;
  selectedCount: number;
  onSelect: (type: string) => void;
}

/**
 * 下拉菜单组件
 */
const DropdownMenu: React.FC<DropdownMenuProps> = ({ 
  title, 
  items, 
  selectedCount, 
  onSelect 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="alignment-dropdown" ref={menuRef}>
      <button 
        className="alignment-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        {title}
        <span className="dropdown-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="alignment-dropdown-menu">
          {items.map((item) => {
            const disabled = selectedCount < item.minComponents;
            return (
              <button
                key={item.type}
                className={`alignment-menu-item ${disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (!disabled) {
                    onSelect(item.type);
                    setIsOpen(false);
                  }
                }}
                disabled={disabled}
                title={disabled ? `需要选择至少 ${item.minComponents} 个组件` : undefined}
              >
                <span className="menu-item-icon">
                  {AlignIcons[item.type]}
                </span>
                <span className="menu-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="menu-item-shortcut">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 对齐工具栏
 */
export const AlignmentToolbar: React.FC = () => {
  const { 
    selectedComponents,
    alignSelectedComponents,
    distributeSelectedComponents,
    resizeSelectedComponents
  } = useDesignerStore();

  const selectedCount = selectedComponents.length;
  
  const alignConfigs = getAlignmentConfigsByCategory('align');
  const distributeConfigs = getAlignmentConfigsByCategory('distribute');
  const resizeConfigs = getAlignmentConfigsByCategory('resize');

  const handleAlign = (type: string) => {
    alignSelectedComponents(type as AlignType);
  };

  const handleDistribute = (type: string) => {
    distributeSelectedComponents(type as DistributeType);
  };

  const handleResize = (type: string) => {
    resizeSelectedComponents(type as ResizeType);
  };

  // 只有选中多个组件时才显示
  if (selectedCount < 2) {
    return null;
  }

  return (
    <div className="alignment-toolbar">
      <DropdownMenu
        title="对齐"
        items={alignConfigs}
        selectedCount={selectedCount}
        onSelect={handleAlign}
      />
      <DropdownMenu
        title="分布"
        items={distributeConfigs}
        selectedCount={selectedCount}
        onSelect={handleDistribute}
      />
      <DropdownMenu
        title="尺寸"
        items={resizeConfigs}
        selectedCount={selectedCount}
        onSelect={handleResize}
      />
      <span className="alignment-info">
        已选 {selectedCount} 个
      </span>
    </div>
  );
};

export default AlignmentToolbar;
