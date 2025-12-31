import { useState, useEffect, useRef } from 'react';

export interface GlyphCheckResult {
  supported: boolean;
  missingChars: string[];
  isChecking: boolean;
}

// 存储待处理的请求回调
const pendingRequests = new Map<string, (result: { supported: boolean; missingChars: string[] }) => void>();

// 监听后端返回的结果
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'fontGlyphCheckResult' && message.requestId) {
      const callback = pendingRequests.get(message.requestId);
      if (callback) {
        callback({
          supported: message.supported,
          missingChars: message.missingChars || []
        });
        pendingRequests.delete(message.requestId);
      }
    }
  });
}

/**
 * 检测字体是否支持指定文本中的所有字符
 * 通过后端解析 TTF 文件的 cmap 表获取支持的字符集
 * 
 * @param fontFamily 字体名称（前端使用，用于触发检测）
 * @param text 要检测的文本
 * @param fontPath 字体文件路径（如 /font/xxx.ttf）
 * @returns { supported, missingChars, isChecking }
 */
export function useFontGlyphCheck(
  fontFamily: string | undefined,
  text: string | undefined,
  fontPath?: string | undefined
): GlyphCheckResult {
  const [result, setResult] = useState<GlyphCheckResult>({
    supported: true,
    missingChars: [],
    isChecking: false,
  });
  
  // 跟踪当前检测的参数
  const checkIdRef = useRef(0);

  useEffect(() => {
    // 如果没有字体路径或文本，不需要检测
    if (!fontPath || !text) {
      setResult({ supported: true, missingChars: [], isChecking: false });
      return;
    }

    const currentCheckId = ++checkIdRef.current;
    const requestId = `glyph-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setResult(prev => ({ ...prev, isChecking: true }));

    // 注册回调
    pendingRequests.set(requestId, (checkResult) => {
      // 确保还是当前的检测请求
      if (checkIdRef.current === currentCheckId) {
        setResult({
          supported: checkResult.supported,
          missingChars: checkResult.missingChars,
          isChecking: false,
        });
      }
    });

    // 发送请求到后端
    const vscodeAPI = (window as any).vscodeAPI;
    if (vscodeAPI) {
      vscodeAPI.postMessage({
        command: 'checkFontGlyphs',
        fontPath,
        text,
        requestId
      });
    } else {
      // 如果没有 vscodeAPI，直接返回支持
      pendingRequests.delete(requestId);
      setResult({ supported: true, missingChars: [], isChecking: false });
    }

    // 超时处理（5秒）
    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        if (checkIdRef.current === currentCheckId) {
          setResult({ supported: true, missingChars: [], isChecking: false });
        }
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
    };
  }, [fontPath, text]);

  return result;
}
