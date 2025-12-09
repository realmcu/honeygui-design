import React, { useState } from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const VideoWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const videoPath = component.data?.src as string;
  const webviewUri = useWebviewUri(videoPath);
  const [error, setError] = useState(false);
  const fileName = videoPath ? videoPath.split('/').pop() : '';
  
  // 没有设置路径或加载失败时显示占位符
  if (!webviewUri || error) {
    return (
      <div key={component.id} style={style} {...handlers}>
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: videoPath ? '#1a1a2e' : 'rgba(100, 100, 100, 0.2)',
          border: videoPath ? 'none' : '2px dashed rgba(150, 150, 150, 0.5)',
          color: videoPath ? '#fff' : 'rgba(100, 100, 100, 0.8)',
          fontSize: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>
            {videoPath ? '▶️' : '🎬'}
          </div>
          <div>{videoPath ? fileName : '视频组件'}</div>
          {!videoPath && <div style={{ fontSize: '10px', marginTop: '4px' }}>设置 src 属性</div>}
        </div>
      </div>
    );
  }

  return (
    <div key={component.id} style={style} {...handlers}>
      <video 
        src={webviewUri}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        onLoadedData={(e) => {
          (e.target as HTMLVideoElement).currentTime = 0.1;
        }}
        onError={() => setError(true)}
      />
    </div>
  );
};
