import React, { useRef, useState, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { Component, ComponentType } from '../types';
import './DesignerCanvas.css';

interface DesignerCanvasProps {
  onComponentSelect: (id: string | null) => void;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ onComponentSelect }) => {
  // 设置画布默认背景色为灰色，作为任务1的一部分
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasOffsetStart, setCanvasOffsetStart] = useState({ x: 0, y: 0 });
  const [canvasBackground, setCanvasBackground] = useState<string>('#f0f0f0'); // 默认灰色背景

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
  
  // 当store中的画布背景色变化时更新本地状态
  useEffect(() => {
    if (canvasBackgroundColor && canvasBackgroundColor !== canvasBackground) {
      setCanvasBackground(canvasBackgroundColor);
    }
  }, [canvasBackgroundColor, canvasBackground]);

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
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      addToSelection(componentId);
    } else {
      onComponentSelect(componentId);
    }

    // 选中即可拖动，不需要切换到移动模式
    setDraggedComponent(componentId);
  };

  const handleComponentMouseMove = (e: React.MouseEvent) => {
    if (draggedComponent) {
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
    if (draggedComponent) {
      const component = components.find(c => c.id === draggedComponent);
      if (!component) {
        setDraggedComponent(null);
        return;
      }
      
      const { x, y, width, height } = component.position;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      let newParent: string | undefined = undefined;
      
      // 查找包含组件中心点的容器（从后往前，优先上层容器）
      for (let i = components.length - 1; i >= 0; i--) {
        const container = components[i];
        if ((container.type === 'hg_view' || container.type === 'hg_panel' || container.type === 'hg_window') &&
            container.id !== component.id) {
          const { x: cx, y: cy, width: cw, height: ch } = container.position;
          if (centerX >= cx && centerX <= cx + cw && 
              centerY >= cy && centerY <= cy + ch) {
            newParent = container.id;
            break;
          }
        }
      }
      
      // 如果父容器发生变化，批量更新所有相关组件
      if (newParent !== component.parent) {
        const updates: Array<{ id: string; updates: Partial<Component> }> = [];
        
        // 1. 从旧父容器的children中移除
        if (component.parent) {
          const oldParent = components.find(c => c.id === component.parent);
          if (oldParent?.children) {
            updates.push({
              id: component.parent,
              updates: { children: oldParent.children.filter(id => id !== draggedComponent) }
            });
          }
        }
        
        // 2. 添加到新父容器的children中
        if (newParent) {
          const newParentComp = components.find(c => c.id === newParent);
          if (newParentComp) {
            updates.push({
              id: newParent,
              updates: { children: [...(newParentComp.children || []), draggedComponent] }
            });
          }
        }
        
        // 3. 转换坐标系统：从画布绝对坐标转换为相对于新父容器的坐标
        let newX = x;
        let newY = y;
        if (newParent) {
          const newParentComp = components.find(c => c.id === newParent);
          if (newParentComp) {
            newX = x - newParentComp.position.x;
            newY = y - newParentComp.position.y;
          }
        }
        
        // 4. 更新组件的parent属性和坐标
        updates.push({
          id: draggedComponent,
          updates: { 
            parent: newParent,
            position: { ...component.position, x: newX, y: newY }
          }
        });
        
        // 批量应用所有更新
        setComponents(components.map(c => {
          const update = updates.find(u => u.id === c.id);
          return update ? { ...c, ...update.updates } : c;
        }));
      }
    }
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

    const style: React.CSSProperties = {
      position: 'absolute',
      left: component.position.x * zoom,
      top: component.position.y * zoom,
      width: component.position.width * zoom,
      height: component.position.height * zoom,
      display: component.visible ? 'flex' : 'none',
      opacity: component.enabled ? 1 : 0.6,
      cursor: editingMode === 'move' ? 'move' : 'pointer',
      border: isSelected || isMultiSelected ? '2px solid #007ACC' : isHovered ? '1px dashed #007ACC' : '1px solid transparent',
      background: component.style?.backgroundColor || 'transparent',
      color: component.style?.color || 'inherit',
      fontSize: component.style?.fontSize ? `${component.style.fontSize}px` : undefined,
      zIndex: component.zIndex,
      userSelect: 'none',
    };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      addToSelection(component.id);
    } else {
      onComponentSelect(component.id);
    }
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
      case 'hg_button':
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

      case 'hg_label':
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

      case 'hg_text':
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

      case 'hg_input':
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

      case 'hg_image':
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

      case 'hg_panel':
      case 'hg_view':
      case 'hg_window':
      case 'hg_canvas':
        /**
         * View/Panel/Window/Canvas 容器组件实现 - 支持嵌套布局和多容器并行
         *
         * 功能特性：
         * 1. **多容器支持**: 容器组件可作为独立顶级容器，实现多容器并行布局
         * 2. **嵌套能力**: 所有容器组件都支持包含子组件，形成层级结构
         * 3. **视觉区分**: 不同类型容器有不同的默认样式和视觉特征
         * 4. **灵活布局**: 支持在screen内部或外部放置，满足不同场景需求
         *
         * 组件类型特性：
         * - View (👁️): 通用视图容器，默认浅灰背景，支持自动滚动
         *   * 用途: 分组组件、创建独立区域、实现复杂布局
         *   * 样式: background: '#f5f5f5', overflow: 'auto'
         *   * 层级: 可以作为screen的子组件，也可以作为顶级组件
         *
         * - Panel (🪟): 面板容器，默认白色背景
         *   * 用途: 内容分组、卡片式布局
         *   * 样式: background: '#ffffff'
         *   * 层级: 通常作为screen的子组件
         *
         * - Window (🪟): 窗口容器，模拟操作系统窗口外观
         *   * 用途: 对话框、独立功能模块
         *   * 样式: 包含标题栏、窗口控制按钮(关闭、最小化、最大化)
         *   * 层级: 可以作为顶级组件
         *
         * - Canvas (🎨): 画布组件，用于绘图或自定义渲染
         *   * 用途: 绘图区域、游戏画布、自定义UI
         *   * 样式: background: '#ffffff', border, overflow控制
         *   * 层级: 通常作为screen的子组件
         *   * 注意: 这是UI组件，不是设计器画布
         *
         * 布局策略：
         * - 容器组件拖放到画布: 可以作为顶级组件放置（多容器并行）
         * - 容器组件拖放到screen内部: 作为screen的子组件（嵌套布局）
         * - 容器组件拖放到其他View内部: 支持多级嵌套
         *
         * 组件关系：
         * - parent: string | null (父组件ID，顶级组件为null)
         * - children: string[] (子组件ID数组)
         * - zIndex: number (层级顺序，可控制显示层级)
         *
         * 尺寸控制：
         * - 所有容器组件都遵循组件库中定义的defaultSize
         * - 可在属性面板中手动调整尺寸
         *
         * @see ComponentLibrary.tsx - componentDefinitions包含各容器类型的默认尺寸
         * @see App.tsx handleCanvasDrop() - 拖放逻辑决定组件的parent和层级关系
         * @see PropertiesPanel.tsx - 属性面板支持调整容器样式和尺寸
         */
        return (
          <div
            key={component.id}
            style={{
              ...style,
              // 根据容器类型设置边框样式 - 选中状态高亮显示，非选中状态显示默认边框
              border: isSelected
                ? '2px solid #007ACC' // 选中时高亮边框（蓝色）
                : component.type === 'hg_window'
                ? (component.style?.border || '1px solid #ccc') // Window组件使用自定义边框或默认
                : component.type === 'hg_view'
                ? (component.style?.border || '2px solid #666') // View组件使用实线边框，更明显
                : (component.style?.border || '1px solid #ccc'), // Panel组件使用实线边框
              // 根据容器类型设置圆角
              borderRadius: component.type === 'hg_window'
                ? (component.style?.borderRadius || 6) // Window组件圆角
                : component.type === 'hg_view'
                ? (component.style?.borderRadius || 4) // View组件圆角
                : (component.style?.borderRadius || 0), // Panel组件默认无圆角
              // 根据容器类型设置背景色
              background: component.type === 'hg_window'
                ? (component.style?.backgroundColor || '#ffffff') // Window默认白色背景
                : component.type === 'hg_view'
                ? (component.style?.backgroundColor || '#ffffff') // View默认白色背景，便于在深色画布上看清
                : (component.style?.backgroundColor || '#ffffff'), // Panel默认白色背景
              // 根据容器类型设置内边距
              padding: component.type === 'hg_window'
                ? 0 // Window内边距由内容区域控制
                : component.type === 'hg_view'
                ? (component.style?.padding || 12) // View默认内边距12px
                : (component.style?.padding || 8), // Panel默认内边距8px
              // 根据容器类型设置溢出处理
              overflow: component.type === 'hg_view'
                ? (component.style?.overflow || 'auto') // View组件默认自动滚动，支持内容超出
                : component.type === 'hg_panel'
                ? (component.style?.overflow || 'hidden') // Panel组件默认隐藏溢出
                : 'visible', // Window组件默认可见，不处理溢出
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Window组件渲染标题栏 - 模拟操作系统窗口外观 */}
            {component.type === 'hg_window' && (
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
                  cursor: 'move', // 标题栏显示移动光标，提示可拖动
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleComponentMouseDown(e, component.id);
                }}
              >
                {/* 窗口标题 */}
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {component.style?.title || component.name}
                </span>
                {/* 窗口控制按钮 (关闭、最小化、最大化) */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff6b6b' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffd93d' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6bcb77' }}></div>
                </div>
              </div>
            )}
            {/* 容器内容区域 - 根据类型设置不同内边距 */}
            <div style={{ padding: component.type === 'hg_window' ? '12px' : 0 }}>
              {/* 仅View组件显示名称标签(便于识别) */}
              {component.type === 'hg_view' && (
                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px', fontWeight: 500 }}>
                  {component.name}
                </div>
              )}
              {/* 递归渲染子组件 - 支持嵌套结构 */}
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
        onMouseEnter={() => setShowZoomHint(true)}
        onMouseLeave={(e) => {
          setShowZoomHint(false);
          handleCanvasMouseUp();
        }}
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
