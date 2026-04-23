import React from 'react';
import { WidgetProps } from './types';

export const SwitchWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const checked = component.data?.checked === true || component.data?.checked === 'true'
    || component.data?.value === true || component.data?.value === 'true';
  const w = component.position?.width || 50;
  const h = component.position?.height || 28;
  const isVertical = h > w;
  const shortSide = isVertical ? w : h;
  const padding = Math.max(2, shortSide * 0.08);
  const knobSize = shortSide - padding * 2;

  let knobLeft: number;
  let knobTop: number;

  if (isVertical) {
    // 纵向模式：圆形沿垂直方向移动
    knobLeft = padding;
    knobTop = checked ? padding : h - knobSize - padding;
  } else {
    // 横向模式：圆形沿水平方向移动
    knobLeft = checked ? w - knobSize - padding : padding;
    knobTop = padding;
  }

  return (
    <div
      key={component.id}
      style={{
        ...style,
        backgroundColor: checked ? '#2196F3' : '#455a64',
        borderRadius: shortSide / 2,
        cursor: 'pointer',
      }}
      {...handlers}
    >
      <div
        style={{
          position: 'absolute',
          top: knobTop,
          left: knobLeft,
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
