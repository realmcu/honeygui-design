import React from 'react';
import { WidgetProps } from './types';

export const ArcWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const width = component.position?.width ?? 100;
  const height = component.position?.height ?? 100;
  const s = component.style || {};
  
  const radius = s.radius ?? 40;
  const startAngle = s.startAngle ?? 0;
  const endAngle = s.endAngle ?? 270;
  const strokeWidth = s.strokeWidth ?? 8;
  const color = s.color ?? '#007acc';
  const cap = s.cap ?? 'BUTT';

  // 圆心在组件中心
  const cx = width / 2;
  const cy = height / 2;

  // 转换角度为弧度（SVG 使用顺时针，从3点钟方向开始）
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;

  // 计算弧线路径
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  // 判断是否大于180度
  const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;

  const pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

  // 端点样式映射
  const strokeLinecap = cap === 'ROUND' ? 'round' : cap === 'SQUARE' ? 'square' : 'butt';

  return (
    <div style={{ ...style, overflow: 'visible' }} {...handlers}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={strokeLinecap}
        />
      </svg>
    </div>
  );
};
