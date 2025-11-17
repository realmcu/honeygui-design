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
   * 处理画布上的拖放事件，将组件从组件库添加到设计器画布
   *
   * 组件添加策略：
   * 1. **容器组件** (View/Panel/Window/Screen): 作为顶级组件放置在画布上，支持多容器并行布局
   *    - 这些组件有自己的位置和尺寸，独立存在于画布上
   *    - 可以包含其他组件作为子组件，形成嵌套结构
   *    - 可视化设计中可自由拖放、调整位置和尺寸
   *
   * 2. **UI组件** (Button/Label/Input等): 默认添加到screen容器内作为子组件
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
    // 阻止默认拖放行为，防止浏览器执行默认的文件打开等操作
    e.preventDefault();

    // 从拖拽数据中获取组件类型标识符
    const componentType = e.dataTransfer.getData('component-type') as ComponentType;

    // 如果未获取到组件类型，说明不是从组件库拖拽的，直接返回
    if (!componentType) return;

    // 从组件库定义中查找该组件类型的配置信息(尺寸、属性等)
    const componentDef = componentDefinitions.find(def => def.type === componentType);
    if (!componentDef) {
      console.error(`未找到组件类型 ${componentType} 的定义配置`);
      return;
    }

    // 获取当前画布中所有已存在的组件列表
    const components = useDesignerStore.getState().components;

    // 查找画布中的根screen容器(顶级screen组件)
    // 所有UI组件(非容器组件)默认添加到screen容器内
    const screenContainer = components.find(comp =>
      comp.type === 'screen' && comp.parent === null
    );

    // 计算鼠标释放时的画布坐标位置
    // 使用getBoundingClientRect获取画布相对于视口的矩形区域
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left)); // 确保x不小于0
    const y = Math.max(0, Math.round(e.clientY - rect.top));  // 确保y不小于0

    // 生成唯一组件ID，使用类型+时间戳+随机数确保唯一性
    const componentId = `${componentType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // 创建新组件对象，使用组件库定义的默认尺寸
    const newComponent: Component = {
      id: componentId,
      type: componentType,
      name: `${componentType}_${Date.now().toString().substr(-4)}`, // 简单的可读名称
      position: {
        x, // 初始位置设置为鼠标释放位置
        y,
        width: componentDef.defaultSize.width,  // 从组件库获取标准宽度
        height: componentDef.defaultSize.height, // 从组件库获取标准高度
      },
      visible: true,  // 默认可见
      enabled: true,  // 默认可用
      locked: false,  // 默认未锁定
      zIndex: 1,      // 默认层级
      children: [],   // 初始化空子组件列表
      parent: null,   // 默认无父组件（顶级组件）
      style: {},      // 初始化样式对象
      data: {
        // 根据组件类型设置默认文本内容，便于识别
        text: componentType === 'button' ? 'Button' :
              componentType === 'label' ? 'Label' :
              componentType === 'text' ? 'Text' : '',
      },
    };

    // === 组件层级策略决策 ===
    // 根据组件类型决定parent关系，确保正确的层级结构

    // 规则1: 容器类组件（View/Panel/Window/Screen）作为顶级组件
    // - 位置使用绝对坐标，相对于画布原点
    // - 支持多容器并行布局，各自独立
    const isContainerComponent = ['view', 'panel', 'window', 'screen'].includes(componentType);

    // 规则2: UI类组件（Button/Label/Input等）添加到screen容器内
    // - 需要存在screen容器
    // - 位置转换为相对于screen容器的内部坐标
    // - 当screen移动时，子组件跟随移动
    const isUIComponent = !isContainerComponent;

    if (isUIComponent && screenContainer) {
      // UI组件: 添加到screen容器内
      newComponent.parent = screenContainer.id;

      // 转换坐标: 将绝对坐标转换为相对于screen容器的内部坐标
      // 确保子组件至少距离容器边缘10px，提供视觉边距
      const screenX = screenContainer.position.x;
      const screenY = screenContainer.position.y;
      newComponent.position.x = Math.max(10, x - screenX);
      newComponent.position.y = Math.max(10, y - screenY);

      console.info(`[拖放] UI组件 ${newComponent.name} 添加到 screen 容器，内部坐标: (${newComponent.position.x}, ${newComponent.position.y})`, {
        componentType,
        container: screenContainer.name,
      });
    } else if (isContainerComponent) {
      // 容器组件: 作为顶级组件放在画布上
      console.info(`[拖放] 容器组件 ${newComponent.name} 作为顶级组件，坐标: (${newComponent.position.x}, ${newComponent.position.y})`, {
        componentType,
        isTopLevel: true,
      });
    } else if (isUIComponent && !screenContainer) {
      // 异常情况: UI组件但没有可用screen容器
      console.warn(`[拖放] 未找到根screen容器，${componentType} 将暂作为顶级组件放置`, {
        component: newComponent,
      });
      // 仍然添加到画布，但功能可能受限
    }

    // 将新组件添加到状态管理(store)
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
