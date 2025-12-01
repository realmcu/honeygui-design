import React from 'react';
import { WidgetProps } from './types';

export const SliderWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <input
    key={component.id}
    type="range"
    style={style}
    value={Number(component.data?.value) || 0}
    onChange={() => {}}
    {...handlers}
  />
);
