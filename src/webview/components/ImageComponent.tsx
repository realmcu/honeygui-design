import React from 'react';
import { Component } from '../types';
import { useWebviewUri } from '../hooks/useWebviewUri';

interface ImageComponentProps {
  component: Component;
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * 图片组件 - 使用 Hook 动态转换路径为 webview URI
 */
export const ImageComponent: React.FC<ImageComponentProps> = ({
  component,
  style,
  ...handlers
}) => {
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
