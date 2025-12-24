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
import { AlignmentGuides, AlignmentLine } from './AlignmentGuides';
import { calculateAlignment } from '../utils/alignmentHelper';
import { getAbsolutePosition, findComponentAtPosition, isContainerType } from '../utils/componentUtils';
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
  const [alignmentLines, setAlignmentLines] = useState<AlignmentLine[]>([]); // 对齐辅助线
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 }); // 最后鼠标位置（画布坐标）
  const [multiDragOffsets, setMultiDragOffsets] = useState<Map<string, { x: number; y: number }>>(new Map()); // 多选拖拽偏移量

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
    moveComponent,
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
    copyComponent: useDesignerStore.getState().copyComponent,
    cutComponent: useDesignerStore.getState().cutComponent,
    pasteComponent: useDesignerStore.getState().pasteComponent,
    duplicateComponent: useDesignerStore.getState().duplicateComponent,
    copySelectedComponents: useDesignerStore.getState().copySelectedComponents,
    cutSelectedComponents: useDesignerStore.getState().cutSelectedComponents,
    alignSelectedComponents: useDesignerStore.getState().alignSelectedComponents,
    postMessage: (msg) => window.vscodeAPI?.postMessage(msg),
  };
  
  // 处理菜单动作
  const handleMenuAction = useCallback((actionId: string, component: Component) => {
    // 多选时的特殊处理
    if (selectedComponents.length > 1) {
      if (actionId === 'copy') {
        menuActionHelpers.copySelectedComponents();
        hideMenu();
        return;
      }
      if (actionId === 'cut') {
        menuActionHelpers.cutSelectedComponents();
        hideMenu();
        return;
      }
    }
    executeMenuAction(actionId, component, menuActionHelpers);
    hideMenu();
  }, [hideMenu, updateComponent, removeComponent, onComponentSelect, selectedComponents]);
  
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
      
      // 多选拖拽：记录所有选中组件的偏移量
      if (selectedComponents.length > 1 && selectedComponents.includes(componentId)) {
        const offsets = new Map<string, { x: number; y: number }>();
        selectedComponents.forEach(id => {
          const comp = components.find(c => c.id === id);
          if (comp && !comp.locked) {
            offsets.set(id, {
              x: mouseX - comp.position.x,
              y: mouseY - comp.position.y,
            });
          }
        });
        setMultiDragOffsets(offsets);
      } else {
        setMultiDragOffsets(new Map());
      }
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

      // 计算鼠标在画布中的位置（统一使用 zoom，不用 dpr）
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / zoom;
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / zoom;
      
      // 记录最后鼠标位置（用于 mouseUp 时判断目标容器）
      setLastMousePos({ x: mouseX, y: mouseY });
      
      // 多选拖拽
      if (multiDragOffsets.size > 1) {
        multiDragOffsets.forEach((offset, id) => {
          const comp = components.find(c => c.id === id);
          if (comp) {
            const newX = Math.round(mouseX - offset.x);
            const newY = Math.round(mouseY - offset.y);
            updateComponent(id, {
              position: { ...comp.position, x: newX, y: newY },
            });
          }
        });
        setAlignmentLines([]); // 多选时不显示辅助线
        return;
      }
      
      // 单选拖拽
      const x = mouseX - dragOffset.x;
      const y = mouseY - dragOffset.y;

      const component = components.find(c => c.id === draggedComponent);
      if (component) {
        // 实时检测目标容器（用于跨容器拖拽时的辅助线计算）
        const targetContainer = findComponentAtPosition(mouseX, mouseY, components);
        const effectiveParent = (targetContainer && targetContainer.id !== component.id) 
          ? targetContainer.id 
          : component.parent;
        
        // 如果目标容器与当前父容器不同，需要转换坐标到目标容器的相对坐标系
        let relativeX = x;
        let relativeY = y;
        if (effectiveParent !== component.parent && targetContainer) {
          const targetAbsPos = getAbsolutePosition(targetContainer, components);
          const componentAbsPos = getAbsolutePosition(component, components);
          relativeX = (componentAbsPos.x - targetAbsPos.x) + (x - component.position.x);
          relativeY = (componentAbsPos.y - targetAbsPos.y) + (y - component.position.y);
        }
        
        // 创建临时组件用于辅助线计算
        const tempComponent = effectiveParent !== component.parent
          ? { ...component, parent: effectiveParent }
          : component;
        
        // 计算对齐辅助线和吸附位置
        const alignment = calculateAlignment(
          tempComponent,
          effectiveParent !== component.parent ? relativeX : x,
          effectiveParent !== component.parent ? relativeY : y,
          components,
          canvasSize
        );
        
        setAlignmentLines(alignment.lines);
        
        // 使用吸附后的位置
        if (effectiveParent !== component.parent && targetContainer) {
          const targetAbsPos = getAbsolutePosition(targetContainer, components);
          const parentAbsPos = component.parent 
            ? getAbsolutePosition(components.find(c => c.id === component.parent)!, components)
            : { x: 0, y: 0 };
          const snappedAbsX = targetAbsPos.x + alignment.x;
          const snappedAbsY = targetAbsPos.y + alignment.y;
          updateComponent(component.id, {
            position: { ...component.position, x: snappedAbsX - parentAbsPos.x, y: snappedAbsY - parentAbsPos.y },
          });
        } else {
          updateComponent(component.id, {
            position: { ...component.position, x: alignment.x, y: alignment.y },
          });
        }
      }
    }
  };

  const handleComponentMouseUp = () => {
    // 处理跨容器拖拽
    if (draggedComponent) {
      // 多选跨容器拖拽
      if (multiDragOffsets.size > 1) {
        const targetContainer = findComponentAtPosition(lastMousePos.x, lastMousePos.y, components);
        if (targetContainer) {
          multiDragOffsets.forEach((_, id) => {
            const comp = components.find(c => c.id === id);
            if (comp && !isContainerType(comp.type) && targetContainer.id !== comp.parent && targetContainer.id !== comp.id) {
              const targetAbsPos = getAbsolutePosition(targetContainer, components);
              const compAbsPos = getAbsolutePosition(comp, components);
              const newX = Math.round(compAbsPos.x - targetAbsPos.x);
              const newY = Math.round(compAbsPos.y - targetAbsPos.y);
              
              updateComponent(comp.id, {
                position: { ...comp.position, x: newX, y: newY },
              });
              moveComponent(comp.id, targetContainer.id);
            }
          });
        }
      } else {
        // 单选跨容器拖拽
        const component = components.find(c => c.id === draggedComponent);
        
        if (component && !isContainerType(component.type)) {
          const targetContainer = findComponentAtPosition(lastMousePos.x, lastMousePos.y, components);
          
          if (targetContainer && targetContainer.id !== component.parent && targetContainer.id !== component.id) {
            const oldParent = component.parent;
            const targetAbsPos = getAbsolutePosition(targetContainer, components);
            const componentAbsPos = getAbsolutePosition(component, components);
            
            const newX = Math.round(componentAbsPos.x - targetAbsPos.x);
            const newY = Math.round(componentAbsPos.y - targetAbsPos.y);
            
            console.log(`[跨容器拖拽] ${component.id}: ${oldParent || '顶层'} → ${targetContainer.id}, 坐标: (${newX}, ${newY})`);
            
            updateComponent(component.id, {
              position: { ...component.position, x: newX, y: newY },
            });
            moveComponent(component.id, targetContainer.id);
          }
        }
      }
    }
    
    handleCanvasMouseUp();
    setPendingDragComponent(null);
    setDraggedComponent(null);
    setAlignmentLines([]);
    setMultiDragOffsets(new Map());
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
      projectConfig,
      components,
      draggedComponent
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
          
          {/* 拖拽中的组件 - 渲染到顶层（仅非容器组件） */}
          {draggedComponent && (() => {
            // 多选拖拽：渲染所有选中的非容器组件
            const dragIds = multiDragOffsets.size > 1 
              ? Array.from(multiDragOffsets.keys())
              : [draggedComponent];
            
            return dragIds.map(id => {
              const comp = components.find(c => c.id === id);
              if (!comp) return null;
              
              // 容器组件不渲染顶层副本
              const isContainer = ['hg_view', 'hg_window', 'hg_canvas', 'hg_list', 'hg_list_item'].includes(comp.type);
              if (isContainer) return null;
              
              const absPos = getAbsolutePosition(comp, components);
              const Widget = widgetRegistry[comp.type];
              if (!Widget) return null;
              
              const dragStyle: React.CSSProperties = {
                position: 'absolute',
                left: absPos.x,
                top: absPos.y,
                width: comp.position.width,
                height: comp.position.height,
                zIndex: 9999,
                pointerEvents: 'none',
              };
              
              const emptyHandlers = {
                onMouseDown: () => {},
                onMouseEnter: () => {},
                onMouseLeave: () => {},
              };
              
              return <Widget key={`drag-${comp.id}`} component={comp} style={dragStyle} handlers={emptyHandlers} />;
            });
          })()}
        </div>

        {/* 视图连接层 - 独立于组件层 */}
        <ViewConnectionLayer
          components={components}
          allViews={allViews || []}
          zoom={zoom / (window.devicePixelRatio || 1)}
          offset={canvasOffset}
          visible={showViewConnections}
        />

        {/* 对齐辅助线 */}
        <AlignmentGuides
          lines={alignmentLines}
          zoom={zoom / (window.devicePixelRatio || 1)}
          offset={canvasOffset}
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
        hasClipboard={!!useDesignerStore.getState().clipboard || useDesignerStore.getState().clipboardMultiple.length > 0}
        multiSelectCount={selectedComponents.length}
        onAction={handleMenuAction}
      />
    </div>
  );
};

export default DesignerCanvas;
