import React from 'react';
import { WidgetProps } from './types';

export const ListItemWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => {
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
