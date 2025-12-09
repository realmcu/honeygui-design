import React from 'react';
import { WidgetProps } from './types';

export const LottieWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const src = component.data?.src;
  const autoplay = component.data?.autoplay ?? true;
  const loop = component.data?.loop ?? true;

  // 设计器中显示占位符，实际 Lottie 动画在运行时渲染
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--vscode-editor-background)',
        border: '1px dashed var(--vscode-editorWidget-border)',
      }}
      {...handlers}
    >
      <span style={{ fontSize: 32 }}>🎬</span>
      <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
        {src ? src.split('/').pop() : 'Lottie'}
      </span>
      <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)' }}>
        {autoplay ? '▶' : '⏸'} {loop ? '🔁' : ''}
      </span>
    </div>
  );
};
