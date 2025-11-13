/**
 * HoneyGUI Designer Webview Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
// 从types.ts导入已有的Window接口扩展
import './types';

// 扩展Window接口，添加vscodeAPI属性
declare global {
  interface Window {
    vscodeAPI?: any;
  }
}

// 安全初始化VSCode API，确保只获取一次
if (!window.vscodeAPI) {
  try {
    // 尝试获取VS Code API
    window.vscodeAPI = window.acquireVsCodeApi?.();
    console.log('[HoneyGUI] VSCode API initialized successfully');
  } catch (error) {
    console.error('[HoneyGUI] Error acquiring VSCode API:', error);
    // 即使获取失败，也确保vscodeAPI存在，避免后续代码重复尝试
    window.vscodeAPI = {
      postMessage: () => console.warn('VSCode API not available'),
      setState: () => {},
      getState: () => null
    };
  }
} else {
  console.log('[HoneyGUI] VSCode API already initialized, reusing existing instance');
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} else {
  // Fallback: create root element if it doesn't exist
  const newRootElement = document.createElement('div');
  newRootElement.id = 'root';
  document.body.appendChild(newRootElement);

  const root = ReactDOM.createRoot(newRootElement);
  root.render(<App />);
}
