import { useState, useCallback, useRef } from 'react';
import { Component } from '../types';
import { ResizeDirection } from '../components/ResizeHandles';

interface ResizeState {
  isResizing: boolean;
  componentId: string | null;
  direction: ResizeDirection | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startPosX: number;
  startPosY: number;
}

interface UseComponentResizeProps {
  zoom: number;
  canvasOffset: { x: number; y: number };
  updateComponent: (id: string, updates: Partial<Component>) => void;
}

/**
 * 组件调整大小 Hook
 * 处理拖拽手柄调整组件宽高的逻辑
 */
export const useComponentResize = ({
  zoom,
  canvasOffset,
  updateComponent,
}: UseComponentResizeProps) => {
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    componentId: null,
    direction: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0,
  });

  // 使用 ref 存储最新的 resize 状态，避免闭包问题
  const resizeStateRef = useRef(resizeState);
  resizeStateRef.current = resizeState;

  /**
   * 开始调整大小
   */
  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    direction: ResizeDirection,
    componentId: string,
    component: Component
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setResizeState({
      isResizing: true,
      componentId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: component.position.width,
      startHeight: component.position.height,
      startPosX: component.position.x,
      startPosY: component.position.y,
    });
  }, []);

  /**
   * 调整大小过程中
   */
  const handleResizeMove = useCallback((e: MouseEvent, shiftKey: boolean = false) => {
    const state = resizeStateRef.current;
    if (!state.isResizing || !state.componentId || !state.direction) return;

    const effectiveZoom = zoom / (window.devicePixelRatio || 1);
    const deltaX = (e.clientX - state.startX) / effectiveZoom;
    const deltaY = (e.clientY - state.startY) / effectiveZoom;

    let newWidth = state.startWidth;
    let newHeight = state.startHeight;
    let newX = state.startPosX;
    let newY = state.startPosY;

    const minSize = 10; // 最小尺寸

    // 根据拖拽方向计算新的尺寸和位置
    switch (state.direction) {
      case 'e': // 右边
        newWidth = Math.max(minSize, state.startWidth + deltaX);
        break;
      case 'w': // 左边
        newWidth = Math.max(minSize, state.startWidth - deltaX);
        newX = state.startPosX + (state.startWidth - newWidth);
        break;
      case 's': // 下边
        newHeight = Math.max(minSize, state.startHeight + deltaY);
        break;
      case 'n': // 上边
        newHeight = Math.max(minSize, state.startHeight - deltaY);
        newY = state.startPosY + (state.startHeight - newHeight);
        break;
      case 'se': // 右下角
        newWidth = Math.max(minSize, state.startWidth + deltaX);
        newHeight = Math.max(minSize, state.startHeight + deltaY);
        break;
      case 'sw': // 左下角
        newWidth = Math.max(minSize, state.startWidth - deltaX);
        newX = state.startPosX + (state.startWidth - newWidth);
        newHeight = Math.max(minSize, state.startHeight + deltaY);
        break;
      case 'ne': // 右上角
        newWidth = Math.max(minSize, state.startWidth + deltaX);
        newHeight = Math.max(minSize, state.startHeight - deltaY);
        newY = state.startPosY + (state.startHeight - newHeight);
        break;
      case 'nw': // 左上角
        newWidth = Math.max(minSize, state.startWidth - deltaX);
        newX = state.startPosX + (state.startWidth - newWidth);
        newHeight = Math.max(minSize, state.startHeight - deltaY);
        newY = state.startPosY + (state.startHeight - newHeight);
        break;
    }

    // Shift 键保持宽高比
    if (shiftKey && ['se', 'sw', 'ne', 'nw'].includes(state.direction)) {
      const aspectRatio = state.startWidth / state.startHeight;
      const widthFromHeight = newHeight * aspectRatio;
      const heightFromWidth = newWidth / aspectRatio;

      // 选择变化较小的维度来保持比例
      if (Math.abs(newWidth - state.startWidth) > Math.abs(newHeight - state.startHeight)) {
        newHeight = heightFromWidth;
        if (state.direction === 'ne' || state.direction === 'nw') {
          newY = state.startPosY + (state.startHeight - newHeight);
        }
      } else {
        newWidth = widthFromHeight;
        if (state.direction === 'sw' || state.direction === 'nw') {
          newX = state.startPosX + (state.startWidth - newWidth);
        }
      }
    }

    // 四舍五入到整数
    newWidth = Math.round(newWidth);
    newHeight = Math.round(newHeight);
    newX = Math.round(newX);
    newY = Math.round(newY);

    updateComponent(state.componentId, {
      position: {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      },
    });
  }, [zoom, updateComponent]);

  /**
   * 结束调整大小
   */
  const handleResizeEnd = useCallback(() => {
    setResizeState({
      isResizing: false,
      componentId: null,
      direction: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPosX: 0,
      startPosY: 0,
    });
  }, []);

  return {
    isResizing: resizeState.isResizing,
    resizingComponentId: resizeState.componentId,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
};

export default useComponentResize;
