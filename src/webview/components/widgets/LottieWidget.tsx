import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const LottieWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const src = component.data?.src;
  const autoplay = component.data?.autoplay ?? true;
  const loop = component.data?.loop ?? true;

  // 1. 获取 Webview 可访问的资源路径
  const webviewUri = useWebviewUri(src);
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 2. 加载 Lottie JSON 文件
  useEffect(() => {
    if (!webviewUri) {
      setAnimationData(null);
      setError(null);
      return;
    }

    setAnimationData(null);
    setError(null);

    fetch(webviewUri)
      .then(async (response) => {
        if (!response.ok) {
           throw new Error(`Failed to load: ${response.statusText}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error('Invalid JSON');
        }
      })
      .then((data) => {
        setAnimationData(data);
      })
      .catch((err) => {
        console.error('Error loading lottie:', err);
        setError(err.message);
      });
  }, [webviewUri]);

  // 占位符渲染逻辑（加载中、出错或无源文件时显示）
  const renderPlaceholder = () => (
    <>
      <span style={{ fontSize: 32 }}>🎬</span>
      <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
        {error ? 'Load Error' : (src ? src.split('/').pop() : 'Lottie')}
      </span>
      {error && (
        <span style={{ fontSize: 9, color: 'var(--vscode-errorForeground)' }}>
          {error}
        </span>
      )}
      {!error && (
        <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)' }}>
          {autoplay ? '▶' : '⏸'} {loop ? '🔁' : ''}
        </span>
      )}
    </>
  );

  // 3. 渲染 Lottie 组件或占位符
  return (
    <div
      style={{
        ...style,
        // 如果成功加载动画，移除背景色和边框以实现所见即所得
        display: animationData ? 'block' : 'flex',
        flexDirection: animationData ? undefined : 'column',
        alignItems: animationData ? undefined : 'center',
        justifyContent: animationData ? undefined : 'center',
        backgroundColor: animationData ? 'transparent' : 'var(--vscode-editor-background)',
        border: animationData ? undefined : '1px dashed var(--vscode-editorWidget-border)',
      }}
      {...handlers}
    >
      {animationData ? (
        <Lottie
          animationData={animationData}
          loop={loop}
          autoplay={autoplay}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        renderPlaceholder()
      )}
    </div>
  );
};
