import React from 'react';
import { WidgetProps } from './types';

/**
 * Canvas 画布控件
 * 显示 SVG 内容预览，支持双击打开编辑器
 */
export const CanvasWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => {
  const svgContent = component.data?.svgContent as string | undefined;

  // 合并样式：添加网格背景表示画布
  const canvasStyle: React.CSSProperties = {
    ...style,
    backgroundImage: svgContent ? 'none' : `
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
    `,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: style?.backgroundColor || '#ffffff',
    overflow: 'hidden',
  };

  return (
    <div key={component.id} style={canvasStyle} {...handlers}>
      {svgContent ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '12px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '32px', marginBottom: '8px' }}>🎨</span>
          <span>双击编辑 SVG</span>
        </div>
      )}
      {children}
    </div>
  );
};
