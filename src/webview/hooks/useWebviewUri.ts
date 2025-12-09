import { useState, useEffect } from 'react';

// 缓存已转换的路径
const uriCache = new Map<string, string>();

/**
 * 将相对路径转换为 webview URI
 */
export function useWebviewUri(relativePath: string | undefined): string | undefined {
  const [webviewUri, setWebviewUri] = useState<string | undefined>(() => {
    // 初始化时检查是否已经是完整URL或在缓存中
    if (!relativePath) return undefined;
    if (relativePath.startsWith('http') || relativePath.startsWith('vscode-resource') || relativePath.startsWith('data:')) {
      return relativePath;
    }
    if (uriCache.has(relativePath)) {
      return uriCache.get(relativePath);
    }
    // 需要转换，先返回undefined
    return undefined;
  });

  useEffect(() => {
    if (!relativePath) {
      setWebviewUri(undefined);
      return;
    }

    // 如果已经是完整 URL，直接返回
    if (relativePath.startsWith('http') || relativePath.startsWith('vscode-resource') || relativePath.startsWith('data:')) {
      setWebviewUri(relativePath);
      return;
    }

    // 检查缓存
    if (uriCache.has(relativePath)) {
      setWebviewUri(uriCache.get(relativePath));
      return;
    }

    // 请求后端转换
    const requestId = `convert_${Date.now()}_${Math.random()}`;
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'webviewUriConverted' && message.requestId === requestId) {
        if (!message.error) {
          uriCache.set(relativePath, message.uri);
          setWebviewUri(message.uri);
        } else {
          console.error('[useWebviewUri] 转换失败:', message.error);
          // 转换失败时保持undefined，不使用原路径
        }
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // 发送转换请求
    if (window.vscodeAPI) {
      window.vscodeAPI.postMessage({
        command: 'convertPathToWebviewUri',
        path: relativePath,
        requestId
      });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [relativePath]);

  return webviewUri;
}
