import React from 'react';
import { WidgetProps } from './types';

export const ButtonWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <button
    key={component.id}
    style={style}
    {...handlers}
    disabled={!component.enabled}
  >
    {component.data?.text || component.name}
  </button>
);
