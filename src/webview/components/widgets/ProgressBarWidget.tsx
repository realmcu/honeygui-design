import React from 'react';
import { WidgetProps } from './types';

export const ProgressBarWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const value = Number(component.data?.value ?? 0);
  const min = Number(component.data?.min ?? 0);
  const max = Number(component.data?.max ?? 100);
  const barColor = (component.style as any)?.color || '#00FF00';
  const trackColor = (component.style as any)?.backgroundColor || '#333333';
  const orientation = (component.style as any)?.orientation || 'horizontal';
  const w = component.position?.width || 200;
  const h = component.position?.height || 20;

  const isVertical = orientation === 'vertical';
  const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  const trackRadius = (isVertical ? w : h) / 2;

  if (isVertical) {
    const fillHeight = ratio * h;
    return (
      <div key={component.id} style={style} {...handlers}>
        {/* Track */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: trackRadius,
          backgroundColor: trackColor,
        }} />
        {/* Fill (from bottom) */}
        <div style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: w,
          height: fillHeight,
          borderRadius: trackRadius,
          backgroundColor: barColor,
        }} />
      </div>
    );
  }

  // Horizontal
  const fillWidth = ratio * w;
  return (
    <div key={component.id} style={style} {...handlers}>
      {/* Track */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        borderRadius: trackRadius,
        backgroundColor: trackColor,
      }} />
      {/* Fill (from left) */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: fillWidth,
        height: h,
        borderRadius: trackRadius,
        backgroundColor: barColor,
      }} />
    </div>
  );
};
