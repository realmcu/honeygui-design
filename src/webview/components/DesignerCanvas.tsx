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

  const renderComponent = (component: Component, componentList: Component[] = components) => {
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
      case 'screen':
        /**
         * Screen容器实现 - 画布层级结构中的根容器
         *
         * 功能特性：
         * 1. **层级管理**: 作为所有UI组件的顶级容器，所有非容器组件必须作为其子对象存在
         * 2. **视觉区分**: 提供清晰的视觉边界和标识，便于识别和管理
         * 3. **背景自定义**: 支持自定义背景色、边框、圆角等样式属性
         * 4. **自动创建**: 项目创建时自动生成，确保始终存在根容器
         *
         * 样式规范：
         * - 默认背景色: #ffffff (纯白色)，提供干净的画布基础
         * - 默认边框: 1px solid #dddddd (浅灰色)，提供清晰的容器边界
         * - 默认圆角: 8px，现代UI的圆润视觉效果
         * - 阴影效果: 0 4px 12px rgba(0, 0, 0, 0.15)，增强层次感和立体感
         * - 溢出处理: overflow: 'visible'，允许子组件超出边界(便于拖放操作)
         *
         * 组件关系：
         * - parent: null (顶级容器，没有父组件)
         * - children: [componentId1, componentId2, ...] (包含所有子组件ID)
         * - zIndex: 0 (基础层级，其他组件在其之上)
         *
         * @see ComponentLibrary.tsx - 组件库中的screen定义包含完整的属性配置
         * @see store.ts - createDefaultScreen() 函数负责创建默认screen实例
         */
        return (
          <div
            key={component.id}
            style={{
              ...style,
              // Screen容器样式 - 提供清晰的视觉层次和边界
              backgroundColor: component.style?.backgroundColor || '#ffffff',
              border: component.style?.border || '1px solid #dddddd',
              borderRadius: component.style?.borderRadius || '8px',
              // 添加阴影效果增强层次感
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              // 允许子组件溢出边界(拖放时临时超出)
              overflow: 'visible',
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Screen容器标题 - 提供明确的视觉标识 */}
            <div style={{
              position: 'absolute',
              top: '-22px',
              left: '0',
              backgroundColor: '#f0f0f0',
              padding: '2px 8px',
              fontSize: '12px',
              borderRadius: '4px 4px 0 0',
              border: '1px solid #dddddd',
              borderBottom: 'none',
              // 禁止鼠标事件穿透，确保标题区域可交互
              pointerEvents: 'auto',
            }}>
              {component.name || 'Screen'}
            </div>
            {/* 递归渲染所有子组件 - 确保正确的层级嵌套 */}
            {component.children?.map((childId) => {
              const child = componentList.find((c) => c.id === childId);
              return child ? renderComponent(child, componentList) : null;
            })}
          </div>
        );
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
      case 'canvas':
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
                : component.type === 'window'
                ? (component.style?.border || '1px solid #ccc') // Window组件使用自定义边框或默认
                : component.type === 'view'
                ? (component.style?.border || '1px dashed #bbb') // View组件使用虚线边框，表示可嵌套
                : (component.style?.border || '1px solid #ccc'), // Panel组件使用实线边框
              // 根据容器类型设置圆角
              borderRadius: component.type === 'window'
                ? (component.style?.borderRadius || 6) // Window组件圆角
                : component.type === 'view'
                ? (component.style?.borderRadius || 4) // View组件圆角
                : (component.style?.borderRadius || 0), // Panel组件默认无圆角
              // 根据容器类型设置背景色
              background: component.type === 'window'
                ? (component.style?.backgroundColor || '#ffffff') // Window默认白色背景
                : component.type === 'view'
                ? (component.style?.backgroundColor || '#f5f5f5') // View默认浅灰色，区分内容区域
                : (component.style?.backgroundColor || '#ffffff'), // Panel默认白色背景
              // 根据容器类型设置内边距
              padding: component.type === 'window'
                ? 0 // Window内边距由内容区域控制
                : component.type === 'view'
                ? (component.style?.padding || 12) // View默认内边距12px
                : (component.style?.padding || 8), // Panel默认内边距8px
              // 根据容器类型设置溢出处理
              overflow: component.type === 'view'
                ? (component.style?.overflow || 'auto') // View组件默认自动滚动，支持内容超出
                : component.type === 'panel'
                ? (component.style?.overflow || 'hidden') // Panel组件默认隐藏溢出
                : 'visible', // Window组件默认可见，不处理溢出
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Window组件渲染标题栏 - 模拟操作系统窗口外观 */}
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
            <div style={{ padding: component.type === 'window' ? '12px' : 0 }}>
              {/* 仅View组件显示名称标签(便于识别) */}
              {component.type === 'view' && (
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

  // 扩展画布区域，使其成为可滚动的大型画布
  return (
    <div className="designer-canvas-container" style={{
      display: 'flex',
      overflow: 'auto', // 允许容器滚动
      width: '100%',
      height: '100%'
    }}>
      {/* 可扩展的画布区域，移除固定宽度和高度限制 */}
      <div
        ref={canvasRef}
        className="designer-canvas"
        style={{
            backgroundColor: canvasBackground, // 使用本地状态的背景色
            position: 'relative',
            minWidth: '1200px', // 最小宽度
            minHeight: '800px', // 最小高度
            border: '1px solid var(--vscode-panel-border)',
            cursor: isDragging && editingMode === 'select' ? 'grabbing' : editingMode === 'move' ? 'grab' : 'default',
            backgroundImage: 'linear-gradient(45deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.05) 75%, rgba(0, 0, 0, 0.05)), linear-gradient(45deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.05) 75%, rgba(0, 0, 0, 0.05))',
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
          // 判断是否按下Ctrl键，是则缩放，否则滚动
          if (e.ctrlKey) {
            e.preventDefault();
            handleWheel(e);
          }
          // 否则允许默认滚动行为
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
