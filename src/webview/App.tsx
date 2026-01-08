import React, { useEffect } from 'react';
import { useDesignerStore } from './store';
import DesignerCanvas from './components/DesignerCanvas';
import ComponentLibrary, { componentDefinitions } from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import ComponentTree from './components/ComponentTree';
import AssetsPanel from './components/AssetsPanel';
import Toolbar from './components/Toolbar';
import { ViewRelationModal } from './components/ViewRelationModal';
import { Component, ComponentType } from './types';
import useKeyboardShortcuts from './utils/keyboardShortcuts';
import { getAbsolutePosition, findComponentAtPosition, isDropTargetType, isContainerType } from './utils/componentUtils';
import { createImageComponentAtPosition, create3DComponentAtPosition, createVideoComponentAtPosition, createSvgComponentAtPosition } from './services/messageHandler';
import { processImageFiles } from './utils/fileUtils';
import { parseObjDependencies, parseMtlDependencies, findDependencyFiles } from './utils/objDependencyParser';
import './App.css';

// 从types.ts导入已有的Window接口扩展
import './types';

// 调试开关 - 生产环境应设为false
const DEBUG_DROP = false;

import { usePanelResize, usePanelShortcuts } from './hooks/usePanelResize';

const App: React.FC = () => {
  const {
    setVSCodeAPI,
    setComponents,
    selectComponent,
    selectedComponent,
    addComponent,
    setProjectConfig,
    setCanvasBackgroundColor,
    components,
    showViewRelationModal,
    setShowViewRelationModal,
  } = useDesignerStore();

  // Tab 切换状态
  const [activeTab, setActiveTab] = React.useState<'components' | 'assets' | 'tree'>('components');

  // 面板状态管理
  const leftPanel = usePanelResize({ defaultWidth: 280, minWidth: 200, maxWidth: 500 });
  const rightPanel = usePanelResize({ defaultWidth: 300, minWidth: 250, maxWidth: 500 });
  
  // 面板快捷键
  usePanelShortcuts(leftPanel.toggle, rightPanel.toggle);

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
          // 直接使用store方法，避免闭包问题
          const store = useDesignerStore.getState();
          
          store.setProjectConfig(message.projectConfig || null);
          
          if (message.designerConfig?.canvasBackgroundColor) {
            store.setCanvasBackgroundColor(message.designerConfig.canvasBackgroundColor);
          }

          // 设置所有 view 列表
          if (message.allViews) {
            useDesignerStore.setState({ allViews: message.allViews });
          }

          // 设置所有 HML 文件列表
          if (message.allHmlFiles) {
            useDesignerStore.setState({ allHmlFiles: message.allHmlFiles });
          }

          // 设置当前文件路径
          if (message.currentFilePath) {
            useDesignerStore.setState({ currentFilePath: message.currentFilePath });
          }
          
          if (message.components) {
            store.setComponents(message.components);
            
            // 自动居中第一个 hg_view
            const currentComponents = useDesignerStore.getState().components;
            const firstView = currentComponents.find(c => c.type === 'hg_view');
            if (firstView) {
              store.centerViewOnCanvas(firstView.id);
            }
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

        case 'updateImagePath':
          // 更新图片组件的路径
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
              console.log(`[Webview App] 更新图片路径: ${message.path}`);
            }
          }
          break;

        case 'createImageComponent':
          if (message.imagePath && message.targetContainerId && message.dropPosition) {
            const store = useDesignerStore.getState();
            createImageComponentAtPosition(
              message.imagePath,
              message.dropPosition,
              message.targetContainerId,
              store.components,
              store.addComponent,
              message.imageSize
            );
          }
          break;

        case 'create3DComponent':
          if (message.modelPath && message.targetContainerId && message.dropPosition) {
            const store = useDesignerStore.getState();
            create3DComponentAtPosition(
              message.modelPath,
              message.dropPosition,
              message.targetContainerId,
              store.components,
              store.addComponent
            );
          }
          break;

        case 'createVideoComponent':
          if (message.videoPath && message.targetContainerId && message.dropPosition) {
            const store = useDesignerStore.getState();
            createVideoComponentAtPosition(
              message.videoPath,
              message.dropPosition,
              message.targetContainerId,
              store.components,
              store.addComponent,
              message.videoSize
            );
          }
          break;

        case 'updateVideoSize':
          if (message.componentId && message.videoSize) {
            const store = useDesignerStore.getState();
            const component = store.components.find(c => c.id === message.componentId);
            if (component) {
              store.updateComponent(message.componentId, {
                position: {
                  ...component.position,
                  width: message.videoSize.width,
                  height: message.videoSize.height
                }
              });
            }
          }
          break;

        case 'createSvgComponent':
          if (message.svgPath && message.targetContainerId && message.dropPosition) {
            const store = useDesignerStore.getState();
            createSvgComponentAtPosition(
              message.svgPath,
              message.dropPosition,
              message.targetContainerId,
              store.components,
              store.addComponent,
              message.size
            );
          }
          break;

        case 'deleteComponentsByImagePath':
          if (message.imagePath) {
            const store = useDesignerStore.getState();
            const componentsToDelete = store.components.filter(
              c => c.type === 'hg_image' && c.data?.src === message.imagePath
            );
            if (componentsToDelete.length > 0) {
              store.removeComponents(componentsToDelete.map(c => c.id));
              console.log(`[删除组件] 删除了 ${componentsToDelete.length} 个引用 ${message.imagePath} 的图片组件`);
            }
          }
          break;

        case 'componentPropertyUpdated':
          // 更新组件属性（来自文件浏览器）
          if (message.success && message.componentId && message.propertyName) {
            const store = useDesignerStore.getState();
            const component = store.components.find(c => c.id === message.componentId);
            if (component) {
              store.updateComponent(message.componentId, {
                data: {
                  ...component.data,
                  [message.propertyName]: message.value
                }
              });
              console.log(`[Webview App] 更新组件属性: ${message.propertyName} = ${message.value}`);
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
  
  /**
   * 查找拖放目标容器
   */
  const findDropTarget = (e: React.DragEvent): Component | null => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const state = useDesignerStore.getState();
    // 使用 effectiveZoom 以匹配画布的 transform scale
    const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
    const x = Math.round((e.clientX - rect.left - state.canvasOffset.x) / effectiveZoom);
    const y = Math.round((e.clientY - rect.top - state.canvasOffset.y) / effectiveZoom);

    return findComponentAtPosition(x, y, state.components);
  };

  const handleImageFileDrop = async (e: React.DragEvent, files: FileList, createComponent: boolean = true) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const state = useDesignerStore.getState();
    // 使用 effectiveZoom 以匹配画布的 transform scale
    const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
    const x = Math.round((e.clientX - rect.left - state.canvasOffset.x) / effectiveZoom);
    const y = Math.round((e.clientY - rect.top - state.canvasOffset.y) / effectiveZoom);

    let targetContainer: Component | null = null;

    if (createComponent) {
      targetContainer = findDropTarget(e);
      
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
    }

    // 使用工具函数处理图片文件
    await processImageFiles(files, (file, index, data) => {
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(data),
          dropPosition: createComponent ? { x: x + index * 20, y: y + index * 20 } : undefined,
          targetContainerId: createComponent ? targetContainer!.id : undefined
        });
      }
    });
  };

  const handleModelFileDrop = async (e: React.DragEvent, files: FileList) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const state = useDesignerStore.getState();
    // 使用 effectiveZoom 以匹配画布的 transform scale
    const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
    const x = Math.round((e.clientX - rect.left - state.canvasOffset.x) / effectiveZoom);
    const y = Math.round((e.clientY - rect.top - state.canvasOffset.y) / effectiveZoom);

    const targetContainer = findDropTarget(e);
    if (!targetContainer) {
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'error',
          text: '请将 3D 模型拖放到容器内（View/Window）'
        });
      }
      return;
    }

    // 处理 3D 模型文件
    const modelExts = ['obj', 'gltf', 'glb'];
    const fileArray = Array.from(files);
    const objFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.obj'));
    
    let offset = 0;
    
    // 处理 OBJ 文件及其依赖
    for (const objFile of objFiles) {
      const deps = await parseObjDependencies(objFile);
      const depFiles = findDependencyFiles(objFile.name, deps, files);
      
      // 如果找到 MTL，解析其贴图依赖
      if (depFiles.mtl) {
        const mtlDeps = await parseMtlDependencies(depFiles.mtl, deps);
        deps.textures = mtlDeps.textures;
        depFiles.textures = fileArray.filter(f => deps.textures.includes(f.name));
      }
      
      // 上传所有文件
      const filesToUpload = [objFile];
      if (depFiles.mtl) filesToUpload.push(depFiles.mtl);
      filesToUpload.push(...depFiles.textures);
      
      for (const file of filesToUpload) {
        await uploadFileToAssets(file);
      }
      
      // 检查缺失的依赖并提示
      const missingFiles: string[] = [];
      if (deps.mtlFile && !depFiles.mtl) {
        missingFiles.push(deps.mtlFile);
      }
      const missingTextures = deps.textures.filter(t => 
        !depFiles.textures.some(f => f.name === t)
      );
      missingFiles.push(...missingTextures);
      
      if (missingFiles.length > 0) {
        const api = useDesignerStore.getState().vscodeAPI;
        if (api) {
          api.postMessage({
            command: 'notify',
            text: `${objFile.name} 缺少依赖文件: ${missingFiles.join(', ')}。请同时选中这些文件一起拖拽。`
          });
        }
      }
      
      // 创建 3D 组件（只为 OBJ 文件创建）
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'create3DComponent',
          modelPath: `assets/${objFile.name}`,
          dropPosition: { x: x + offset, y: y + offset },
          targetContainerId: targetContainer.id
        });
      }
      
      offset += 20;
      
      console.log(`[OBJ依赖] ${objFile.name} 已导入到画布，包含:`, {
        mtl: depFiles.mtl?.name,
        textures: depFiles.textures.map(f => f.name),
        missing: missingFiles
      });
    }
    
    // 处理其他 3D 模型文件（gltf, glb）
    const otherModels = fileArray.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext && modelExts.includes(ext) && ext !== 'obj';
    });
    
    for (const file of otherModels) {
      await uploadFileToAssets(file);
      
      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        api.postMessage({
          command: 'create3DComponent',
          modelPath: `assets/${file.name}`,
          dropPosition: { x: x + offset, y: y + offset },
          targetContainerId: targetContainer.id
        });
      }
      offset += 20;
    }
  };

  const uploadFileToAssets = (file: File): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const api = useDesignerStore.getState().vscodeAPI;
        if (api) {
          api.postMessage({
            command: 'saveImageToAssets',
            fileName: file.name,
            fileData: Array.from(uint8Array),
            relativePath: '',
            dropPosition: undefined,
            targetContainerId: undefined
          });
        }
        resolve();
      };
      reader.readAsArrayBuffer(file);
    });
  };


  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();

    console.log('========== [拖放] handleCanvasDrop 开始 ==========');
    console.log('[拖放] dataTransfer.types:', e.dataTransfer.types);
    console.log('[拖放] dataTransfer.files.length:', e.dataTransfer.files.length);
    
    if (DEBUG_DROP) {
      console.log('[拖放] ⚠️ 如果看不到日志，请右键设计器画布 → 检查元素，打开Webview开发者工具');
    }
    
    // 检查是否是从资源面板拖拽
    const assetPath = e.dataTransfer.getData('asset-path');
    console.log('[拖放] asset-path 数据:', assetPath);
    if (assetPath) {
      // 从资源面板拖拽资源到画布
      const targetContainer = findDropTarget(e);
      console.log('[拖放] 找到的目标容器:', targetContainer);
      if (!targetContainer) {
        console.log('[拖放] ❌ 未找到目标容器，需要拖放到容器内');
        const api = useDesignerStore.getState().vscodeAPI;
        if (api) {
          api.postMessage({
            command: 'error',
            text: '请将资源拖放到容器内（View/Window）'
          });
        }
        return;
      }
      console.log('[拖放] ✅ 目标容器:', targetContainer.type, targetContainer.id);

      const canvasRect = document.querySelector('.designer-canvas')?.getBoundingClientRect();
      if (!canvasRect) return;

      const state = useDesignerStore.getState();
      
      // 使用 effectiveZoom 以匹配画布的 transform scale
      const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
      
      // 将鼠标坐标转换为画布坐标系（考虑 canvasOffset 和 effectiveZoom）
      const x = (e.clientX - canvasRect.left - state.canvasOffset.x) / effectiveZoom;
      const y = (e.clientY - canvasRect.top - state.canvasOffset.y) / effectiveZoom;

      const api = useDesignerStore.getState().vscodeAPI;
      if (api) {
        // 判断文件类型
        const ext = assetPath.split('.').pop()?.toLowerCase();
        const is3DModel = ext && ['obj', 'gltf', 'glb'].includes(ext);
        const isVideo = ext && ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
        const isSvg = ext === 'svg';
        
        if (is3DModel) {
          // 3D 模型：直接创建组件
          api.postMessage({
            command: 'create3DComponent',
            modelPath: `assets/${assetPath}`,
            dropPosition: { x, y },
            targetContainerId: targetContainer.id
          });
        } else if (isVideo) {
          // 视频：获取尺寸后创建组件
          api.postMessage({
            command: 'getVideoSize',
            videoPath: `assets/${assetPath}`,
            dropPosition: { x, y },
            targetContainerId: targetContainer.id
          });
        } else if (isSvg) {
          // SVG：创建 SVG 组件
          api.postMessage({
            command: 'createSvgComponent',
            svgPath: `assets/${assetPath}`,
            dropPosition: { x, y },
            targetContainerId: targetContainer.id
          });
        } else {
          // 图片：获取尺寸后创建
          api.postMessage({
            command: 'getImageSize',
            imagePath: `assets/${assetPath}`,
            dropPosition: { x, y },
            targetContainerId: targetContainer.id
          });
        }
      }
      return;
    }
    
    // 检查是否是文件拖拽
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
      const modelExts = ['obj', 'gltf', 'glb'];
      
      // 检查是否有图片或 3D 文件
      const hasImage = Array.from(files).some(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext && imageExts.includes(ext);
      });
      
      const hasModel = Array.from(files).some(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext && modelExts.includes(ext);
      });
      
      if (hasModel) {
        // 优先处理 3D 模型文件拖拽（包含依赖的贴图）
        handleModelFileDrop(e, files);
        return;
      }
      
      if (hasImage) {
        // 处理图片文件拖拽（支持多文件）
        handleImageFileDrop(e, files, true);
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
    const canvasRect = document.querySelector('.designer-canvas')?.getBoundingClientRect();
    if (!canvasRect) return;

    const state = useDesignerStore.getState();
    
    // 使用 effectiveZoom 以匹配画布的 transform scale
    const effectiveZoom = state.zoom / (window.devicePixelRatio || 1);
    
    // 将鼠标坐标转换为画布坐标系
    // 注意：不能用 Math.max(0, ...) 截断，因为画布可能被拖动到负坐标区域
    const x = Math.round((e.clientX - canvasRect.left - state.canvasOffset.x) / effectiveZoom);
    const y = Math.round((e.clientY - canvasRect.top - state.canvasOffset.y) / effectiveZoom);

    if (DEBUG_DROP) {
      console.log(`[拖放] ========== 坐标计算 ==========`);
      console.log(`[拖放] e.clientX: ${e.clientX}, e.clientY: ${e.clientY}`);
      console.log(`[拖放] canvasRect: left=${canvasRect.left}, top=${canvasRect.top}`);
      console.log(`[拖放] canvasOffset: x=${state.canvasOffset.x}, y=${state.canvasOffset.y}`);
      console.log(`[拖放] zoom: ${state.zoom}, effectiveZoom: ${effectiveZoom}`);
      console.log(`[拖放] 最终画布坐标: x=${x}, y=${y}`);
    }

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

    // 判断是否为顶级容器组件（只有 hg_view）
    const isTopLevelContainer = componentType === 'hg_view';
    // 判断是否为可嵌套的容器组件（hg_window, hg_list, hg_canvas 等）
    const isNestedContainer = isContainerType(componentType) && !isTopLevelContainer;

    if (isTopLevelContainer) {
      // 顶级容器组件：作为顶级组件
      parent = null;
      if (DEBUG_DROP) console.info(`[拖放] 顶级容器组件 ${componentType} 作为顶级组件`);
    } else {
      // UI组件或可嵌套容器：必须放在某个容器内
      // 根据鼠标位置查找目标容器
      let targetContainer: Component | null = null;
      
      if (DEBUG_DROP) {
        console.log(`[拖放] ========== 开始查找目标容器 ==========`);
        console.log(`[拖放] 鼠标画布坐标: (${x}, ${y})`);
        console.log(`[拖放] 当前组件总数: ${components.length}`);
      }
      
      // 遍历所有组件，找到鼠标位置下的最内层容器
      for (const comp of components) {
        // 只有可作为拖放目标的容器类型才能作为目标
        if (!isDropTargetType(comp.type)) {
          continue;
        }
        
        if (DEBUG_DROP) console.log(`[拖放] 检查容器: ${comp.type}(${comp.id})`);
        const absPos = getAbsolutePosition(comp, components);
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
        const targetAbsPos = getAbsolutePosition(targetContainer, components);
        positionX = Math.max(0, x - targetAbsPos.x);
        positionY = Math.max(0, y - targetAbsPos.y);
        if (DEBUG_DROP) {
          console.log(`[拖放] 目标容器绝对位置: (${targetAbsPos.x}, ${targetAbsPos.y})`);
          console.log(`[拖放] UI组件相对坐标: (${positionX}, ${positionY})`);
          console.info(`[拖放] ✓ ${isNestedContainer ? '嵌套容器' : 'UI组件'} ${componentType} 添加到容器 ${targetContainer.id}`);
        }
      } else {
        // 没有找到容器，提示用户
        console.error('[拖放] 鼠标位置下没有容器组件');
        const api = useDesignerStore.getState().vscodeAPI;
        if (api) {
          // 针对不同组件类型提供特定的错误提示
          let errorMessage = '请将组件拖放到容器内（View/Window）';
          if (isNestedContainer) {
            errorMessage = `${componentType} 必须放置在容器组件（hg_view 或 hg_window）内`;
          }
          api.postMessage({
            command: 'error',
            text: errorMessage
          });
        }
        return;
      }
    }

    // 应用默认样式
    const defaultStyle: Record<string, any> = {};
    componentDef.properties
      .filter(prop => prop.group === 'style' && prop.defaultValue !== undefined)
      .forEach(prop => {
        defaultStyle[prop.name] = prop.defaultValue;
      });

    // hg_list 特殊处理：默认宽高为屏幕宽高，项尺寸根据方向自动计算
    if (componentType === 'hg_list') {
      const projectConfig = useDesignerStore.getState().projectConfig;
      const resolution = projectConfig?.resolution || '480X272';
      const [resWidth, resHeight] = resolution.split('X').map(Number);
      
      // 列表宽高默认为屏幕宽高
      width = resWidth;
      height = resHeight;
      
      // 默认垂直列表，项宽度=列表宽度，项高度=屏幕高度/5
      defaultStyle.itemWidth = resWidth;
      defaultStyle.itemHeight = Math.round(resHeight / 5);
    }

    // 应用默认数据
    const defaultData: Record<string, any> = {
      text: componentType === 'hg_button' ? 'Button' :
            componentType === 'hg_label' ? 'Label' :
            componentType === 'hg_text' ? 'Text' : '',
    };
    componentDef.properties
      .filter(prop => prop.group === 'data' && prop.defaultValue !== undefined)
      .forEach(prop => {
        defaultData[prop.name] = prop.defaultValue;
      });

    // 应用默认通用属性（general group）
    componentDef.properties
      .filter(prop => prop.group === 'general' && prop.defaultValue !== undefined)
      .forEach(prop => {
        defaultData[prop.name] = prop.defaultValue;
      });

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
      showOverflow: componentType === 'hg_list', // hg_list 默认勾选超出父容器
      zIndex: 1,
      children: [],
      parent,
      style: defaultStyle,
      data: defaultData,
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

  // 统一的右键菜单处理（传递给Canvas和Tree）
  const handleComponentContextMenu = (e: React.MouseEvent, componentId: string) => {
    // 转发给 DesignerCanvas 处理
    // 这里通过自定义事件实现
    const event = new CustomEvent('component-context-menu', {
      detail: { mouseEvent: e, componentId }
    });
    window.dispatchEvent(event);
  };

  // 处理面板宽度调整
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (leftPanel.isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 500) {
          leftPanel.setWidth(newWidth);
        }
      } else if (rightPanel.isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 250 && newWidth <= 500) {
          rightPanel.setWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      leftPanel.stopResize();
      rightPanel.stopResize();
    };

    if (leftPanel.isResizing || rightPanel.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [leftPanel.isResizing, rightPanel.isResizing]);

  return (
    <div className="app">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel - Tabbed */}
        <div className="left-panel" style={{ width: `${leftPanel.width}px`, display: leftPanel.isCollapsed ? 'none' : 'flex' }}>
          {/* Tab Headers */}
          <div className="tab-headers">
            <button 
              className={`tab-header ${activeTab === 'components' ? 'active' : ''}`}
              onClick={() => setActiveTab('components')}
            >
              组件库
            </button>
            <button 
              className={`tab-header ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              资源
            </button>
            <button 
              className={`tab-header ${activeTab === 'tree' ? 'active' : ''}`}
              onClick={() => setActiveTab('tree')}
            >
              组件树
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'components' && <ComponentLibrary onComponentDragStart={() => {}} />}
            {activeTab === 'assets' && <AssetsPanel />}
            {activeTab === 'tree' && <ComponentTree onContextMenu={handleComponentContextMenu} />}
          </div>
        </div>

        {/* Resizer for left panel */}
        <div 
          className={`panel-resizer ${leftPanel.isResizing ? 'resizing' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); leftPanel.startResize(); }}
          style={{ display: leftPanel.isCollapsed ? 'none' : 'block' }}
        >
          <button 
            className="collapse-button left"
            onClick={leftPanel.toggle}
            title="收起左侧面板 (Ctrl+B)"
          >
            ◀
          </button>
        </div>

        {/* Left Panel Collapsed Button */}
        {leftPanel.isCollapsed && (
          <button 
            className="expand-button left"
            onClick={leftPanel.toggle}
            title="展开左侧面板 (Ctrl+B)"
          >
            ▶
          </button>
        )}

        {/* Center - Canvas */}
        <div
          className="canvas-container"
        >
          <DesignerCanvas 
            onComponentSelect={handleComponentSelect}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          />
        </div>

        {/* Right Panel Collapsed Button */}
        {rightPanel.isCollapsed && (
          <button 
            className="expand-button right"
            onClick={rightPanel.toggle}
            title="展开右侧面板 (Ctrl+Shift+B)"
          >
            ◀
          </button>
        )}

        {/* Resizer for right panel */}
        <div 
          className={`panel-resizer ${rightPanel.isResizing ? 'resizing' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); rightPanel.startResize(); }}
          style={{ display: rightPanel.isCollapsed ? 'none' : 'block' }}
        >
          <button 
            className="collapse-button right"
            onClick={rightPanel.toggle}
            title="收起右侧面板 (Ctrl+Shift+B)"
          >
            ▶
          </button>
        </div>

        {/* Right Panel - Properties */}
        <div className="right-panel" style={{ width: `${rightPanel.width}px`, display: rightPanel.isCollapsed ? 'none' : 'flex' }}>
          <PropertiesPanel />
        </div>
      </div>

      {/* View Relation Modal */}
      <ViewRelationModal
        visible={showViewRelationModal}
        onClose={() => setShowViewRelationModal(false)}
      />
    </div>
  );
};

export default App;
