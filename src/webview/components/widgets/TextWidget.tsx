import React from 'react';
import { WidgetProps } from './types';

export const TextWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <span key={component.id} style={style} {...handlers}>
    {component.data?.text || component.name}
  </span>
);
