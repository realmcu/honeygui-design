import React from 'react';
import { WidgetProps } from './types';

export const InputWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <input
    key={component.id}
    style={style}
    placeholder={component.data?.placeholder}
    {...handlers}
  />
);
