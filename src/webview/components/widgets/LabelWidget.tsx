import React from 'react';
import { WidgetProps } from './types';

export const LabelWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <div key={component.id} style={style} {...handlers}>
    {component.data?.text || component.name}
  </div>
);
