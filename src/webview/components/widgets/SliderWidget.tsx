import React from 'react';
import { WidgetProps } from './types';

export const SliderWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const value = Number(component.data?.value ?? 50);
  const min = Number(component.data?.min ?? 0);
  const max = Number(component.data?.max ?? 100);
  const w = component.position?.width || 200;
  const h = component.position?.height || 20;

  const ratio = max > min ? (value - min) / (max - min) : 0.5;
  const trackH = Math.max(6, h * 0.4);
  const knobSize = Math.max(trackH + 6, h * 0.9);
  const knobX = ratio * (w - knobSize);

  return (
    <div
      key={component.id}
      style={{ ...style, position: 'relative' }}
      {...handlers}
    >
      {/* Track background (right / inactive part) */}
      <div style={{
        position: 'absolute',
        top: (h - trackH) / 2,
        left: 0,
        width: w,
        height: trackH,
        borderRadius: trackH / 2,
        backgroundColor: '#1a2d40',
      }} />
      {/* Track fill (left / active part) */}
      <div style={{
        position: 'absolute',
        top: (h - trackH) / 2,
        left: 0,
        width: knobX + knobSize / 2,
        height: trackH,
        borderRadius: trackH / 2,
        backgroundColor: '#2196F3',
      }} />
      {/* Knob */}
      <div style={{
        position: 'absolute',
        top: (h - knobSize) / 2,
        left: knobX,
        width: knobSize,
        height: knobSize,
        borderRadius: '50%',
        backgroundColor: '#29b6f6',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
};
