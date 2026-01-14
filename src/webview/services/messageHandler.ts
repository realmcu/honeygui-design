import { Component } from '../types';
import { getAbsolutePosition } from '../utils/componentUtils';

/**
 * 创建图片组件的统一函数
 */
export const createImageComponentAtPosition = (
  imagePath: string,
  dropPosition: { x: number; y: number },
  targetContainerId: string,
  components: Component[],
  addComponent: (component: Component) => void,
  imageSize?: { width: number; height: number }
): void => {
  const targetContainer = components.find(c => c.id === targetContainerId);
  if (!targetContainer) return;

  const targetAbsPos = getAbsolutePosition(targetContainer, components);
  const relativeX = Math.max(0, dropPosition.x - targetAbsPos.x);
  const relativeY = Math.max(0, dropPosition.y - targetAbsPos.y);

  const width = imageSize?.width || 100;
  const height = imageSize?.height || 100;

  const imageComponent: Component = {
    id: `hg_image_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'hg_image',
    name: `image_${Date.now().toString().substr(-4)}`,
    position: { x: relativeX, y: relativeY, width, height },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { src: imagePath },
  };

  addComponent(imageComponent);
};

/**
 * 创建3D组件的统一函数
 */
export const create3DComponentAtPosition = (
  modelPath: string,
  dropPosition: { x: number; y: number },
  targetContainerId: string,
  components: Component[],
  addComponent: (component: Component) => void
): void => {
  const targetContainer = components.find(c => c.id === targetContainerId);
  if (!targetContainer) return;

  const targetAbsPos = getAbsolutePosition(targetContainer, components);
  const relativeX = Math.max(0, dropPosition.x - targetAbsPos.x);
  const relativeY = Math.max(0, dropPosition.y - targetAbsPos.y);

  const component3D: Component = {
    id: `hg_3d_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'hg_3d',
    name: `model_${Date.now().toString().substr(-4)}`,
    position: { x: relativeX, y: relativeY, width: 400, height: 400 },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { 
      modelPath,
      worldX: 0,
      worldY: 0,
      worldZ: 30,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 5,
      cameraPosX: 0,
      cameraPosY: 0,
      cameraPosZ: 0,
      cameraLookX: 0,
      cameraLookY: 0,
      cameraLookZ: 1,
    },
  };

  addComponent(component3D);
};

/**
 * 创建视频组件的统一函数
 */
export const createVideoComponentAtPosition = (
  videoPath: string,
  dropPosition: { x: number; y: number },
  targetContainerId: string,
  components: Component[],
  addComponent: (component: Component) => void,
  videoSize?: { width: number; height: number }
): void => {
  const targetContainer = components.find(c => c.id === targetContainerId);
  if (!targetContainer) return;

  const targetAbsPos = getAbsolutePosition(targetContainer, components);
  const relativeX = Math.max(0, dropPosition.x - targetAbsPos.x);
  const relativeY = Math.max(0, dropPosition.y - targetAbsPos.y);

  // 使用视频真实尺寸，如果没有则使用默认值 320x240
  const { width, height } = videoSize || { width: 320, height: 240 };

  const videoComponent: Component = {
    id: `hg_video_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'hg_video',
    name: `video_${Date.now().toString().substr(-4)}`,
    position: { x: relativeX, y: relativeY, width, height },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { src: videoPath },
  };

  addComponent(videoComponent);
};

/**
 * 创建 SVG 组件的统一函数
 */
export const createSvgComponentAtPosition = (
  svgPath: string,
  dropPosition: { x: number; y: number },
  targetContainerId: string,
  components: Component[],
  addComponent: (component: Component) => void,
  size?: { width: number; height: number }
): void => {
  const targetContainer = components.find(c => c.id === targetContainerId);
  if (!targetContainer) return;

  const targetAbsPos = getAbsolutePosition(targetContainer, components);
  const relativeX = Math.max(0, dropPosition.x - targetAbsPos.x);
  const relativeY = Math.max(0, dropPosition.y - targetAbsPos.y);

  const svgComponent: Component = {
    id: `hg_svg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'hg_svg',
    name: `svg_${Date.now().toString().substr(-4)}`,
    position: { 
      x: relativeX, 
      y: relativeY, 
      width: size?.width || 100, 
      height: size?.height || 100 
    },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { src: svgPath },
  };

  addComponent(svgComponent);
};

