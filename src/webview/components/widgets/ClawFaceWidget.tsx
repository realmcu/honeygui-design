import React from 'react';
import { WidgetProps } from './types';

export const ClawFaceWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const s = component.style || {};
  const borderRadius = s.borderRadius ?? Math.min(component.position.width, component.position.height) * 0.18;
  const opacity = s.opacity ?? 255;
  const faceSize = Math.max(Math.min(component.position.width, component.position.height) * 0.45, 36);

  return (
    <div
      style={{
        ...style,
        borderRadius,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), rgba(127,127,127,0.08) 45%, rgba(127,127,127,0.04) 100%)',
        opacity: opacity / 255,
      }}
      {...handlers}
    >
      <div
        style={{
          fontSize: `${faceSize}px`,
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))',
        }}
      >
        <span aria-hidden="true">😐</span>
      </div>
    </div>
  );
};