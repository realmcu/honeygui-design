import { useState } from 'react';

/**
 * 画布拖拽 Hook
 * 处理画布的拖拽移动
 */
export const useCanvasDrag = (
  canvasOffset: { x: number; y: number },
  setCanvasOffset: (offset: { x: number; y: number }) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasOffsetStart, setCanvasOffsetStart] = useState({ x: 0, y: 0 });

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setCanvasOffsetStart(canvasOffset);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setCanvasOffset({
        x: canvasOffsetStart.x + deltaX,
        y: canvasOffsetStart.y + deltaY,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  return {
    isDragging,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp
  };
};
