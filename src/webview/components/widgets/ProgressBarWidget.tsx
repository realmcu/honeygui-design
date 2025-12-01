import React from 'react';
import { WidgetProps } from './types';

export const ProgressBarWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => (
  <div key={component.id} style={style} {...handlers}>
    <div
      style={{
        width: `${component.data?.value || 0}%`,
        height: '100%',
        backgroundColor: '#007ACC',
      }}
    />
  </div>
);
