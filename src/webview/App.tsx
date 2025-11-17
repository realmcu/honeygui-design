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

  /**
   * 处理画布上的拖放事件，添加新组件到设计器
   * 支持组件拖放逻辑：
   * 1. View组件可以作为顶级容器放置，实现多容器并行布局
   * 2. 普通组件（按钮、标签等）默认放置在screen容器内
   * 3. 根据组件类型设置合适的默认尺寸
   * 
   * @param e 拖放事件对象，包含拖拽源信息和放置位置
   */
  const handleCanvasDrop = (e: React.DragEvent) => {
    // 阻止默认拖放行为，确保自定义逻辑正常工作
    e.preventDefault();
    
    // 从拖拽数据中获取组件类型
    const componentType = e.dataTransfer.getData('component-type') as any;

    if (componentType) {
      // 获取画布元素的边界矩形，用于计算相对位置
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      
      // 计算鼠标在画布中的相对位置
      const x = Math.round((e.clientX - rect.left) / 1); // 后续可根据需要添加缩放调整
      const y = Math.round((e.clientY - rect.top) / 1);

      // 获取当前所有组件，查找顶级screen容器
      const components = useDesignerStore.getState().components;
      const screenContainer = components.find(comp => comp.type === 'screen' && comp.parent === null);
      
      // 创建新组件配置对象
      const newComponent: Component = {
        id: `${componentType}_${Date.now()}`, // 生成唯一ID
        type: componentType,
        name: `${componentType}_${Date.now().toString().slice(-4)}`, // 生成可读名称
        position: {
          x: Math.max(0, x), // 确保不出现负数坐标
          y: Math.max(0, y),
          // View组件设置更大的默认尺寸，作为容器使用
          width: componentType === 'view' ? 200 : 100,
          height: componentType === 'view' ? 150 : 32,
        },
        visible: true,
        enabled: true,
        locked: false,
        zIndex: 1,
        children: [], // 初始化空的子组件列表
        parent: null, // 默认没有父组件
        data: {
          // 根据组件类型设置默认文本内容
          text: componentType === 'button' ? 'Button' : componentType === 'label' ? 'Label' : '',
        },
      };

      // 布局策略：
      // - View组件和Screen组件：可以作为顶级组件直接放在画布上
      // - 其他组件（按钮、标签等）：默认放在screen容器内作为子组件
      if (componentType !== 'view' && componentType !== 'screen' && screenContainer) {
        // 设置父组件为screen容器
        newComponent.parent = screenContainer.id;
        
        // 调整位置，使其相对于screen容器内部坐标系统
        const screenX = screenContainer.position.x || 0;
        const screenY = screenContainer.position.y || 0;
        // 计算相对于容器内部的坐标，并确保至少有10px的边距
        newComponent.position.x = Math.max(10, x - screenX);
        newComponent.position.y = Math.max(10, y - screenY);
        
        console.debug(`添加组件${newComponent.type}到screen容器，内部坐标: (${newComponent.position.x}, ${newComponent.position.y})`);
      } else if (componentType === 'view') {
        console.debug(`添加独立View容器，坐标: (${newComponent.position.x}, ${newComponent.position.y})`);
      }

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
