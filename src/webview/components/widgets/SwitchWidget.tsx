import React from 'react';
import { WidgetProps } from './types';

export const SwitchWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const checked = component.data?.checked === true || component.data?.checked === 'true'
    || component.data?.value === true || component.data?.value === 'true';
  const w = component.position?.width || 50;
  const h = component.position?.height || 28;
  const padding = Math.max(2, h * 0.08);
  const knobSize = h - padding * 2;

  return (
    <div
      key={component.id}
      style={{
        ...style,
        backgroundColor: checked ? '#2196F3' : '#455a64',
        borderRadius: h / 2,
        position: 'relative',
        cursor: 'pointer',
      }}
      {...handlers}
    >
      <div
        style={{
          position: 'absolute',
          top: padding,
          left: checked ? w - knobSize - padding : padding,
          width: knobSize,
          height: knobSize,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
};
