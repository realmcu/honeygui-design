import React from 'react';
import { WidgetProps } from './types';

export const RadioWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <label key={component.id} style={style} {...handlers}>
    <input type="radio" checked={!!component.data?.checked} onChange={() => {}} />
    {component.data?.label || component.name}
  </label>
);
