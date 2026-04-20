import React from 'react';
import { WidgetProps } from './types';

export const CheckboxWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const text = component.data?.text || '';
  const checked = component.data?.checked ?? component.data?.value ?? false;
  const fontSize = component.data?.fontSize || 16;
  const color = component.style?.color || component.data?.color;

  return (
    <label key={component.id} style={{ ...style, display: 'flex', alignItems: 'center', gap: '4px' }} {...handlers}>
      <input type="checkbox" checked={!!checked} onChange={() => {}} />
      <span style={{ fontSize: `${fontSize}px`, color: color || undefined }}>{text}</span>
    </label>
  );
};
