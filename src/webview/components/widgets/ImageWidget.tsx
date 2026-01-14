import React from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const ImageWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const webviewUri = useWebviewUri(component.data?.src);

  return (
    <div
      style={{
        ...style,
        backgroundImage: webviewUri ? `url(${webviewUri})` : undefined,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
      }}
      {...handlers}
    >
      {!webviewUri && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #666',
          borderRadius: '4px',
          backgroundColor: 'rgba(128,128,128,0.1)',
          color: '#888',
          fontSize: '12px',
          gap: '4px',
          boxSizing: 'border-box'
        }}>
          <span style={{ fontSize: '24px' }}>🖼️</span>
          <span>选择图片</span>
        </div>
      )}
    </div>
  );
};
