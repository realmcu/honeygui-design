import React, { useRef, useState, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { Component, ComponentType } from '../types';
import { useCanvasZoom } from '../hooks/useCanvasZoom';
import { useCanvasDrag } from '../hooks/useCanvasDrag';
import { calculateComponentStyle, createComponentHandlers } from '../utils/componentRenderer';
import { componentRenderers } from './ComponentRenderers';
import './DesignerCanvas.css';

interface DesignerCanvasProps {
  onComponentSelect: (id: string | null) => void;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ onComponentSelect }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasBackground, setCanvasBackground] = useState<string>('#f0f0f0');
  const [pendingDragComponent, setPendingDragComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // 组件拖拽起始位置

  const {
    components,
    selectedComponent,
    selectedComponents,
    setHoveredComponent,
    draggedComponent,
    setDraggedComponent,
    zoom,
    setZoom,
    gridSize,
    snapToGrid,
    canvasOffset,
    setCanvasOffset,
    setComponents,
    updateComponent,
    removeComponent,
    removeComponents,
    editingMode,
    canvasSize,
    canvasBackgroundColor,
    addToSelection,
    setSelectedComponents,
  } = useDesignerStore();
  
  // 使用画布缩放 Hook
  const { handleWheel, showZoomHint } = useCanvasZoom(zoom, setZoom);
  
  // 使用画布拖拽 Hook
  const {
    isDragging,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp
  } = useCanvasDrag(canvasOffset, setCanvasOffset);
  
  // 当store中的画布背景色变化时更新本地状态
  useEffect(() => {
    if (canvasBackgroundColor && canvasBackgroundColor !== canvasBackground) {
      setCanvasBackground(canvasBackgroundColor);
    }
  }, [canvasBackgroundColor, canvasBackground]);

  const handleComponentMouseDown = (e: React.MouseEvent, componentId: string) => {
    e.stopPropagation();
    
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      addToSelection(componentId);
    } else {
      onComponentSelect(componentId);
    }

    // 计算鼠标相对于组件的偏移量
    const component = components.find(c => c.id === componentId);
    if (component && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / zoom;
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / zoom;
      
      setDragOffset({
        x: mouseX - component.position.x,
        y: mouseY - component.position.y,
      });
    }

    // 记录待拖动的组件和鼠标位置，但不立即开始拖动
    setPendingDragComponent(componentId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleComponentMouseMove = (e: React.MouseEvent) => {
    // 如果有待拖动的组件，检查是否移动了足够距离
    if (pendingDragComponent && !draggedComponent) {
      const deltaX = Math.abs(e.clientX - dragStart.x);
      const deltaY = Math.abs(e.clientY - dragStart.y);
      const threshold = 3; // 移动超过3px才开始拖动
      
      if (deltaX > threshold || deltaY > threshold) {
        setDraggedComponent(pendingDragComponent);
        setPendingDragComponent(null);
      }
    }
    
    if (draggedComponent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // 计算鼠标在画布中的位置
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / zoom;
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / zoom;
      
      // 减去偏移量得到组件左上角的位置
      const x = mouseX - dragOffset.x;
      const y = mouseY - dragOffset.y;

      const snapToGridValue = (value: number) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
      };

      const component = components.find(c => c.id === draggedComponent);
      if (component) {
        updateComponent(component.id, {
          position: {
            ...component.position,
            x: snapToGridValue(x),
            y: snapToGridValue(y),
          },
        });
      }
    }
  };

  const handleComponentMouseUp = () => {
    setPendingDragComponent(null);
    setDraggedComponent(null);
  };

  // 处理键盘事件，特别是delete键删除选中组件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 当按下delete或backspace键，并且有选中的组件时，删除该组件
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedComponent || (selectedComponents && selectedComponents.length > 0))) {
        // 阻止默认行为，避免在某些浏览器中可能的页面后退或其他默认操作
        e.preventDefault();
        const ids = selectedComponents && selectedComponents.length ? selectedComponents : [selectedComponent!];
        const confirmMsg = ids.length > 1 ? `确认删除选中的 ${ids.length} 个控件？` : '确认删除选中的控件？';
        const shouldDelete = window.confirm ? window.confirm(confirmMsg) : true;
        if (shouldDelete) {
          if (ids.length > 1) {
            removeComponents(ids);
          } else {
            removeComponent(ids[0]);
          }
          onComponentSelect(null);
          setSelectedComponents([]);
        }
      }
    };

    // 添加键盘事件监听器
    window.addEventListener('keydown', handleKeyDown);
    
    // 清理函数，移除事件监听器
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent, selectedComponents, removeComponent, removeComponents, onComponentSelect, setSelectedComponents]);

  const renderComponent = (component: Component, componentList: Component[] = components) => {
    const isSelected = selectedComponent === component.id;
    const isMultiSelected = selectedComponents?.includes(component.id);
    const isHovered = !draggedComponent && useDesignerStore.getState().hoveredComponent === component.id;

    const style = calculateComponentStyle(
      component,
      zoom,
      isSelected,
      isMultiSelected,
      isHovered,
      editingMode
    );

    const handleMouseEnter = () => {
      if (!draggedComponent) {
        setHoveredComponent(component.id);
      }
    };

    const handleMouseLeave = () => {
      if (!draggedComponent) {
        setHoveredComponent(null);
      }
    };

    const handlers = createComponentHandlers(
      component.id,
      handleComponentMouseDown,
      handleMouseEnter,
      handleMouseLeave
    );

    // 使用渲染器映射
    const Renderer = componentRenderers[component.type];
    
    if (!Renderer) {
      // 未知组件类型，显示占位符
      return (
        <div key={component.id} style={style} {...handlers}>
          ⚠️ {component.type}
        </div>
      );
    }

    // 容器组件需要渲染子组件
    const isContainer = ['hg_view', 'hg_panel', 'hg_window', 'hg_screen'].includes(component.type);
    
    if (isContainer) {
      const children = component.children?.map((childId) => {
        const child = componentList.find((c) => c.id === childId);
        return child ? renderComponent(child, componentList) : null;
      });

      return <Renderer component={component} style={style} handlers={handlers}>{children}</Renderer>;
    }

    return <Renderer component={component} style={style} handlers={handlers} />;
  };

  // Render grid - Clean and minimal style
  const renderGrid = () => {
    if (!snapToGrid || gridSize <= 0) return null;

    const gridElements = [];
    const gridSizePx = gridSize * zoom;
    const primaryGridInterval = 5;
    const width = canvasSize.width * zoom;
    const height = canvasSize.height * zoom;
    
    const secondaryGridStyle = {
      position: 'absolute' as const,
      background: 'rgba(255, 255, 255, 0.15)',
      pointerEvents: 'none' as const,
    };
    
    const primaryGridStyle = {
      position: 'absolute' as const,
      background: 'rgba(255, 255, 255, 0.25)',
      pointerEvents: 'none' as const,
    };

    // 垂直线
    for (let x = 0; x < width; x += gridSizePx) {
      const isPrimaryLine = x % (gridSizePx * primaryGridInterval) === 0;
      const lineStyle = isPrimaryLine ? primaryGridStyle : secondaryGridStyle;
      
      gridElements.push(
        <div
          key={`v-${x}`}
          style={{
            ...lineStyle,
            left: x,
            top: 0,
            width: 1,
            height: '100%',
          }}
        />
      );
    }

    // 水平线
    for (let y = 0; y < height; y += gridSizePx) {
      const isPrimaryLine = y % (gridSizePx * primaryGridInterval) === 0;
      const lineStyle = isPrimaryLine ? primaryGridStyle : secondaryGridStyle;
      
      gridElements.push(
        <div
          key={`h-${y}`}
          style={{
            ...lineStyle,
            left: 0,
            top: y,
            width: '100%',
            height: 1,
          }}
        />
      );
    }

    return gridElements;
  };

  // 扩展画布区域，使其成为可滚动的大型画布
  return (
    <div className="designer-canvas-container">
      {/* 可扩展的画布区域 */}
      <div
        ref={canvasRef}
        className="designer-canvas"
        style={{
            backgroundColor: canvasBackground,
            position: 'relative',
            minWidth: '100%',
            minHeight: '100%',
            cursor: isDragging && editingMode === 'select' ? 'grabbing' : editingMode === 'move' ? 'grab' : 'default',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
          }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleComponentMouseMove}
        onMouseUp={handleComponentMouseUp}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            handleWheel(e);
          }
        }}
        onMouseLeave={handleCanvasMouseUp}
        onContextMenu={(e) => {
          e.preventDefault();
          const ids = selectedComponents && selectedComponents.length ? selectedComponents : (selectedComponent ? [selectedComponent] : []);
          if (ids.length === 0) return;
          const label = ids.length > 1 ? `删除选中的 ${ids.length} 个控件` : '删除选中控件';
          const ok = window.confirm(`${label}？`);
          if (ok) {
            if (ids.length > 1) {
              removeComponents(ids);
            } else {
              removeComponent(ids[0]);
            }
            setSelectedComponents([]);
          }
        }}
      >
          {/* 缩放提示 */}
          {showZoomHint && (
            <div className="zoom-hint" style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              Ctrl+滚轮缩放 ({Math.round(zoom * 100)}%)
            </div>
          )}
          
          {/* Grid */}
        {renderGrid()}

        {/* Components */}
        <div
          style={{
            position: 'absolute',
            left: canvasOffset.x,
            top: canvasOffset.y,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
          }}
        >
          {/* 渲染所有顶级组件，并递归渲染其子组件 */}
          {components
            .filter((c) => c.parent === null)
            .map((component) => renderComponent(component))}
        </div>

        {/* Zoom indicator */}
        <div className="zoom-indicator">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
};

export default DesignerCanvas;
