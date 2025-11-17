import React from 'react';
import { ComponentType, ComponentDefinition } from '../types';
import './ComponentLibrary.css';

interface ComponentLibraryProps {
  onComponentDragStart: (type: ComponentType) => void;
}

const componentDefinitions: ComponentDefinition[] = [
  {
    type: 'button',
    name: '按钮',
    icon: '🔘',
    defaultSize: { width: 100, height: 32 },
    properties: [
      { name: 'text', label: '文本', type: 'string', defaultValue: 'Button', group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'label',
    name: '标签',
    icon: '🏷️',
    defaultSize: { width: 80, height: 24 },
    properties: [
      { name: 'text', label: '文本', type: 'string', defaultValue: 'Label', group: 'data' },
      { name: 'fontSize', label: '字体大小', type: 'number', defaultValue: 14, group: 'style' },
      { name: 'color', label: '颜色', type: 'color', group: 'style' },
    ],
  },
  {
    type: 'input',
    name: '输入框',
    icon: '📝',
    defaultSize: { width: 200, height: 32 },
    properties: [
      { name: 'placeholder', label: '占位符', type: 'string', group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'text',
    name: '文本',
    icon: '📄',
    defaultSize: { width: 100, height: 24 },
    properties: [
      { name: 'text', label: '文本', type: 'string', defaultValue: 'Text', group: 'data' },
      { name: 'fontSize', label: '字体大小', type: 'number', defaultValue: 16, group: 'style' },
    ],
  },
  {
    type: 'image',
    name: '图片',
    icon: '🖼️',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: '图片路径', type: 'string', group: 'data' },
      { name: 'visible', label: '可见', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'checkbox',
    name: '复选框',
    icon: '☑️',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: '选中', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'radio',
    name: '单选框',
    icon: '⭕',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: '选中', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: '启用', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },

  {
    type: 'panel',
    name: '面板',
    icon: '🪟',
    defaultSize: { width: 400, height: 300 },
    properties: [
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'border', label: '边框', type: 'string', defaultValue: '1px solid #ccc', group: 'style' },
      { name: 'borderRadius', label: '圆角', type: 'number', defaultValue: 4, group: 'style' },
    ],
  },
  {
    type: 'view',
    name: '视图',
    icon: '👁️',
    defaultSize: { width: 350, height: 250 },
    properties: [
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'padding', label: '内边距', type: 'number', defaultValue: 12, group: 'style' },
      { name: 'overflow', label: '溢出处理', type: 'select', defaultValue: 'auto', options: ['auto', 'hidden', 'scroll'], group: 'style' },
    ],
  },
  {
    type: 'window',
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
    type: 'canvas',
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
  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('component-type', type);
    onComponentDragStart(type);
  };

  return (
    <div className="component-library">
      <div className="library-header">
        <h3>组件库</h3>
      </div>
      <div className="library-content">
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
    </div>
  );
};

export default ComponentLibrary;
export { componentDefinitions };
