import React from 'react';
import { WidgetProps } from './types';

export const SliderWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const value = Number(component.data?.value ?? 50);
  const min = Number(component.data?.min ?? 0);
  const max = Number(component.data?.max ?? 100);
  const w = component.position?.width || 200;
  const h = component.position?.height || 20;
  const isVertical = h > w;

  const ratio = max > min ? (value - min) / (max - min) : 0.5;

  // 短边决定 knob 和轨道的粗细
  const shortSide = isVertical ? w : h;
  const trackThickness = shortSide;
  const knobSize = shortSide;

  if (isVertical) {
    // 纵向模式：轨道沿垂直方向，值从下到上增长
    const knobY = (1 - ratio) * (h - knobSize);

    return (
      <div
        key={component.id}
        style={style}
        {...handlers}
      >
        {/* Track background */}
        <div style={{
          position: 'absolute',
          left: (w - trackThickness) / 2,
          top: 0,
          width: trackThickness,
          height: h,
          borderRadius: trackThickness / 2,
          backgroundColor: '#1a2d40',
        }} />
        {/* Track fill (from bottom) */}
        <div style={{
          position: 'absolute',
          left: (w - trackThickness) / 2,
          top: knobY + knobSize / 2,
          width: trackThickness,
          height: Math.max(0, h - (knobY + knobSize / 2)),
          borderRadius: trackThickness / 2,
          backgroundColor: '#2196F3',
        }} />
        {/* Knob */}
        <div style={{
          position: 'absolute',
          left: (w - knobSize) / 2,
          top: knobY,
          width: knobSize,
          height: knobSize,
          borderRadius: '50%',
          backgroundColor: '#29b6f6',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </div>
    );
  }

  // 横向模式
  const knobX = ratio * (w - knobSize);

  return (
    <div
      key={component.id}
      style={style}
      {...handlers}
    >
      {/* Track background */}
      <div style={{
        position: 'absolute',
        top: (h - trackThickness) / 2,
        left: 0,
        width: w,
        height: trackThickness,
        borderRadius: trackThickness / 2,
        backgroundColor: '#1a2d40',
      }} />
      {/* Track fill (from left) */}
      <div style={{
        position: 'absolute',
        top: (h - trackThickness) / 2,
        left: 0,
        width: knobX + knobSize / 2,
        height: trackThickness,
        borderRadius: trackThickness / 2,
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
