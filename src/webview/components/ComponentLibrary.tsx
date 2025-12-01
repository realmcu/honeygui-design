import React, { useState } from 'react';
import { ComponentType, ComponentDefinition } from '../types';
import './ComponentLibrary.css';

interface ComponentLibraryProps {
  onComponentDragStart: (type: ComponentType) => void;
}

const componentDefinitions: ComponentDefinition[] = [
  {
    type: 'hg_button',
    name: '按钮',
    icon: '🔘',
    defaultSize: { width: 100, height: 32 },
    properties: [
      { name: 'text', label: '文本', type: 'string', defaultValue: 'Button', group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_label',  // 统一使用'label'，移除'text'，避免重复
    name: '标签/文本',
    icon: '🏷️',
    defaultSize: { width: 100, height: 24 },
    properties: [
      { name: 'text', label: '文本', type: 'string', defaultValue: 'Label', group: 'data' },
      { name: 'fontSize', label: '字体大小', type: 'number', defaultValue: 14, group: 'style' },
      { name: 'color', label: '颜色', type: 'color', group: 'style' },
    ],
  },
  {
    type: 'hg_input',
    name: '输入框',
    icon: '📝',
    defaultSize: { width: 200, height: 32 },
    properties: [
      { name: 'placeholder', label: '占位符', type: 'string', group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_image',
    name: '图片',
    icon: '🖼️',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: '图片路径', type: 'string', group: 'data' },
      { name: 'visible', label: '可见', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_checkbox',
    name: '复选框',
    icon: '☑️',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: '选中', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_radio',
    name: '单选框',
    icon: '⭕',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: '选中', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },

  {
    type: 'hg_view',
    name: '视图',
    icon: '👁️',
    defaultSize: { width: 350, height: 250 },
    properties: [
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#000000', group: 'style' },
      { name: 'padding', label: '内边距', type: 'number', defaultValue: 12, group: 'style' },
      { name: 'overflow', label: '溢出处理', type: 'select', defaultValue: 'auto', options: ['auto', 'hidden', 'scroll'], group: 'style' },
    ],
  },
  {
    type: 'hg_window',
    name: '窗口',
    icon: '🪟',
    defaultSize: { width: 450, height: 350 },
    properties: [
      { name: 'title', label: '窗口标题', type: 'string', defaultValue: '窗口', group: 'general' },
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'border', label: '边框', type: 'string', defaultValue: '1px solid #ccc', group: 'style' },
      { name: 'borderRadius', label: '圆角', type: 'number', defaultValue: 6, group: 'style' },
      { name: 'titleBarHeight', label: '标题栏高度', type: 'number', defaultValue: 36, group: 'style' },
      { name: 'titleBarColor', label: '标题栏颜色', type: 'color', defaultValue: '#f0f0f0', group: 'style' },
    ],
  },
  {
    type: 'hg_canvas',
    name: '画布组件',
    icon: '🎨',
    defaultSize: { width: 300, height: 200 },
    properties: [
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'border', label: '边框', type: 'string', defaultValue: '1px solid #cccccc', group: 'style' },
      { name: 'borderRadius', label: '圆角', type: 'number', defaultValue: 4, group: 'style' },
      { name: 'overflow', label: '溢出处理', type: 'select', defaultValue: 'hidden', options: ['hidden', 'auto', 'scroll', 'visible'], group: 'style' },
    ],
  },
];

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onComponentDragStart }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  console.log('[ComponentLibrary] Render - isExpanded:', isExpanded, 'className:', `component-library ${!isExpanded ? 'collapsed' : ''}`);

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('component-type', type);
    onComponentDragStart(type);
  };

  return (
    <div
      className={`component-library ${!isExpanded ? 'collapsed' : ''}`}
      style={{ flex: isExpanded ? '1' : '0 0 auto' }}
    >
      <div className="library-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <h3>组件库</h3>
      </div>
      {isExpanded && (
        <div className="library-content" style={{ minHeight: 160 }}>
          {componentDefinitions.map((component) => (
            <div
              key={component.type}
              className="component-item"
              draggable
              onDragStart={(e) => handleDragStart(e, component.type)}
              title={component.name}
            >
              <div className="component-icon">{component.icon}</div>
              <div className="component-name">{component.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
export { componentDefinitions };
