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
  const opacity = s.opacity !== undefined ? s.opacity / 255 : 1;

  // 圆心在组件中心
  const cx = width / 2;
  const cy = height / 2;

  // 计算角度跨度
  let angleSpan = endAngle - startAngle;
  if (angleSpan <= 0) angleSpan += 360;

  // 检查是否为完整圆弧（360度）
  const isFullCircle = Math.abs(angleSpan - 360) < 0.01;

  // SDK 使用标准数学坐标系：0度在3点钟方向（最右边），逆时针为正
  // SVG 使用顺时针方向，所以需要取负值
  const startRad = startAngle * Math.PI / 180;
  const endRad = endAngle * Math.PI / 180;

  // 计算弧线路径
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  // 判断是否大于180度
  const largeArcFlag = angleSpan > 180 ? 1 : 0;

  // 完整圆弧使用两个半圆弧拼接
  let pathD: string;
  if (isFullCircle) {
    // 完整圆弧：使用两个半圆弧
    const midRad = (startAngle + 180) * Math.PI / 180;
    const xMid = cx + radius * Math.cos(midRad);
    const yMid = cy + radius * Math.sin(midRad);
    pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${xMid} ${yMid} A ${radius} ${radius} 0 1 1 ${x1} ${y1}`;
  } else {
    pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  }

  // 端点样式：SDK 默认使用圆角封端
  const strokeLinecap = 'round';

  return (
    <div style={{ ...style, overflow: 'visible' }} {...handlers}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={strokeLinecap}
          strokeOpacity={opacity}
        />
      </svg>
    </div>
  );
};