/**
 * 创建 Glass 组件的统一函数
 */
export const createGlassComponentAtPosition = (
  glassPath: string,
  dropPosition: { x: number; y: number },
  targetContainerId: string,
  components: Component[],
  addComponent: (component: Component) => void,
  size?: { width: number; height: number }
): void => {
  const targetContainer = components.find(c => c.id === targetContainerId);
  if (!targetContainer) return;

  const targetAbsPos = getAbsolutePosition(targetContainer, components);
  const relativeX = Math.max(0, dropPosition.x - targetAbsPos.x);
  const relativeY = Math.max(0, dropPosition.y - targetAbsPos.y);

  const glassComponent: Component = {
    id: `hg_glass_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'hg_glass',
    name: `glass_${Date.now().toString().substr(-4)}`,
    position: { 
      x: relativeX, 
      y: relativeY, 
      width: size?.width || 150, 
      height: size?.height || 150 
    },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { 
      src: glassPath,
      distortion: 10,  // 默认扭曲强度 10%
      region: 50       // 默认效果区域 50%
    },
  };

  addComponent(glassComponent);
};

/**
 * 处理从后端接收的消息
 */
export const handleBackendMessage = (
  message: any,
  handlers: {
    setComponents: (components: Component[]) => void;
    setProjectConfig: (config: any) => void;
    setCanvasBackgroundColor: (color: string) => void;
    selectComponent: (id: string | null) => void;
    addComponent: (component: Component) => void;
    components: Component[];
  }
): void => {
  const { setComponents, setProjectConfig, setCanvasBackgroundColor, selectComponent, addComponent, components } = handlers;

  switch (message.command) {
    case 'loadHml':
      if (message.components) {
        setComponents(message.components);
      }
      if (message.projectConfig) {
        setProjectConfig(message.projectConfig);
      }
      if (message.canvasBackgroundColor) {
        setCanvasBackgroundColor(message.canvasBackgroundColor);
      }
      break;

    case 'componentSelected':
      if (message.componentId) {
        selectComponent(message.componentId);
      }
      break;

    case 'createImageComponent':
      if (message.imagePath && message.targetContainerId && message.dropPosition) {
        createImageComponentAtPosition(
          message.imagePath,
          message.dropPosition,
          message.targetContainerId,
          components,
          addComponent,
          message.imageSize
        );
      }
      break;

    case 'createSvgComponent':
      if (message.svgPath && message.targetContainerId && message.dropPosition) {
        createSvgComponentAtPosition(
          message.svgPath,
          message.dropPosition,
          message.targetContainerId,
          components,
          addComponent,
          message.size
        );
      }
      break;

    case 'deleteComponentsByImagePath':
      if (message.imagePath) {
        const componentsToDelete = components.filter(
          c => c.type === 'hg_image' && c.data?.src === message.imagePath
        );
        if (componentsToDelete.length > 0) {
          // 这里需要从外部传入 removeComponents 方法
          console.log(`[删除组件] 需要删除 ${componentsToDelete.length} 个引用 ${message.imagePath} 的图片组件`);
        }
      }
      break;

    case 'pathConverted':
      // 路径转换结果，由 useWebviewUri hook 处理
      break;

    case 'assetsLoaded':
      // 资源加载完成，由 AssetsPanel 处理
      break;

    case 'undoRedoState':
      // 更新撤销/重做状态
      if (typeof message.canUndo === 'boolean') {
        // 通过 store 的 undoStack/redoStack 长度来表示状态
        // 这里用一个简单的方式：设置一个标记数组
        const { set } = require('../store').useDesignerStore.getState();
        // 直接更新 store 状态
        require('../store').useDesignerStore.setState({
          undoStack: message.canUndo ? ['placeholder'] : [],
          redoStack: message.canRedo ? ['placeholder'] : []
        });
      }
      break;

    default:
      // 未知消息类型
      break;
  }
};
