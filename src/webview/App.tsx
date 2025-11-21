import React, { useEffect } from 'react';
import { useDesignerStore } from './store';
import DesignerCanvas from './components/DesignerCanvas';
import ComponentLibrary, { componentDefinitions } from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import ComponentTree from './components/ComponentTree';
import Toolbar from './components/Toolbar';
import { Component, ComponentType } from './types';
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
    setProjectConfig,
    setCanvasBackgroundColor,
  } = useDesignerStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // 安全初始化VSCode API（确保只使用已有的实例）
  useEffect(() => {
    // 立即打开 DevTools（调试用）
    // @ts-ignore
    if (window.vscodeAPI) {
      setTimeout(() => {
        // @ts-ignore
        if (window.vscodeAPI && window.chrome && (window.chrome as any).webview) {
          // @ts-ignore
          (window.chrome as any).webview.openDevTools();
        }
      }, 1000);
    }

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
          console.log('========== [Webview App] loadHml 消息处理开始 ==========');
          console.log('[Webview App] 接收到的组件数量:', message.components?.length || 0);
          if (message.components) {
            console.log('[Webview App] 接收到的组件详情:',
              message.components.map((c: any) => `${c.type}(id=${c.id})`).join(', '));
          }

          // 直接使用store方法，避免闭包问题
          const store = useDesignerStore.getState();
          
          console.log('[Webview App] 设置配置前，当前组件数:', store.components.length);
          
          store.setProjectConfig(message.projectConfig || null);
          console.log('[Webview App] 配置已设置');
          
          if (message.designerConfig?.canvasBackgroundColor) {
            store.setCanvasBackgroundColor(message.designerConfig.canvasBackgroundColor);
            console.log('[Webview App] 背景色已设置');
          }
          
          if (message.components) {
            console.log('[Webview App] 准备设置组件...');
            store.setComponents(message.components);
            console.log('[Webview App] setComponents 调用完成');
            
            // 立即验证
            const currentComponents = useDesignerStore.getState().components;
            console.log('[Webview App] 验证：当前store中的组件数量:', currentComponents.length);
            if (currentComponents.length > 0) {
              console.log('[Webview App] 验证：组件列表:', 
                currentComponents.map(c => `${c.type}(id=${c.id})`).join(', '));
            } else {
              console.error('[Webview App] ❌ 警告：setComponents后组件列表仍为空！');
            }
          }
          console.log('========== [Webview App] loadHml 消息处理完成 ==========');
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
   * 处理画布上的拖放事件，将组件从组件库添加到设计器画布
   *
   * 组件添加策略：
   * 1. **容器组件** (View/Panel/Window/Screen): 作为顶级组件放置在画布上，支持多容器并行布局
   *    - 这些组件有自己的位置和尺寸，独立存在于画布上
   *    - 可以包含其他组件作为子组件，形成嵌套结构
   *    - 可视化设计中可自由拖放、调整位置和尺寸
   *
   * 2. **UI组件** (Button/Label/Input等): 默认添加到hg_screen容器内作为子组件
   *    - 必须存在于某个容器内(Screen或View)
   *    - 位置相对于父容器，坐标系以父容器左上角为原点
   *    - 移动父容器时，子组件跟随移动
   *
   * 尺寸控制：
   * - 从componentDefinitions获取组件的标准默认尺寸
   * - 遵循组件库定义的尺寸规范，确保一致性
   * - 可在属性面板中手动调整各组件的width/height
   *
   * 层级关系：
   * - parent: string | null (组件的父容器ID，顶级组件为null)
   * - children: string[] (子组件ID列表，支持嵌套)
   * - 画布渲染时递归处理children，确保正确嵌套关系
   *
   * @param e 拖放事件对象，包含拖拽源信息和放置位置的坐标
   *
   * @see ComponentLibrary.tsx componentDefinitions - 定义各组件类型的默认尺寸和属性
   * @see store.ts addComponent() - 组件添加到状态管理的逻辑
   * @see DesignerCanvas.tsx renderComponent() - 组件渲染和嵌套关系处理
   */
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();

    console.log('========== [拖放] handleCanvasDrop 开始 ==========');
    
    const componentType = e.dataTransfer.getData('component-type') as ComponentType;
    if (!componentType) {
      console.log('[拖放] 没有组件类型，退出');
      return;
    }

    const componentDef = componentDefinitions.find(def => def.type === componentType);
    if (!componentDef) {
      console.error(`[拖放] 未找到组件类型 ${componentType} 的定义配置`);
      return;
    }

    // 获取当前画布中所有已存在的组件列表
    let components = useDesignerStore.getState().components;

    console.log(`[拖放] 组件类型: ${componentType}`);
    console.log(`[拖放] 当前组件总数: ${components.length}`);
    console.log(`[拖放] 组件数组是否为空: ${components.length === 0}`);
    console.log(`[拖放] 组件数组类型: ${Array.isArray(components) ? 'Array' : typeof components}`);
    
    if (components.length > 0) {
      console.log('[拖放] 当前画布中的组件:');
      components.forEach((c, index) => {
        console.log(`  [${index}] ${c.type}(id=${c.id}, parent=${c.parent || 'null'})`);
      });
    } else {
      console.error('[拖放] ❌ 当前画布中没有任何组件！');
    }

    // 查找画布中的hg_screen容器
    let screenContainer = components.find(comp => comp.type === 'hg_screen');
    
    console.log(`[拖放] 查找hg_screen结果: ${screenContainer ? `找到(id=${screenContainer.id})` : '未找到'}`);

    // 必须有hg_screen容器才能添加组件
    if (!screenContainer) {
      console.error('[拖放] ❌ 未找到hg_screen容器！');
      console.error('[拖放] 当前组件列表:', components.map(c => `${c.type}(id=${c.id})`).join(', '));
      
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'error',
          text: '此HML文件没有hg_screen容器。只有main.hml应该包含hg_screen容器。'
        });
      }
      return;
    }
    
    console.log(`[拖放] 找到hg_screen容器: ${screenContainer.id}, 尺寸: ${screenContainer.position.width}x${screenContainer.position.height}`);

    // 计算鼠标释放时的画布坐标位置
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left));
    const y = Math.max(0, Math.round(e.clientY - rect.top));

    // 生成唯一组件ID
    const componentId = `${componentType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // === View组件特殊处理：判断是否为第一个View ===
    // 重新获取最新的组件列表（包含可能刚刚创建的screen）
    const updatedComponents = useDesignerStore.getState().components;
    const existingViews = updatedComponents.filter(comp => comp.type === 'hg_view');
    const isFirstView = componentType === 'hg_view' && existingViews.length === 0;

    // 计算组件位置和尺寸
    let positionX = x;
    let positionY = y;
    let width = componentDef.defaultSize.width;
    let height = componentDef.defaultSize.height;
    let parent: string | null = null;

    // === 组件添加策略 ===
    if (componentType === 'hg_view') {
      if (isFirstView) {
        // 第一个View: 放入hg_screen容器，尺寸匹配hg_screen
        parent = screenContainer.id;
        positionX = 0; // 左上角对齐
        positionY = 0;
        width = screenContainer.position.width;
        height = screenContainer.position.height;
        console.info(`[拖放] 第一个View组件，自动放入hg_screen容器并匹配尺寸`);
      } else {
        // 后续View: 作为顶级容器独立放置，但初始尺寸匹配screen
        parent = null;
        width = screenContainer.position.width;
        height = screenContainer.position.height;
        console.info(`[拖放] 后续View组件，作为顶级容器独立放置，尺寸匹配screen`);
      }
    } else if (['hg_panel', 'hg_window'].includes(componentType)) {
      // 其他容器组件: 作为顶级组件独立放置
      parent = null;
      console.info(`[拖放] 容器组件 ${componentType} 作为顶级组件`);
    } else {
      // UI组件: 添加到hg_screen容器内
      parent = screenContainer.id;
      // 转换为相对于hg_screen的内部坐标
      positionX = Math.max(10, x - screenContainer.position.x);
      positionY = Math.max(10, y - screenContainer.position.y);
      console.info(`[拖放] UI组件 ${componentType} 添加到hg_screen容器`);
    }

    // 创建新组件对象
    const newComponent: Component = {
      id: componentId,
      type: componentType,
      name: `${componentType}_${Date.now().toString().substr(-4)}`,
      position: {
        x: positionX,
        y: positionY,
        width,
        height,
      },
      visible: true,
      enabled: true,
      locked: false,
      zIndex: 1,
      children: [],
      parent,
      style: {},
      data: {
        text: componentType === 'hg_button' ? 'Button' :
              componentType === 'hg_label' ? 'Label' :
              componentType === 'hg_text' ? 'Text' : '',
      },
    };

    addComponent(newComponent);
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
