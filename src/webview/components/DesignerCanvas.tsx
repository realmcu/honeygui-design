import React, { useRef, useState, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { Component, ComponentType } from '../types';
import './DesignerCanvas.css';

interface DesignerCanvasProps {
  onComponentSelect: (id: string | null) => void;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ onComponentSelect }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasOffsetStart, setCanvasOffsetStart] = useState({ x: 0, y: 0 });

  const {
    components,
    selectedComponent,
    setHoveredComponent,
    draggedComponent,
    setDraggedComponent,
    zoom,
    setZoom,
    gridSize,
    snapToGrid,
    canvasOffset,
    setCanvasOffset,
    updateComponent,
    removeComponent,
    editingMode,
    canvasSize,
    canvasBackgroundColor,
  } = useDesignerStore();

  // 处理鼠标滚轮事件，实现Ctrl+鼠标滚轮缩放画布
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // 检查是否按住了Ctrl键（在Mac上也支持Cmd键）
    if (e.ctrlKey || e.metaKey) {
      // 确保阻止默认行为
      e.preventDefault();
      e.stopPropagation();
      
      // 计算缩放增量
      const scaleAmount = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = zoom + scaleAmount;
      
      // 限制缩放范围
      const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
      
      // 更新缩放值
      setZoom(clampedZoom);
      
      // 调试日志（开发环境下可以取消注释）
      // console.log(`Zoom changed: ${zoom.toFixed(2)} -> ${clampedZoom.toFixed(2)}`);
    }
  };
  
  // 添加全局鼠标事件监听，确保Ctrl键状态正确检测
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      // 当鼠标在画布上且按住Ctrl键时，确保事件被正确处理
      if ((e.ctrlKey || e.metaKey) && canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // 添加全局监听作为备用机制
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // 在画布上显示缩放提示（当鼠标悬停时）
  const [showZoomHint, setShowZoomHint] = useState(false);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current) {
      onComponentSelect(null);

      // Start panning if not clicking on a component
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setCanvasOffsetStart({ x: canvasOffset.x, y: canvasOffset.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && editingMode === 'select') {
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

  const handleComponentMouseDown = (e: React.MouseEvent, componentId: string) => {
    e.stopPropagation();
    onComponentSelect(componentId);

    if (editingMode === 'move') {
      setDraggedComponent(componentId);
    }
  };

  const handleComponentMouseMove = (e: React.MouseEvent) => {
    if (draggedComponent && editingMode === 'move') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
      const y = (e.clientY - rect.top - canvasOffset.y) / zoom;

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
    setDraggedComponent(null);
  };

  // 处理键盘事件，特别是delete键删除选中组件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 当按下delete或backspace键，并且有选中的组件时，删除该组件
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponent) {
        // 阻止默认行为，避免在某些浏览器中可能的页面后退或其他默认操作
        e.preventDefault();
        // 调用store中的removeComponent函数删除选中的组件
        removeComponent(selectedComponent);
        // 清除选中状态
        onComponentSelect(null);
      }
    };

    // 添加键盘事件监听器
    window.addEventListener('keydown', handleKeyDown);
    
    // 清理函数，移除事件监听器
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent, removeComponent, onComponentSelect]);

  const renderComponent = (component: Component) => {
    const isSelected = selectedComponent === component.id;
    const isHovered = !draggedComponent && useDesignerStore.getState().hoveredComponent === component.id;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: component.position.x * zoom,
      top: component.position.y * zoom,
      width: component.position.width * zoom,
      height: component.position.height * zoom,
      display: component.visible ? 'flex' : 'none',
      opacity: component.enabled ? 1 : 0.6,
      cursor: editingMode === 'move' ? 'move' : 'pointer',
      border: isSelected ? '2px solid #007ACC' : isHovered ? '1px dashed #007ACC' : '1px solid transparent',
      background: component.style?.backgroundColor || 'transparent',
      color: component.style?.color || 'inherit',
      fontSize: component.style?.fontSize ? `${component.style.fontSize}px` : undefined,
      zIndex: component.zIndex,
      userSelect: 'none',
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onComponentSelect(component.id);
    };

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

    switch (component.type) {
      case 'button':
        return (
          <button
            key={component.id}
            style={style}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            disabled={!component.enabled}
          >
            {component.data?.text || component.name}
          </button>
        );

      case 'label':
        return (
          <div
            key={component.id}
            style={style}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {component.data?.text || component.name}
          </div>
        );

      case 'text':
        return (
          <span
            key={component.id}
            style={style}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {component.data?.text || component.name}
          </span>
        );

      case 'input':
        return (
          <input
            key={component.id}
            style={style}
            placeholder={component.data?.placeholder}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            disabled={!component.enabled}
          />
        );

      case 'image':
        return (
          <div
            key={component.id}
            style={{
              ...style,
              backgroundImage: component.data?.src ? `url(${component.data.src})` : undefined,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {!component.data?.src && '🖼️'}
          </div>
        );

      case 'panel':
      case 'view':
      case 'window':
        return (
          <div
            key={component.id}
            style={{
              ...style,
              border: isSelected
                ? '2px solid #007ACC'
                : component.type === 'window' ? (component.style?.border || '1px solid #ccc') : '1px solid #ccc',
              borderRadius: component.type === 'window' ? (component.style?.borderRadius || 6) : 0,
              background: component.type === 'window' ? (component.style?.backgroundColor || '#ffffff') : (component.style?.backgroundColor || '#f5f5f5'),
              padding: component.type === 'window' ? 0 : (component.style?.padding || 8),
              overflow: component.type === 'view' ? (component.style?.overflow || 'auto') : 'visible',
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {component.type === 'window' && (
              <div 
                style={{
                  height: component.style?.titleBarHeight || 36,
                  backgroundColor: component.style?.titleBarColor || '#f0f0f0',
                  borderTopLeftRadius: component.style?.borderRadius || 6,
                  borderTopRightRadius: component.style?.borderRadius || 6,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #e0e0e0',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleComponentMouseDown(e, component.id);
                }}
              >
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {component.style?.title || component.name}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff6b6b' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffd93d' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6bcb77' }}></div>
                </div>
              </div>
            )}
            <div style={{ padding: component.type === 'window' ? '12px' : 0 }}>
              <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>
                {component.name}
              </div>
              {component.children?.map((childId) => {
                const child = components.find((c) => c.id === childId);
                return child ? renderComponent(child) : null;
              })}
            </div>
          </div>
        );

      default:
        return (
          <div
            key={component.id}
            style={style}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {component.name}
          </div>
        );
    }
  };

  // Render grid - Optimized professional style with primary/secondary grid lines
  const renderGrid = () => {
    if (!snapToGrid || gridSize <= 0) return null;

    const gridElements = [];
    const gridSizePx = gridSize * zoom;
    // 主网格线间隔（通常是次网格线的倍数）
    const primaryGridInterval = 5; // 增加间隔使网格更清晰
    const width = canvasSize.width * zoom;
    const height = canvasSize.height * zoom;
    
    // 次网格线样式（更细、更柔和）
    const secondaryGridStyle = {
      position: 'absolute' as const,
      background: 'var(--vscode-editor-background)',
      opacity: 0.3,
      pointerEvents: 'none' as const,
    };
    
    // 主网格线样式（稍粗、更明显但不突兀）
    const primaryGridStyle = {
      position: 'absolute' as const,
      background: 'var(--vscode-editor-inactiveSelectionBackground)',
      opacity: 0.6,
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
            width: isPrimaryLine ? 1.2 : 0.8, // 优化线宽，使主网格更明显但不过粗
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
            height: isPrimaryLine ? 1.2 : 0.8, // 优化线宽，使主网格更明显但不过粗
          }}
        />
      );
    }

    return gridElements;
  };

  return (
    <div className="designer-canvas-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%'
    }}>
      <div
        ref={canvasRef}
        className="designer-canvas"
        style={{
            backgroundColor: canvasBackgroundColor || 'var(--vscode-editor-background)',
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            position: 'relative',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '2px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
            cursor: isDragging && editingMode === 'select' ? 'grabbing' : editingMode === 'move' ? 'grab' : 'default',
            backgroundImage: 'linear-gradient(45deg, var(--vscode-editor-inactiveSelectionBackground) 25%, transparent 25%, transparent 75%, var(--vscode-editor-inactiveSelectionBackground) 75%, var(--vscode-editor-inactiveSelectionBackground)), linear-gradient(45deg, var(--vscode-editor-inactiveSelectionBackground) 25%, transparent 25%, transparent 75%, var(--vscode-editor-inactiveSelectionBackground) 75%, var(--vscode-editor-inactiveSelectionBackground))',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
            backgroundBlendMode: 'overlay',
            opacity: 1,
            zIndex: 1,
            // 确保滚轮事件能够正确触发
            touchAction: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
          }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleComponentMouseMove}
        onMouseUp={handleComponentMouseUp}
        // 使用捕获模式绑定滚轮事件，确保优先处理
        onWheel={(e) => {
          e.stopPropagation();
          handleWheel(e);
        }}
        onMouseEnter={() => setShowZoomHint(true)}
        onMouseLeave={(e) => {
          setShowZoomHint(false);
          handleCanvasMouseUp();
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
