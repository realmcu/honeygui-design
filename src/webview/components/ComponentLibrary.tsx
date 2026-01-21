import React, { useState, useRef, useEffect } from 'react';
import { ComponentType, ComponentDefinition } from '../types';
import { t } from '../i18n';
import './ComponentLibrary.css';

interface ComponentLibraryProps {
  onComponentDragStart: (type: ComponentType) => void;
  onCreateComponent?: (type: ComponentType) => void;
}

/**
 * 高级应用控件配置
 * 定义哪些基础控件有对应的高级应用变体
 */
interface AdvancedVariant {
  type: ComponentType;
  label: string;
  icon: string;
}

const advancedVariants: Record<string, AdvancedVariant[]> = {
  'hg_label': [
    { type: 'hg_time_label', label: 'Time Label', icon: '🕐' },
  ],
};

/**
 * 右键菜单状态
 */
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  componentType: string;
}

const componentDefinitions: ComponentDefinition[] = [
  {
    type: 'hg_button',
    name: 'Button',
    icon: '🔘',
    defaultSize: { width: 100, height: 32 },
    properties: [
      { name: 'text', label: 'Text', type: 'string', defaultValue: 'Button', group: 'data' },
      { name: 'toggleMode', label: 'Toggle Mode', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'imageOn', label: 'On Image', type: 'string', group: 'data' },
      { name: 'imageOff', label: 'Off Image', type: 'string', group: 'data' },
      { name: 'initialState', label: 'Initial State', type: 'select', defaultValue: 'off', 
        options: ['on', 'off'], group: 'data' },
      { name: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_label',
    name: 'Label/Text',
    icon: '🏷️',
    defaultSize: { width: 100, height: 24 },
    properties: [
      { name: 'text', label: 'Text', type: 'string', defaultValue: 'Label', group: 'data' },
      { name: 'hAlign', label: 'Horizontal Align', type: 'select', defaultValue: 'LEFT', 
        options: ['LEFT', 'CENTER', 'RIGHT'], group: 'style' },
      { name: 'vAlign', label: 'Vertical Align', type: 'select', defaultValue: 'TOP', 
        options: ['TOP', 'MID'], group: 'style' },
      { name: 'color', label: 'Color', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'letterSpacing', label: 'Letter Spacing', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'lineSpacing', label: 'Line Spacing', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'wordWrap', label: 'Word Wrap', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'wordBreak', label: 'Word Break', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'scrollDirection', label: 'Scroll Direction', type: 'select', defaultValue: 'horizontal', 
        options: ['horizontal', 'vertical'], group: 'scroll' },
      { name: 'scrollReverse', label: 'Reverse Direction', type: 'boolean', defaultValue: false, group: 'scroll' },
      { name: 'scrollStartOffset', label: 'Start Offset (px)', type: 'number', defaultValue: 0, group: 'scroll' },
      { name: 'scrollEndOffset', label: 'End Offset (px)', type: 'number', defaultValue: 0, group: 'scroll' },
      { name: 'scrollInterval', label: 'Loop Interval (ms)', type: 'number', defaultValue: 3000, group: 'scroll' },
      { name: 'scrollDuration', label: 'Total Duration (ms)', type: 'number', defaultValue: 0, group: 'scroll' },
      { name: 'fontFile', label: 'Font File', type: 'string', defaultValue: '', group: 'font' },
      { name: 'fontSize', label: 'Font Size', type: 'number', defaultValue: 16, group: 'font' },
      { name: 'fontType', label: 'Font Type', type: 'select', defaultValue: 'bitmap', 
        options: ['bitmap', 'vector'], group: 'font' },
      { name: 'renderMode', label: 'Render Mode', type: 'select', defaultValue: '4', 
        options: ['1', '2', '4', '8'], group: 'font' },
    ],
  },
  // hg_time_label 定义保留用于属性面板，但不在组件库中显示
  {
    type: 'hg_time_label',
    name: 'Time Label',
    icon: '🕐',
    defaultSize: { width: 120, height: 24 },
    properties: [
      { name: 'timeFormat', label: 'Time Format', type: 'select', defaultValue: 'HH:mm:ss', 
        options: ['HH:mm:ss', 'HH:mm', 'HH:mm-split', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss', 'MM-DD HH:mm'], group: 'data' },
      { name: 'hAlign', label: 'Horizontal Align', type: 'select', defaultValue: 'LEFT', 
        options: ['LEFT', 'CENTER', 'RIGHT'], group: 'style' },
      { name: 'vAlign', label: 'Vertical Align', type: 'select', defaultValue: 'TOP', 
        options: ['TOP', 'MID'], group: 'style' },
      { name: 'color', label: 'Color', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'letterSpacing', label: 'Letter Spacing', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'lineSpacing', label: 'Line Spacing', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'wordWrap', label: 'Word Wrap', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'fontFile', label: 'Font File', type: 'string', defaultValue: '', group: 'font' },
      { name: 'fontSize', label: 'Font Size', type: 'number', defaultValue: 16, group: 'font' },
      { name: 'fontType', label: 'Font Type', type: 'select', defaultValue: 'bitmap', 
        options: ['bitmap', 'vector'], group: 'font' },
      { name: 'renderMode', label: 'Render Mode', type: 'select', defaultValue: '4', 
        options: ['1', '2', '4', '8'], group: 'font' },
    ],
  },
  {
    type: 'hg_input',
    name: 'Input',
    icon: '📝',
    defaultSize: { width: 200, height: 32 },
    properties: [
      { name: 'placeholder', label: 'Placeholder', type: 'string', group: 'data' },
      { name: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_image',
    name: 'Image',
    icon: '🖼️',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: 'Image Path', type: 'string', group: 'data' },
      { name: 'visible', label: 'Visible', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_checkbox',
    name: 'Checkbox',
    icon: '☑️',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: 'Checked', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_radio',
    name: 'Radio',
    icon: '⭕',
    defaultSize: { width: 20, height: 20 },
    properties: [
      { name: 'value', label: 'Checked', type: 'boolean', defaultValue: false, group: 'data' },
      { name: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_view',
    name: 'View',
    icon: '👁️',
    defaultSize: { width: 350, height: 250 },
    properties: [
      { name: 'entry', label: 'Entry View', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'backgroundColor', label: 'Background Color', type: 'color', defaultValue: '#000000', group: 'style' },
      { name: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'padding', label: 'Padding', type: 'number', defaultValue: 12, group: 'style' },
      { name: 'overflow', label: 'Overflow', type: 'select', defaultValue: 'auto', options: ['auto', 'hidden', 'scroll'], group: 'style' },
    ],
  },
  {
    type: 'hg_window',
    name: 'Window',
    icon: '🪟',
    defaultSize: { width: 450, height: 350 },
    properties: [
      { name: 'showBackground', label: 'Show Background', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'backgroundColor', label: 'Background Color', type: 'color', defaultValue: '#808080', group: 'style' },
      { name: 'enableBlur', label: 'Enable Blur', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'blurDegree', label: 'Blur Degree', type: 'number', defaultValue: 225, group: 'general' },
    ],
  },
  {
    type: 'hg_canvas',
    name: 'Canvas',
    icon: '🎨',
    defaultSize: { width: 300, height: 200 },
    properties: [
      { name: 'backgroundColor', label: 'Background Color', type: 'color', defaultValue: '#ffffff', group: 'style' },
      { name: 'border', label: 'Border', type: 'string', defaultValue: '1px solid #cccccc', group: 'style' },
      { name: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 4, group: 'style' },
      { name: 'overflow', label: 'Overflow', type: 'select', defaultValue: 'hidden', options: ['hidden', 'auto', 'scroll', 'visible'], group: 'style' },
    ],
  },
  {
    type: 'hg_list',
    name: 'List',
    icon: '📋',
    defaultSize: { width: 300, height: 400 },
    properties: [
      { name: 'itemWidth', label: 'Item Width', type: 'number', defaultValue: 100, group: 'style' },
      { name: 'itemHeight', label: 'Item Height', type: 'number', defaultValue: 100, group: 'style' },
      { name: 'space', label: 'Item Spacing', type: 'number', defaultValue: 5, group: 'style' },
      { name: 'direction', label: 'Direction', type: 'select', defaultValue: 'VERTICAL', options: ['VERTICAL', 'HORIZONTAL'], group: 'style' },
      { name: 'style', label: 'Style', type: 'select', defaultValue: 'LIST_CLASSIC', options: ['LIST_CLASSIC', 'LIST_CIRCLE', 'LIST_ZOOM', 'LIST_CARD', 'LIST_FADE', 'LIST_FAN', 'LIST_HELIX', 'LIST_CURL'], group: 'style' },
      { name: 'cardStackLocation', label: 'Stack Location Distance', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'noteNum', label: 'Item Count', type: 'number', defaultValue: 5, group: 'data' },
      { name: 'autoAlign', label: 'Auto Align', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'inertia', label: 'Inertia Scroll', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'loop', label: 'Loop Scroll', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'createBar', label: 'Show Scrollbar', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'offset', label: 'Initial Offset', type: 'number', defaultValue: 0, group: 'data' },
      { name: 'outScope', label: 'Out of Scope', type: 'number', defaultValue: 0, group: 'data' },
    ],
  },
  {
    type: 'hg_video',
    name: 'Video',
    icon: '🎬',
    defaultSize: { width: 320, height: 240 },
    properties: [
      { name: 'src', label: 'Video Path', type: 'string', group: 'data' },
      { name: 'autoplay', label: 'Autoplay', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: false, group: 'general' },
      { name: 'controls', label: 'Show Controls', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_3d',
    name: '3D Model',
    icon: '🧊',
    defaultSize: { width: 400, height: 400 },
    properties: [
      { name: 'modelPath', label: 'Model Path', type: 'string', group: 'data' },
      { name: 'drawType', label: 'Draw Type', type: 'select', defaultValue: 'L3_DRAW_FRONT_AND_SORT', options: ['L3_DRAW_FRONT_ONLY', 'L3_DRAW_FRONT_AND_BACK', 'L3_DRAW_FRONT_AND_SORT'], group: 'data' },
      { name: 'worldX', label: 'World X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'worldY', label: 'World Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'worldZ', label: 'World Z', type: 'number', defaultValue: 30, group: 'style' },
      { name: 'rotationX', label: 'Rotation X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'rotationY', label: 'Rotation Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'rotationZ', label: 'Rotation Z', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'scale', label: 'Scale', type: 'number', defaultValue: 5, group: 'style' },
      { name: 'cameraPosX', label: 'Camera X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraPosY', label: 'Camera Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraPosZ', label: 'Camera Z', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookX', label: 'Look At X', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookY', label: 'Look At Y', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'cameraLookZ', label: 'Look At Z', type: 'number', defaultValue: 1, group: 'style' },
    ],
  },
  {
    type: 'hg_arc',
    name: 'Arc',
    icon: '🌙',
    defaultSize: { width: 96, height: 96 },
    properties: [
      { name: 'radius', label: 'Radius', type: 'number', defaultValue: 40, group: 'style' },
      { name: 'startAngle', label: 'Start Angle', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'endAngle', label: 'End Angle', type: 'number', defaultValue: 270, group: 'style' },
      { name: 'strokeWidth', label: 'Stroke Width', type: 'number', defaultValue: 8, group: 'style' },
      { name: 'color', label: 'Color', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: 'Opacity', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: 'Enable Gradient', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'arcGroup', label: 'Arc Group', type: 'string', defaultValue: '', group: 'general' },
    ],
  },
  {
    type: 'hg_circle',
    name: 'Circle',
    icon: '🔵',
    defaultSize: { width: 80, height: 80 },
    properties: [
      { name: 'radius', label: 'Radius', type: 'number', defaultValue: 40, group: 'style' },
      { name: 'fillColor', label: 'Fill Color', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: 'Opacity', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: 'Enable Gradient', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'gradientType', label: 'Gradient Type', type: 'select', defaultValue: 'radial', options: ['radial', 'angular'], group: 'style' },
    ],
  },
  {
    type: 'hg_rect',
    name: 'Rectangle',
    icon: '▭',
    defaultSize: { width: 120, height: 80 },
    properties: [
      { name: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 0, group: 'style' },
      { name: 'fillColor', label: 'Fill Color', type: 'color', defaultValue: '#007acc', group: 'style' },
      { name: 'opacity', label: 'Opacity', type: 'number', defaultValue: 255, group: 'style' },
      { name: 'useGradient', label: 'Enable Gradient', type: 'boolean', defaultValue: false, group: 'style' },
      { name: 'gradientDirection', label: 'Gradient Direction', type: 'select', defaultValue: 'horizontal', options: ['horizontal', 'vertical', 'diagonal_tl_br', 'diagonal_tr_bl'], group: 'style' },
    ],
  },
  {
    type: 'hg_svg',
    name: 'SVG',
    icon: '🎨',
    defaultSize: { width: 100, height: 100 },
    properties: [
      { name: 'src', label: 'SVG Path', type: 'string', group: 'data' },
    ],
  },
  {
    type: 'hg_lottie',
    name: 'Lottie Animation',
    icon: '🎬',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: 'Animation Path', type: 'string', group: 'data' },
      { name: 'autoplay', label: 'Autoplay', type: 'boolean', defaultValue: true, group: 'general' },
      { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: true, group: 'general' },
    ],
  },
  {
    type: 'hg_glass',
    name: 'Glass Effect',
    icon: '🔮',
    defaultSize: { width: 150, height: 150 },
    properties: [
      { name: 'src', label: 'Shape Path', type: 'string', group: 'data' },
      { name: 'distortion', label: 'Distortion (%)', type: 'number', defaultValue: 10, group: 'data' },
      { name: 'region', label: 'Effect Range (%)', type: 'number', defaultValue: 50, group: 'data' },
      { name: 'movable', label: 'Movable', type: 'boolean', defaultValue: false, group: 'interaction' },
      { name: 'click', label: 'Click', type: 'boolean', defaultValue: false, group: 'interaction' },
    ],
  },
];

// Component categories - hg_time_label 不在组件库中直接显示，只能通过右键标签控件创建
const componentCategories = [
  { name: 'Containers', types: ['hg_view', 'hg_window', 'hg_canvas', 'hg_list'] },
  { name: 'Basic Controls', types: ['hg_button', 'hg_label', 'hg_image'] },
  { name: 'Input Controls', types: ['hg_input', 'hg_checkbox', 'hg_radio'] },
  { name: 'Graphics', types: ['hg_arc', 'hg_circle', 'hg_rect', 'hg_svg', 'hg_glass'] },
  { name: 'Multimedia', types: ['hg_video', 'hg_3d', 'hg_lottie'] }
];

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onComponentDragStart, onCreateComponent }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(componentCategories.map(c => c.name))
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    componentType: '',
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible]);

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('component-type', type);
    onComponentDragStart(type);
  };

  const handleContextMenu = (e: React.MouseEvent, componentType: string) => {
    // 只有有高级变体的组件才显示右键菜单
    if (!advancedVariants[componentType]) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      componentType,
    });
  };

  const handleVariantClick = (variantType: ComponentType) => {
    // 直接在当前 view 中创建组件
    if (onCreateComponent) {
      onCreateComponent(variantType);
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
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

  const variants = advancedVariants[contextMenu.componentType] || [];

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
                <span className="category-name">{t(category.name as any)}</span>
              </div>
              {isExpanded && (
                <div className="category-content">
                  {components.map((component) => (
                    <div
                      key={component.type}
                      className="component-item"
                      draggable
                      onDragStart={(e) => handleDragStart(e, component.type)}
                      onContextMenu={(e) => handleContextMenu(e, component.type)}
                      title={t(component.name as any)}
                    >
                      <div className="component-icon">{component.icon}</div>
                      <div className="component-name">{t(component.name as any)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && variants.length > 0 && (
        <div
          ref={menuRef}
          className="component-library-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-header">{t('Advanced Widgets' as any)}</div>
          {variants.map((variant) => (
            <div
              key={variant.type}
              className="context-menu-item"
              onClick={() => handleVariantClick(variant.type)}
            >
              <span className="context-menu-icon">{variant.icon}</span>
              <span className="context-menu-label">{t(variant.label as any)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
export { componentDefinitions };
