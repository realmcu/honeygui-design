import React from 'react';
import { WidgetProps } from './types';

export const ContainerWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => (
  <div key={component.id} style={style} {...handlers}>
    {children}
  </div>
);
