import React from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const SvgWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const src = component.data?.src;
  const webviewUri = useWebviewUri(src);

  return (
    <div style={{ ...style, display: style?.display === 'none' ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }} {...handlers}>
      {webviewUri ? (
        <img src={webviewUri} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="SVG" draggable={false} />
      ) : (
        <span style={{ fontSize: 32 }}>🎨</span>
      )}
    </div>
  );
};
