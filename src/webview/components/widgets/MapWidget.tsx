import React from 'react';
import { WidgetProps } from './types';

export const MapWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const s = component.style || {};
  const borderRadius = s.borderRadius ?? 0;
  const opacity = s.opacity ?? 255;
  const iconSize = Math.max(Math.min(component.position.width, component.position.height) * 0.72, 48);

  return (
    <div
      style={{
        ...style,
        borderRadius,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(111, 196, 255, 0.08), rgba(111, 196, 255, 0.03))',
        opacity: opacity / 255,
      }}
      {...handlers}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${iconSize}px`,
          lineHeight: 1,
          opacity: 0.28,
          filter: 'saturate(0.9)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <span aria-hidden="true">🗺️</span>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 20% 18%, rgba(255,255,255,0.16), transparent 30%), radial-gradient(circle at 82% 78%, rgba(255,255,255,0.12), transparent 24%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};