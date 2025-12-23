import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDesignerStore } from '../store';
import { Component, ComponentType } from '../types';
import { useCanvasZoom } from '../hooks/useCanvasZoom';
import { useCanvasDrag } from '../hooks/useCanvasDrag';
import { useContextMenu } from '../hooks/useContextMenu';
import { calculateComponentStyle, createComponentHandlers } from '../utils/componentRenderer';
import { widgetRegistry } from './widgets';
import { ContextMenu } from './ContextMenu';
import { executeMenuAction, MenuActionHelpers } from '../services/contextMenuActions';
import { ViewConnectionLayer } from './ViewConnectionLayer';
import './DesignerCanvas.css';

interface DesignerCanvasProps {
  onComponentSelect: (id: string | null) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ onComponentSelect, onDrop, onDragOver }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
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
    showViewConnections,
    projectConfig,
    allViews,
  } = useDesignerStore();
  
  // 使用画布缩放 Hook
  const { handleWheel, showZoomHint } = useCanvasZoom(zoom, setZoom, canvasOffset, setCanvasOffset);
  
  // 使用画布拖拽 Hook
  const {
    isDragging,
    isSpacePressed,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp
  } = useCanvasDrag(canvasOffset, setCanvasOffset);
  
  // 使用右键菜单 Hook
  const { menuState, showMenu, hideMenu } = useContextMenu();
  
  // 菜单动作辅助函数
  const menuActionHelpers: MenuActionHelpers = {
    updateComponent,
    removeComponent,
    selectComponent: onComponentSelect,
    moveComponentLayer: useDesignerStore.getState().moveComponentLayer,
    postMessage: (msg) => window.vscodeAPI?.postMessage(msg),
  };
  
  // 处理菜单动作
  const handleMenuAction = useCallback((actionId: string, component: Component) => {
    executeMenuAction(actionId, component, menuActionHelpers);
    hideMenu();
  }, [hideMenu, updateComponent, removeComponent, onComponentSelect]);
  
  // 处理组件右键菜单
  const handleComponentContextMenu = useCallback((e: React.MouseEvent, componentId: string) => {
    const component = components.find(c => c.id === componentId);
    if (component) {
      showMenu(e, component);
    }
  }, [components, showMenu]);
  
  // 监听来自ComponentTree的右键菜单事件
  useEffect(() => {
    const handleCustomContextMenu = (event: any) => {
      const { mouseEvent, componentId } = event.detail;
      const component = components.find(c => c.id === componentId);
      if (component) {
        // 创建一个模拟的MouseEvent用于showMenu
        const syntheticEvent = {
          ...mouseEvent,
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as React.MouseEvent;
        showMenu(syntheticEvent, component);
      }
    };
    
    window.addEventListener('component-context-menu', handleCustomContextMenu);
    return () => window.removeEventListener('component-context-menu', handleCustomContextMenu);
  }, [components, showMenu]);

  const handleComponentMouseDown = (e: React.MouseEvent, componentId: string) => {
    e.stopPropagation();
    
    let component = components.find(c => c.id === componentId);
    if (!component) return;
    
    // Alt + 点击：选中父容器
    if (e.altKey && component.parent) {
      const parentComponent = components.find(c => c.id === component!.parent);
      if (parentComponent) {
        component = parentComponent;
        componentId = parentComponent.id;
      }
    }
    
    // 选中当前组件（允许选中 locked 组件）
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      addToSelection(componentId);
    } else {
      onComponentSelect(componentId);
    }

    // 查找可拖拽的组件（如果当前组件被锁定，向上查找父组件）
    let draggableComponent: Component | undefined = component;
    while (draggableComponent && draggableComponent.locked && draggableComponent.parent) {
      draggableComponent = components.find(c => c.id === draggableComponent!.parent);
    }
    
    // 如果没有可拖拽的组件，则不记录拖拽信息
    if (!draggableComponent || draggableComponent.locked) {
      return;
    }

    // 计算鼠标相对于可拖拽组件的偏移量
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const effectiveZoom = zoom / (window.devicePixelRatio || 1);
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / effectiveZoom;
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / effectiveZoom;
      
      setDragOffset({
        x: mouseX - draggableComponent.position.x,
        y: mouseY - draggableComponent.position.y,
      });
    }

    // 记录待拖动的组件（是可拖拽的父组件，不是选中的组件）
    setPendingDragComponent(draggableComponent.id);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleComponentMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 先处理画布拖动
    handleCanvasMouseMove(e);
    
    // 如果正在拖动画布，不处理组件拖动
    if (isDragging) return;
    
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
      const effectiveZoom = zoom / (window.devicePixelRatio || 1);
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / effectiveZoom;
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / effectiveZoom;
      
      // 减去偏移量得到组件左上角的位置
      let x = mouseX - dragOffset.x;
      let y = mouseY - dragOffset.y;

      const component = components.find(c => c.id === draggedComponent);
      if (component) {
        x = Math.round(x);
        y = Math.round(y);
        
        updateComponent(component.id, {
          position: {
            ...component.position,
            x: x,
            y: y,
          },
        });
      }
    }
  };

  const handleComponentMouseUp = () => {
    handleCanvasMouseUp();
    setPendingDragComponent(null);
    setDraggedComponent(null);
  };

  // 处理键盘事件，特别是delete键删除选中组件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框、文本域或可编辑元素中，不处理快捷键
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

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

    // 检查是否为列表项
    const isListItem = component.type === 'hg_list_item';

    const style = calculateComponentStyle(
      component,
      zoom,
      isSelected,
      isMultiSelected,
      isHovered,
      editingMode,
      isListItem,
      projectConfig
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
      handleMouseLeave,
      handleComponentContextMenu
    );

    // 使用控件注册表
    const Widget = widgetRegistry[component.type];
    
    if (!Widget) {
      // 未知组件类型，显示占位符
      return (
        <div key={component.id} style={style} {...handlers}>
          ⚠️ {component.type}
        </div>
      );
    }

    // 容器组件需要渲染子组件
    const isContainer = ['hg_view', 'hg_window', 'hg_canvas', 'hg_list', 'hg_list_item'].includes(component.type);
    
    if (isContainer) {
      // 正常渲染所有子组件
      const children = component.children?.map((childId) => {
        const child = componentList.find((c) => c.id === childId);
        return child ? renderComponent(child, componentList) : null;
      });

      return <Widget component={component} style={style} handlers={handlers}>{children}</Widget>;
    }

    return <Widget component={component} style={style} handlers={handlers} />;
  };

  // 扩展画布区域，使其成为可滚动的大型画布
  return (
    <div className="designer-canvas-container">
      {/* 可扩展的画布区域 */}
      <div
        ref={canvasRef}
        className="designer-canvas"
        style={{
            backgroundColor: canvasBackgroundColor,
            position: 'relative',
            minWidth: '100%',
            minHeight: '100%',
            cursor: isDragging ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
          }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleComponentMouseMove}
        onMouseUp={handleComponentMouseUp}
        onDrop={onDrop}
        onDragOver={onDragOver}
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
          
        {/* Components and Grid Container - 无限画布 */}
        <div
          style={{
            position: 'absolute',
            left: canvasOffset.x,
            top: canvasOffset.y,
            transform: `scale(${zoom / (window.devicePixelRatio || 1)})`,
            transformOrigin: '0 0',
            // 移除固定尺寸限制，允许组件放置在任意位置
          }}
        >
          {/* 渲染所有顶级组件，并递归渲染其子组件 */}
          {components
            .filter((c) => c.parent === null)
            .map((component) => renderComponent(component))}
        </div>

        {/* 视图连接层 - 独立于组件层 */}
        <ViewConnectionLayer
          components={components}
          allViews={allViews || []}
          zoom={zoom / (window.devicePixelRatio || 1)}
          offset={canvasOffset}
          visible={showViewConnections}
        />

        {/* Zoom indicator */}
        <div className="zoom-indicator">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* 右键菜单 */}
      <ContextMenu
        visible={menuState.visible}
        x={menuState.x}
        y={menuState.y}
        component={menuState.component}
        onAction={handleMenuAction}
      />
    </div>
  );
};

export default DesignerCanvas;
