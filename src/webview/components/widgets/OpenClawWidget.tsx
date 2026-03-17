import React from 'react';
import { WidgetProps } from './types';

export const OpenClawWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const s = component.style || {};
  const borderRadius = s.borderRadius ?? 8;
  const opacity = s.opacity ?? 255;
  const iconSize = Math.max(Math.min(component.position.width, component.position.height) * 0.5, 48);

  return (
    <div
      style={{
        ...style,
        borderRadius,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(156, 39, 176, 0.10))',
        opacity: opacity / 255,
      }}
      {...handlers}
    >
      {/* 聊天气泡装饰 */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          right: '10%',
          bottom: '40%',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          alignSelf: 'flex-end',
          background: 'rgba(33, 150, 243, 0.4)',
          borderRadius: 8,
          padding: '4px 8px',
          fontSize: 10,
          maxWidth: '70%',
        }}>
          ...
        </div>
        <div style={{
          alignSelf: 'flex-start',
          background: 'rgba(156, 39, 176, 0.4)',
          borderRadius: 8,
          padding: '4px 8px',
          fontSize: 10,
          maxWidth: '70%',
        }}>
          ...
        </div>
      </div>
      
      {/* 中心图标 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${iconSize}px`,
          lineHeight: 1,
          opacity: 0.35,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <span aria-hidden="true">🤖</span>
      </div>
      
      {/* 光效 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 35%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.10), transparent 25%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
