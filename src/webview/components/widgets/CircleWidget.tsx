import React from 'react';
import { WidgetProps } from './types';

export const CircleWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const width = component.position?.width ?? 100;
  const height = component.position?.height ?? 100;
  const s = component.style || {};
  
  const radius = s.radius ?? 40;
  const fillColor = s.fillColor ?? '#007acc';
  const opacity = s.opacity !== undefined ? s.opacity / 255 : 1;

  // 圆心在组件中心
  const cx = width / 2;
  const cy = height / 2;

  return (
    <div style={{ ...style, overflow: 'visible' }} {...handlers}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fillColor}
          fillOpacity={opacity}
        />
      </svg>
    </div>
  );
};
