import React from 'react';
import { WidgetProps } from './types';
import { useFontLoader } from '../../hooks/useFontLoader';

export const TextWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const fontPath = component.data?.fontFile;
  const { fontFamily } = useFontLoader(fontPath);

  const textStyle: React.CSSProperties = {
    ...style,
    fontFamily: fontFamily || 'inherit',
    fontSize: component.data?.fontSize || 16,
    color: component.style?.color || 'inherit',
  };

  return (
    <span key={component.id} style={textStyle} {...handlers}>
      {component.data?.text || component.name}
    </span>
  );
};
