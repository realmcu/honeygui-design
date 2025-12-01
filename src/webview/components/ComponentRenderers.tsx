import React from 'react';
import { Component } from '../types';
import { ImageComponent } from './ImageComponent';

/**
 * 组件渲染器的通用 Props
 */
interface ComponentRendererProps {
  component: Component;
  style: React.CSSProperties;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };
  children?: React.ReactNode;
}

/**
 * 按钮组件渲染器
 */
export const ButtonRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <button
    key={component.id}
    style={style}
    {...handlers}
    disabled={!component.enabled}
  >
    {component.data?.text || component.name}
  </button>
);

/**
 * 标签组件渲染器
 */
export const LabelRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <div key={component.id} style={style} {...handlers}>
    {component.data?.text || component.name}
  </div>
);

/**
 * 文本组件渲染器
 */
export const TextRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <span key={component.id} style={style} {...handlers}>
    {component.data?.text || component.name}
  </span>
);

/**
 * 输入框组件渲染器
 */
export const InputRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <input
    key={component.id}
    style={style}
    placeholder={component.data?.placeholder}
    {...handlers}
  />
);

/**
 * 复选框组件渲染器
 */
export const CheckboxRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <label key={component.id} style={style} {...handlers}>
    <input type="checkbox" checked={!!component.data?.checked} onChange={() => {}} />
    {component.data?.label || component.name}
  </label>
);

/**
 * 单选按钮组件渲染器
 */
export const RadioRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <label key={component.id} style={style} {...handlers}>
    <input type="radio" checked={!!component.data?.checked} onChange={() => {}} />
    {component.data?.label || component.name}
  </label>
);

/**
 * 进度条组件渲染器
 */
export const ProgressBarRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <div key={component.id} style={style} {...handlers}>
    <div
      style={{
        width: `${component.data?.value || 0}%`,
        height: '100%',
        backgroundColor: '#007ACC',
      }}
    />
  </div>
);

/**
 * 滑块组件渲染器
 */
export const SliderRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <input
    key={component.id}
    type="range"
    style={style}
    value={Number(component.data?.value) || 0}
    onChange={() => {}} // 只读，但需要 onChange 避免警告
    {...handlers}
  />
);

/**
 * 容器组件渲染器（View/Panel/Window）
 */
export const ContainerRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers, children }) => (
  <div key={component.id} style={style} {...handlers}>
    {children}
  </div>
);

/**
 * 图片组件渲染器
 */
export const ImageRenderer: React.FC<ComponentRendererProps> = ({ component, style, handlers }) => (
  <ImageComponent
    component={component}
    style={style}
    onMouseDown={handlers.onMouseDown}
    onMouseEnter={handlers.onMouseEnter}
    onMouseLeave={handlers.onMouseLeave}
    onContextMenu={handlers.onContextMenu}
  />
);

/**
 * 组件类型到渲染器的映射
 */
export const componentRenderers: Record<string, React.FC<ComponentRendererProps>> = {
  hg_button: ButtonRenderer,
  hg_label: LabelRenderer,
  hg_text: TextRenderer,
  hg_input: InputRenderer,
  hg_checkbox: CheckboxRenderer,
  hg_radio: RadioRenderer,
  hg_progressbar: ProgressBarRenderer,
  hg_slider: SliderRenderer,
  hg_view: ContainerRenderer,
  hg_window: ContainerRenderer,
  hg_screen: ContainerRenderer,
  hg_image: ImageRenderer,
};
