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
      { name: 'timeFormat', label: '时间格式', type: 'select', defaultValue: '', 
        options: ['', 'HH:mm:ss', 'HH:mm', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss', 'MM-DD HH:mm'], group: 'data' },
      { name: 'hAlign', label: '水平对齐', type: 'select', defaultValue: 'LEFT', 
        options: ['LEFT', 'CENTER', 'RIGHT'], group: 'style' },
      { name: 'vAlign', label: '竖直对齐', type: 'select', defaultValue: 'TOP', 
        options: ['TOP', 'MID'], group: 'style' },
      { name: 'color', label: '颜色', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'letterSpacing', label: '字间距', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'lineSpacing', label: '行间距', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'wordWrap', label: '自动换行', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'wordBreak', label: '按词换行', type: 'boolean', defaultValue: false, group: 'style' },
      // 字体配置
      { name: 'fontFile', label: '字体文件', type: 'string', defaultValue: '', group: 'font' },
      { name: 'fontSize', label: '字体大小', type: 'number', defaultValue: 16, group: 'font' },
      { name: 'fontType', label: '字体类型', type: 'select', defaultValue: 'bitmap', 
        options: ['bitmap', 'vector'], group: 'font' },
      { name: 'renderMode', label: '渲染模式', type: 'select', defaultValue: '4', 
        options: ['1', '2', '4', '8'], group: 'font' },
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
      { name: 'entry', label: '入口视图', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'backgroundColor', label: '背景色', type: 'color', defaultValue: '#000000', group: 'style' },
      { name: 'borderRadius', label: '圆角', type: 'number', defaultValue: 0, group: 'style' },
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
  {
    type: 'hg_list',
    name: '列表',
    icon: '📋',
    defaultSize: { width: 300, height: 400 },
    properties: [
      { name: 'itemWidth', label: '项宽度', type: 'number', defaultValue: 100, group: 'style' },
      { name: 'itemHeight', label: '项高度', type: 'number', defaultValue: 100, group: 'style' },
      { name: 'space', label: '项间距', type: 'number', defaultValue: 5, group: 'style' },
      { name: 'direction', label: '方向', type: 'select', defaultValue: 'VERTICAL', options: ['VERTICAL', 'HORIZONTAL'], group: 'style' },
      { name: 'style', label: '样式', type: 'select', defaultValue: 'LIST_CLASSIC', options: ['LIST_CLASSIC', 'LIST_CIRCLE', 'LIST_ZOOM', 'LIST_CARD', 'LIST_FADE', 'LIST_FAN', 'LIST_HELIX', 'LIST_CURL'], group: 'style' },
      { name: 'cardStackLocation', label: '堆叠位置距离', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'noteNum', label: '项数量', type: 'number', defaultValue: 5, group: 'data' },
      { name: 'autoAlign', label: '自动对齐', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'inertia', label: '惯性滚动', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'loop', label: '循环滚动', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'createBar', label: '显示滚动条', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'offset', label: '初始偏移', type: 'number', defaultValue: 0, group: 'data' },
      { name: 'outScope', label: '超出范围', type: 'number', defaultValue: 0, group: 'data' },
    ],
  },
  {
    type: 'hg_video',
    name: '视频',
    icon: '🎬',
    defaultSize: { width: 320, height: 240 },
    properties: [
      { name: 'src', label: '视频路径', type: 'string', group: 'data' },
      { name: 'autoplay', label: '自动播放', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'loop', label: '循环播放', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'controls', label: '显示控制条', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_3d',
    name: '3D模型',
    icon: '🧊',
    defaultSize: { width: 400, height: 400 },
    properties: [
      { name: 'modelPath', label: '模型路径', type: 'string', group: 'data' },
      { name: 'drawType', label: '绘制类型', type: 'select', defaultValue: 'L3_DRAW_FRONT_AND_SORT', options: ['L3_DRAW_FRONT_ONLY', 'L3_DRAW_FRONT_AND_BACK', 'L3_DRAW_FRONT_AND_SORT'], group: 'data' },
      { name: 'worldX', label: '世界X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'worldY', label: '世界Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'worldZ', label: '世界Z', type: 'number', defaultValue: 30, group: 'style' },
      { name: 'rotationX', label: 'X轴旋转', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'rotationY', label: 'Y轴旋转', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'rotationZ', label: 'Z轴旋转', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'scale', label: '缩放', type: 'number', defaultValue: 5, group: 'style' },
      { name: 'cameraPosX', label: '相机X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraPosY', label: '相机Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraPosZ', label: '相机Z', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookX', label: '朝向X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookY', label: '朝向Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookZ', label: '朝向Z', type: 'number', defaultValue: 1, group: 'style' },
    ],
  },
  {
    type: 'hg_arc',
    name: '弧形',
    icon: '🌙',
    defaultSize: { width: 96, height: 96 }, // 2 * (radius + strokeWidth) = 2 * (40 + 8) = 96
    properties: [
      { name: 'radius', label: '半径', type: 'number', defaultValue: 40, group: 'style' },
      { name: 'startAngle', label: '起始角度', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'endAngle', label: '结束角度', type: 'number', defaultValue: 270, group: 'style' },
      { name: 'strokeWidth', label: '线宽', type: 'number', defaultValue: 8, group: 'style' },
      { name: 'color', label: '颜色', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: '透明度', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: '启用渐变', type: 'boolean', defaultValue: false, group: 'style' },
    ],
  },
  {
    type: 'hg_circle',
    name: '圆形',
    icon: '🔵',
    defaultSize: { width: 80, height: 80 }, // 2 * radius = 2 * 40 = 80
    properties: [
      { name: 'radius', label: '半径', type: 'number', defaultValue: 40, group: 'style' },
      { name: 'fillColor', label: '填充颜色', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: '透明度', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: '启用渐变', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'gradientType', label: '渐变类型', type: 'select', defaultValue: 'radial', options: ['radial', 'angular'], group: 'style' },
    ],
  },
  {
    type: 'hg_rect',
    name: '矩形',
    icon: '▭',
    defaultSize: { width: 120, height: 80 },
    properties: [
      { name: 'borderRadius', label: '圆角半径', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'fillColor', label: '填充颜色', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: '透明度', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: '启用渐变', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'gradientDirection', label: '渐变方向', type: 'select', defaultValue: 'horizontal', options: ['horizontal', 'vertical', 'diagonal_tl_br', 'diagonal_tr_bl'], group: 'style' },
    ],
  },
  {
    type: 'hg_svg',
    name: 'SVG',
    icon: '🎨',
    defaultSize: { width: 100, height: 100 },
    properties: [
      { name: 'src', label: 'SVG路径', type: 'string', group: 'data' },
    ],
  },
  {
    type: 'hg_lottie',
    name: 'Lottie动画',
    icon: '🎬',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: '动画路径', type: 'string', group: 'data' },
      { name: 'autoplay', label: '自动播放', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'loop', label: '循环播放', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
];

// 组件分类
const componentCategories = [
  {
    name: '容器',
    types: ['hg_view', 'hg_window', 'hg_canvas', 'hg_list']
  },
  {
    name: '基础控件',
    types: ['hg_button', 'hg_label', 'hg_image']
  },
  {
    name: '输入控件',
    types: ['hg_input', 'hg_checkbox', 'hg_radio']
  },
  {
    name: '图形',
    types: ['hg_arc', 'hg_circle', 'hg_rect', 'hg_svg']
  },
  {
    name: '多媒体',
    types: ['hg_video', 'hg_3d', 'hg_lottie']
  }
];

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onComponentDragStart }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(componentCategories.map(c => c.name))
  );

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('component-type', type);
    onComponentDragStart(type);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  return (
    <div className="component-library">
      <div className="library-content">
        {componentCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const components = componentDefinitions.filter(c => category.types.includes(c.type));
          
          return (
            <div key={category.name} className="component-category">
              <div 
                className="category-header" 
                onClick={() => toggleCategory(category.name)}
              >
                <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                <span className="category-name">{category.name}</span>
              </div>
              {isExpanded && (
                <div className="category-content">
                  {components.map((component) => (
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
        })}
      </div>
    </div>
  );
};

export default ComponentLibrary;
export { componentDefinitions };
