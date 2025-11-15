import React, { useEffect } from 'react';
import { useDesignerStore } from './store';
import DesignerCanvas from './components/DesignerCanvas';
import ComponentLibrary from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import ComponentTree from './components/ComponentTree';
import Toolbar from './components/Toolbar';
import { Component } from './types';
import useKeyboardShortcuts from './utils/keyboardShortcuts';
import './App.css';

// 从types.ts导入已有的Window接口扩展
import './types';

const App: React.FC = () => {
  const {
    setVSCodeAPI,
    setComponents,
    selectComponent,
    addComponent,
  } = useDesignerStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // 安全初始化VSCode API（确保只使用已有的实例）
  useEffect(() => {
    // 添加错误处理
    const handleGlobalError = (e: ErrorEvent) => {
      console.error('[HoneyGUI Designer] Global error:', e.error);
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c62828;color:white;padding:10px;z-index:9999;font-family:monospace;font-size:12px;white-space:pre-wrap;';
      errorDiv.textContent = '错误: ' + (e.error?.message || 'Unknown error') + '\n' + (e.error?.stack || 'No stack trace');
      document.body.appendChild(errorDiv);
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      console.error('[HoneyGUI Designer] Unhandled promise rejection:', e.reason);
    };

    // 检查是否已经有VSCode API实例
    if (!window.vscodeAPI) {
      console.warn('[HoneyGUI App] VSCode API not initialized yet, will retry...');
      return;
    }
    
    // 使用现有的API实例，绝对不尝试重新获取
    setVSCodeAPI(window.vscodeAPI);
    console.log('[HoneyGUI App] Using existing VSCode API instance');

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'loadHml':
          if (message.components) {
            setComponents(message.components);
          }
          break;

        case 'showMessage':
          // Show success message
          console.log(message.text);
          break;

        case 'error':
          // Show error message
          console.error(message.text);
          break;
      }
    });

    // 添加错误监听器
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 检查React是否渲染成功
    setTimeout(() => {
      if (!document.getElementById('root')?.hasChildNodes()) {
        console.error('[HoneyGUI Designer] React app did not render!');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#c62828;color:white;padding:20px;border-radius:4px;font-family:monospace;';
        errorDiv.innerHTML = '<h3>React App 未渲染</h3><p>请检查控制台查看错误详情</p>';
        document.body.appendChild(errorDiv);
      }
    }, 2000);

    // Load existing design if any
    window.vscodeAPI?.postMessage({
      command: 'loadFile',
    });

    // 清理函数
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [setVSCodeAPI, setComponents]);

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('component-type') as any;

    if (componentType) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / 1); // Adjust for zoom if needed
      const y = Math.round((e.clientY - rect.top) / 1);

      const newComponent: Component = {
        id: `${componentType}_${Date.now()}`,
        type: componentType,
        name: `${componentType}_${Date.now().toString().slice(-4)}`,
        position: {
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: 100,
          height: 32,
        },
        visible: true,
        enabled: true,
        locked: false,
        zIndex: 1,
        children: [],
        parent: null,
        data: {
          text: componentType === 'button' ? 'Button' : componentType === 'label' ? 'Label' : '',
        },
      };

      addComponent(newComponent);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasClick = () => {
    selectComponent(null);
  };

  const handleComponentSelect = (id: string | null) => {
    selectComponent(id);
  };

  return (
    <div className="app">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel - Component Library and Tree */}
        <div className="left-panel">
          <ComponentLibrary onComponentDragStart={() => {}} />
          <div className="panel-divider" />
          <ComponentTree />
        </div>

        {/* Center - Canvas */}
        <div
          className="canvas-container"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onClick={handleCanvasClick}
        >
          <DesignerCanvas onComponentSelect={handleComponentSelect} />
        </div>

        {/* Right Panel - Properties */}
        <div className="right-panel">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
};

export default App;
