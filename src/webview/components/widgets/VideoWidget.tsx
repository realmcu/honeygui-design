import React from 'react';
import { WidgetProps } from './types';

export const VideoWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const videoPath = component.data?.src as string;
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {videoPath ? (
        <video 
          src={videoPath}
          controls
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain',
            background: '#000'
          }}
        >
          您的浏览器不支持视频播放
        </video>
      ) : (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(100, 100, 100, 0.2)',
          border: '2px dashed rgba(150, 150, 150, 0.5)',
          color: 'rgba(100, 100, 100, 0.8)',
          fontSize: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎬</div>
          <div>视频组件</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>设置 src 属性</div>
        </div>
      )}
    </div>
  );
};
