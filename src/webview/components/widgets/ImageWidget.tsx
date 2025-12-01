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
      {!webviewUri && '🖼️'}
    </div>
  );
};
