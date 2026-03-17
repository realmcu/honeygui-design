import { useEffect, useState } from 'react';

/**
 * 画布缩放 Hook
 * 处理 Ctrl+滚轮缩放和提示显示
 */
export const useCanvasZoom = (
  zoom: number,
  setZoom: (zoom: number) => void,
  canvasOffset: { x: number; y: number },
  setCanvasOffset: (offset: { x: number; y: number }) => void
) => {
  const [showZoomHint, setShowZoomHint] = useState(false);

  /**
   * 处理鼠标滚轮事件，实现Ctrl+鼠标滚轮缩放画布
   * 以鼠标位置为中心进行缩放
   */
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // 检查是否按住了Ctrl键（在Mac上也支持Cmd键）
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // 计算缩放增量
      const scaleAmount = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = zoom + scaleAmount;
      
      // 限制缩放范围
      const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
      
      // 获取鼠标相对于画布内容区域的位置（需加上滚动偏移）
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + e.currentTarget.scrollLeft;
      const mouseY = e.clientY - rect.top + e.currentTarget.scrollTop;
      
      // 计算缩放比例
      const scale = clampedZoom / zoom;
      
      // 计算新的偏移量，使鼠标位置保持不变
      const newOffsetX = mouseX - (mouseX - canvasOffset.x) * scale;
      const newOffsetY = mouseY - (mouseY - canvasOffset.y) * scale;
      
      // 更新缩放值和偏移量
      setZoom(clampedZoom);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }
  };

  /**
   * 全局滚轮事件监听 - 显示缩放提示
   */
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setShowZoomHint(true);
        setTimeout(() => setShowZoomHint(false), 2000);
      }
    };

    window.addEventListener('wheel', handleGlobalWheel);
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  return {
    handleWheel,
    showZoomHint
  };
};
