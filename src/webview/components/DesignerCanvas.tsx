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
    gridSize,
    snapToGrid,
    canvasOffset,
    setCanvasOffset,
    updateComponent,
    editingMode,
  } = useDesignerStore();

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

      case 'container':
      case 'panel':
        return (
          <div
            key={component.id}
            style={{
              ...style,
              border: isSelected
                ? '2px solid #007ACC'
                : '1px solid #ccc',
              background: component.style?.backgroundColor || '#f5f5f5',
              padding: component.style?.padding || 8,
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>
              {component.name}
            </div>
            {component.children?.map((childId) => {
              const child = components.find((c) => c.id === childId);
              return child ? renderComponent(child) : null;
            })}
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

  // Render grid
  const renderGrid = () => {
    if (!snapToGrid || gridSize <= 0) return null;

    const gridElements = [];
    const gridSizePx = gridSize * zoom;
    const width = 2000;
    const height = 2000;

    for (let x = 0; x < width; x += gridSizePx) {
      gridElements.push(
        <div
          key={`v-${x}`}
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            width: 1,
            height: '100%',
            background: '#f0f0f0',
            pointerEvents: 'none',
          }}
        />
      );
    }

    for (let y = 0; y < height; y += gridSizePx) {
      gridElements.push(
        <div
          key={`h-${y}`}
          style={{
            position: 'absolute',
            left: 0,
            top: y,
            width: '100%',
            height: 1,
            background: '#f0f0f0',
            pointerEvents: 'none',
          }}
        />
      );
    }

    return gridElements;
  };

  return (
    <div
      ref={canvasRef}
      className="designer-canvas"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleComponentMouseMove}
      onMouseUp={handleComponentMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      style={{
        cursor: isDragging && editingMode === 'select' ? 'grabbing' : editingMode === 'move' ? 'grab' : 'default',
      }}
    >
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
  );
};

export default DesignerCanvas;
