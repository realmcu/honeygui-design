import React from 'react';
import { WidgetProps } from './types';

export const RectWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const s = component.style || {};
  
  const borderRadius = s.borderRadius ?? 0;
  const fillColor = s.fillColor ?? '#007acc';
  const opacity = s.opacity ?? 255;

  const rectStyle: React.CSSProperties = {
    ...style,
    backgroundColor: fillColor,
    borderRadius: borderRadius,
    opacity: opacity / 255,
  };

  return <div style={rectStyle} {...handlers} />;
};
