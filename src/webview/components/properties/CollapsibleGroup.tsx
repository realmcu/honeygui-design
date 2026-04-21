import React, { useState, useCallback } from 'react';
import './CollapsibleGroup.css';

// 模块级缓存：记住每个分组的折叠状态，组件重挂载时保持一致
const collapsedCache = new Map<string, boolean>();

interface CollapsibleGroupProps {
  /** 分组标题 */
  title: string;
  /** 缓存 key，用于跨组件切换时保持折叠状态 */
  cacheKey?: string;
  /** 初始是否折叠，默认展开 */
  defaultCollapsed?: boolean;
  /** 子内容 */
  children: React.ReactNode;
}

export const CollapsibleGroup: React.FC<CollapsibleGroupProps> = ({
  title,
  cacheKey,
  defaultCollapsed = false,
  children,
}) => {
  const key = cacheKey || title;
  const [collapsed, setCollapsed] = useState(() => {
    return collapsedCache.has(key) ? collapsedCache.get(key)! : defaultCollapsed;
  });

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      collapsedCache.set(key, next);
      return next;
    });
  }, [key]);

  return (
    <div className={`property-group collapsible-group${collapsed ? ' collapsed' : ''}`}>
      <div
        className="collapsible-group-header"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className={`collapsible-group-arrow${collapsed ? '' : ' expanded'}`}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
        <span className="collapsible-group-title">{title}</span>
      </div>
      {!collapsed && (
        <div className="collapsible-group-content">
          {children}
        </div>
      )}
    </div>
  );
};
