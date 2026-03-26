import React from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

/**
 * 将 0xFFRRGGBB 格式转换为 CSS rgba 颜色
 */
const argbToRgba = (argb: string | undefined, alpha: number = 1): string => {
  if (!argb || !argb.startsWith('0x')) return `rgba(255, 255, 255, ${alpha})`;
  const hex = argb.substring(4); // 去掉 0xFF
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ImageWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const webviewUri = useWebviewUri(component.data?.src);
  
  // 检查是否是 A8 模式
  const blendMode = component.data?.blendMode;
  const isA8FG = blendMode === 'IMG_2D_SW_FIX_A8_FG';
  const isA8BGFG = blendMode === 'IMG_2D_SW_FIX_A8_BGFG';
  const isA8Mode = isA8FG || isA8BGFG;
  
  // 获取前景色和背景色
  const fgColor = component.data?.fgColor;
  const bgColor = component.data?.bgColor;
  
  // A8 模式的样式处理
  let imageStyle: React.CSSProperties = {
    ...style,
  };
  
  if (webviewUri && isA8Mode) {
    // A8 模式：图片作为 alpha 通道，应用颜色
    // 使用双层结构：背景色层 + 前景色层（使用图片作为 mask）
    imageStyle = {
      ...style,
      position: 'relative',
      background: isA8BGFG && bgColor ? argbToRgba(bgColor) : 'transparent',
    };
  } else if (webviewUri) {
    // 普通模式：直接显示图片
    imageStyle = {
      ...style,
      backgroundImage: `url(${webviewUri})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
    };
  }

  return (
    <div style={imageStyle} {...handlers}>
      {webviewUri && isA8Mode ? (
        // A8 模式：使用 mask 应用前景色
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: fgColor ? argbToRgba(fgColor) : '#FFFFFF',
          WebkitMaskImage: `url(${webviewUri})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: `url(${webviewUri})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
        }} />
      ) : !webviewUri ? (
        // 未选择图片时的占位符
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
      ) : null}
    </div>
  );
};
