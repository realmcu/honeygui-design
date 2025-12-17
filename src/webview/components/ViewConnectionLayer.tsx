import React, { useMemo } from 'react';
import { Component } from '../types';

interface ViewConnectionLayerProps {
  components: Component[];
  zoom: number;
  offset: { x: number; y: number };
  visible: boolean;
}

interface Connection {
  id: string;
  from: Component;
  to: Component;
  event: string;
  isValid: boolean;
}

interface Point {
  x: number;
  y: number;
}

export const ViewConnectionLayer: React.FC<ViewConnectionLayerProps> = ({
  components,
  zoom,
  offset,
  visible
}) => {
  if (!visible) return null;

  // 使用 useMemo 缓存连接计算
  const connections = useMemo(() => {
    const result: Connection[] = [];
    const viewsById = new Map<string, Component>();

    // 建立 id -> component 映射（只包含 hg_view）
    components.forEach(comp => {
      if (comp.type === 'hg_view') {
        viewsById.set(comp.id, comp);
      }
    });

    // 收集所有连接关系
    components.forEach(comp => {
      if (comp.type === 'hg_view' && comp.view_switch) {
        comp.view_switch.forEach((sw, idx) => {
          const target = viewsById.get(sw.target);
          // 跳过自连接
          if (comp.id === sw.target) return;
          
          result.push({
            id: `${comp.id}-${sw.target}-${idx}`,
            from: comp,
            to: target!,
            event: sw.event,
            isValid: !!target
          });
        });
      }
    });

    return result;
  }, [components]);

  // 将组件坐标转换为画布坐标
  const toCanvasCoords = (x: number, y: number) => ({
    x: x * zoom + offset.x,
    y: y * zoom + offset.y
  });

  // 计算矩形边缘的精确交点
  const getRectEdgePoint = (rect: Component, center: Point, angle: number): Point => {
    const { x, y, width, height } = rect.position;
    const cx = x + width / 2;
    const cy = y + height / 2;
    
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    // 计算与四条边的交点
    let t = Infinity;
    
    // 右边
    if (dx > 0) t = Math.min(t, (x + width - cx) / dx);
    // 左边
    if (dx < 0) t = Math.min(t, (x - cx) / dx);
    // 下边
    if (dy > 0) t = Math.min(t, (y + height - cy) / dy);
    // 上边
    if (dy < 0) t = Math.min(t, (y - cy) / dy);
    
    return {
      x: cx + dx * t,
      y: cy + dy * t
    };
  };

  // 计算两个矩形之间的连接点
  const getConnectionPoints = (from: Component, to: Component) => {
    const fromCenter = {
      x: from.position.x + from.position.width / 2,
      y: from.position.y + from.position.height / 2
    };
    const toCenter = {
      x: to.position.x + to.position.width / 2,
      y: to.position.y + to.position.height / 2
    };

    const angle = Math.atan2(toCenter.y - fromCenter.y, toCenter.x - fromCenter.x);
    
    const fromPoint = getRectEdgePoint(from, toCenter, angle);
    const toPoint = getRectEdgePoint(to, fromCenter, angle + Math.PI);

    return { 
      from: toCanvasCoords(fromPoint.x, fromPoint.y),
      to: toCanvasCoords(toPoint.x, toPoint.y)
    };
  };

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 1000
      }}
    >
      <defs>
        {/* 有效连接箭头 */}
        <marker
          id="arrowhead-valid"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#4CAF50" />
        </marker>
        {/* 无效连接箭头 */}
        <marker
          id="arrowhead-invalid"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#f44336" />
        </marker>
      </defs>
      
      {connections.map((conn) => {
        if (!conn.isValid) {
          // 无效连接：显示警告
          const warnPos = toCanvasCoords(
            conn.from.position.x + conn.from.position.width / 2,
            conn.from.position.y - 10
          );
          return (
            <g key={conn.id}>
              <text
                x={warnPos.x}
                y={warnPos.y}
                fill="#f44336"
                fontSize={12}
                textAnchor="middle"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                ⚠️ 目标不存在
              </text>
            </g>
          );
        }

        const { from, to } = getConnectionPoints(conn.from, conn.to);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const eventLabel = conn.event.replace('GUI_EVENT_TOUCH_MOVE_', '');

        return (
          <g key={conn.id}>
            {/* 连接线 */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#4CAF50"
              strokeWidth={2}
              strokeDasharray="5,3"
              markerEnd="url(#arrowhead-valid)"
              opacity={0.8}
            />
            
            {/* 标签背景 */}
            <rect
              x={midX - 20}
              y={midY - 10}
              width={40}
              height={20}
              fill="rgba(76, 175, 80, 0.9)"
              rx={3}
            />
            
            {/* 事件标签 */}
            <text
              x={midX}
              y={midY + 5}
              fill="white"
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {eventLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
