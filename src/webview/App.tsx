import React, { useEffect } from 'react';
import { useDesignerStore } from './store';
import DesignerCanvas from './components/DesignerCanvas';
import ComponentLibrary, { componentDefinitions } from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import ComponentTree from './components/ComponentTree';
import AssetsPanel from './components/AssetsPanel';
import Toolbar from './components/Toolbar';
import { Component, ComponentType } from './types';
import useKeyboardShortcuts from './utils/keyboardShortcuts';
import './App.css';

// 从types.ts导入已有的Window接口扩展
import './types';

// 调试开关 - 生产环境应设为false
const DEBUG_DROP = true;

const App: React.FC = () => {
  const {
    setVSCodeAPI,
    setComponents,
    selectComponent,
    selectedComponent,
    addComponent,
    setProjectConfig,
    setCanvasBackgroundColor,
  } = useDesignerStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // 安全初始化VSCode API（确保只使用已有的实例）
  useEffect(() => {
    let readySent = false;
    
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
    
    // 主动请求加载数据（只发送一次）
    if (!readySent) {
      console.log('[HoneyGUI App] 发送ready消息请求数据...');
      window.vscodeAPI.postMessage({ command: 'ready' });
      readySent = true;
    }

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

        case 'updateImagePath':
          // ����ͼƬ�����·��
          if (message.componentId && message.path) {
            const store = useDesignerStore.getState();
            const component = store.components.find(c => c.id === message.componentId);
            if (component) {
              store.updateComponent(message.componentId, {
                data: {
                  ...component.data,
                  src: message.path
                }
              });
              if (message.webviewPath) {
                store.updateAssetPreview(message.path, message.webviewPath);
              }
              console.log(`[Webview App] ����ͼƬ·��: ${message.path}`);
            }
          }
          break;

        case 'createImageComponent':
          // 创建图片控件
          if (message.imagePath && message.targetContainerId) {
            const store = useDesignerStore.getState();
            const targetContainer = store.components.find(c => c.id === message.targetContainerId);
            
            if (targetContainer) {
              // 计算相对于容器的坐标
              const getAbsolutePosition = (comp: Component): { x: number; y: number } => {
                if (!comp.parent) {
                  return { x: comp.position.x, y: comp.position.y };
                }
                const parentComp = store.components.find(c => c.id === comp.parent);
                if (!parentComp) {
                  return { x: comp.position.x, y: comp.position.y };
                }
                const parentPos = getAbsolutePosition(parentComp);
                return {
                  x: parentPos.x + comp.position.x,
                  y: parentPos.y + comp.position.y
                };
              };

              const targetAbsPos = getAbsolutePosition(targetContainer);
              const relativeX = Math.max(0, message.dropPosition.x - targetAbsPos.x);
              const relativeY = Math.max(0, message.dropPosition.y - targetAbsPos.y);

              // 创建图片组件
              const assetPath = message.imagePath;
              const previewPath = message.webviewPath || message.imagePath;

              const imageComponent: Component = {
                id: `hg_image_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                type: 'hg_image',
                name: `image_${Date.now().toString().substr(-4)}`,
                position: {
                  x: relativeX,
                  y: relativeY,
                  width: 100,
                  height: 100,
                },
                visible: true,
                enabled: true,
                locked: false,
                zIndex: 1,
                children: [],
                parent: message.targetContainerId,
                style: {},
                data: {
                  src: assetPath
                },
              };

              store.addComponent(imageComponent);
              if (previewPath) {
                store.updateAssetPreview(assetPath, previewPath);
              }
              console.log(`[Webview App] 创建图片组件: ${assetPath}`);
            }
          }
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
   * 1. **容器组件** (View/Panel/Window): 作为顶级组件放置在画布上
   *    - parent = null
   *    - 可以包含其他组件作为子组件
   *
   * 2. **UI组件** (Button/Label/Input等): 必须放在某个组件内
   *    - 优先放到当前选中的组件内
   *    - 如果没有选中组件，放到第一个容器内
   *    - 如果没有任何容器，提示用户先创建容器
   *
   * @param e 拖放事件对象
   */
  const handleImageFileDrop = async (e: React.DragEvent, file: File) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left));
    const y = Math.max(0, Math.round(e.clientY - rect.top));

    const components = useDesignerStore.getState().components;

    // 查找目标容器
    const getAbsolutePosition = (comp: Component): { x: number; y: number } => {
      if (!comp.parent) {
        return { x: comp.position.x, y: comp.position.y };
      }
      const parentComp = components.find(c => c.id === comp.parent);
      if (!parentComp) {
        return { x: comp.position.x, y: comp.position.y };
      }
      const parentPos = getAbsolutePosition(parentComp);
      return {
        x: parentPos.x + comp.position.x,
        y: parentPos.y + comp.position.y
      };
    };

    let targetContainer: Component | null = null;
    for (const comp of components) {
      const absPos = getAbsolutePosition(comp);
      const { width: cw, height: ch } = comp.position;
      
      if (x >= absPos.x && x <= absPos.x + cw && y >= absPos.y && y <= absPos.y + ch) {
        if (!targetContainer || (cw * ch < targetContainer.position.width * targetContainer.position.height)) {
          targetContainer = comp;
        }
      }
    }

    if (!targetContainer) {
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'error',
          text: '请将图片拖放到容器内（View/Panel/Window）'
        });
      }
      return;
    }

    // 读取文件内容
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 发送文件到后端保存
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(uint8Array),
          dropPosition: { x, y },
          targetContainerId: targetContainer.id
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();

    if (DEBUG_DROP) {
      console.log('========== [拖放] handleCanvasDrop 开始 ==========');
      console.log('[拖放] ⚠️ 如果看不到日志，请右键设计器画布 → 检查元素，打开Webview开发者工具');
    }
    
    // 检查是否是文件拖拽
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext && imageExts.includes(ext)) {
        // 处理图片文件拖拽
        handleImageFileDrop(e, file);
        return;
      }
    }
    
    const componentType = e.dataTransfer.getData('component-type') as ComponentType;
    if (!componentType) {
      if (DEBUG_DROP) console.log('[拖放] 没有组件类型，退出');
      return;
    }

    const componentDef = componentDefinitions.find(def => def.type === componentType);
    if (!componentDef) {
      console.error(`[拖放] 未找到组件类型 ${componentType} 的定义配置`);
      return;
    }

    const components = useDesignerStore.getState().components;
    const currentSelected = useDesignerStore.getState().selectedComponent;

    if (DEBUG_DROP) {
      console.log(`[拖放] 组件类型: ${componentType}`);
      console.log(`[拖放] 当前选中: ${currentSelected || '无'}`);
    }

    // 计算鼠标释放时的画布坐标位置
    // 使用 currentTarget 而不是 target，确保获取的是画布容器而不是子元素
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left));
    const y = Math.max(0, Math.round(e.clientY - rect.top));

    // 生成唯一组件ID
    const componentId = `${componentType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    let positionX = x;
    let positionY = y;
    
    // 对于hg_view，使用项目配置的分辨率作为默认大小
    const canvasSize = useDesignerStore.getState().canvasSize;
    let width = componentType === 'hg_view' && canvasSize 
      ? canvasSize.width 
      : componentDef.defaultSize.width;
    let height = componentType === 'hg_view' && canvasSize 
      ? canvasSize.height 
      : componentDef.defaultSize.height;
    
    let parent: string | null = null;

    // 判断是否为容器组件
    const isContainer = ['hg_view', 'hg_panel', 'hg_window'].includes(componentType);

    if (isContainer) {
      // 容器组件：作为顶级组件
      parent = null;
      if (DEBUG_DROP) console.info(`[拖放] 容器组件 ${componentType} 作为顶级组件`);
    } else {
      // UI组件：必须放在某个组件内
      // 根据鼠标位置查找目标容器
      let targetContainer: Component | null = null;
      
      if (DEBUG_DROP) {
        console.log(`[拖放] ========== 开始查找目标容器 ==========`);
        console.log(`[拖放] 鼠标画布坐标: (${x}, ${y})`);
        console.log(`[拖放] 当前组件总数: ${components.length}`);
      }
      
      // 计算组件的绝对位置（考虑父组件的位置）
      const getAbsolutePosition = (comp: Component): { x: number; y: number } => {
        if (!comp.parent) {
          if (DEBUG_DROP) console.log(`[拖放]   组件 ${comp.id} 是顶级组件，位置: (${comp.position.x}, ${comp.position.y})`);
          return { x: comp.position.x, y: comp.position.y };
        }
        const parentComp = components.find(c => c.id === comp.parent);
        if (!parentComp) {
          if (DEBUG_DROP) console.log(`[拖放]   组件 ${comp.id} 的父组件未找到，使用相对位置: (${comp.position.x}, ${comp.position.y})`);
          return { x: comp.position.x, y: comp.position.y };
        }
        const parentPos = getAbsolutePosition(parentComp);
        const absPos = {
          x: parentPos.x + comp.position.x,
          y: parentPos.y + comp.position.y
        };
        if (DEBUG_DROP) console.log(`[拖放]   组件 ${comp.id} 父组件位置: (${parentPos.x}, ${parentPos.y}), 相对位置: (${comp.position.x}, ${comp.position.y}), 绝对位置: (${absPos.x}, ${absPos.y})`);
        return absPos;
      };
      
      // 遍历所有组件，找到鼠标位置下的最内层容器
      for (const comp of components) {
        if (DEBUG_DROP) console.log(`[拖放] 检查组件: ${comp.type}(${comp.id})`);
        const absPos = getAbsolutePosition(comp);
        const { width: cw, height: ch } = comp.position;
        
        if (DEBUG_DROP) {
          console.log(`[拖放]   绝对位置: (${absPos.x}, ${absPos.y}), 尺寸: ${cw}x${ch}`);
          console.log(`[拖放]   范围: X[${absPos.x} - ${absPos.x + cw}], Y[${absPos.y} - ${absPos.y + ch}]`);
        }
        
        // 检查鼠标是否在组件范围内
        const inRangeX = x >= absPos.x && x <= absPos.x + cw;
        const inRangeY = y >= absPos.y && y <= absPos.y + ch;
        if (DEBUG_DROP) console.log(`[拖放]   鼠标在X范围内: ${inRangeX}, 在Y范围内: ${inRangeY}`);
        
        if (inRangeX && inRangeY) {
          if (DEBUG_DROP) console.log(`[拖放]   ✓ 鼠标在此组件范围内`);
          // 如果还没有目标，或者当前组件比已找到的更内层（面积更小）
          if (!targetContainer || (cw * ch < targetContainer.position.width * targetContainer.position.height)) {
            if (DEBUG_DROP) console.log(`[拖放]   ✓ 设置为目标容器 (面积: ${cw * ch})`);
            targetContainer = comp;
          } else {
            if (DEBUG_DROP) console.log(`[拖放]   × 面积更大，不是最内层 (当前: ${cw * ch}, 已有: ${targetContainer.position.width * targetContainer.position.height})`);
          }
        } else {
          if (DEBUG_DROP) console.log(`[拖放]   × 鼠标不在此组件范围内`);
        }
      }
      
      if (DEBUG_DROP) {
        console.log(`[拖放] ========== 查找结果 ==========`);
        console.log(`[拖放] 找到目标容器:`, targetContainer ? `${targetContainer.type}(${targetContainer.id})` : '未找到');
      }
      
      if (targetContainer) {
        parent = targetContainer.id;
        // 转换为相对于目标容器的坐标
        const targetAbsPos = getAbsolutePosition(targetContainer);
        positionX = Math.max(0, x - targetAbsPos.x);
        positionY = Math.max(0, y - targetAbsPos.y);
        if (DEBUG_DROP) {
          console.log(`[拖放] 目标容器绝对位置: (${targetAbsPos.x}, ${targetAbsPos.y})`);
          console.log(`[拖放] UI组件相对坐标: (${positionX}, ${positionY})`);
          console.info(`[拖放] ✓ UI组件 ${componentType} 添加到容器 ${targetContainer.id}`);
        }
      } else {
        // 没有找到容器，提示用户
        console.error('[拖放] 鼠标位置下没有容器组件');
        const api = useDesignerStore.getState().vscodeAPI;
        if (api) {
          api.postMessage({
            command: 'error',
            text: '请将组件拖放到容器内（View/Panel/Window）'
          });
        }
        return;
      }
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

  const handleCanvasClick = (e: React.MouseEvent) => {
    // 只有点击canvas本身（不是子元素）时才清除选择
    if (e.target === e.currentTarget) {
      selectComponent(null);
    }
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
          <AssetsPanel />
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
