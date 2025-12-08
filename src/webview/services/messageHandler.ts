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
    position: { x: relativeX, y: relativeY, width: 200, height: 200 },
    visible: true,
    enabled: true,
    locked: false,
    zIndex: 1,
    children: [],
    parent: targetContainerId,
    style: {},
    data: { modelPath },
  };

  addComponent(component3D);
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

    default:
      // 未知消息类型
      break;
  }
};
