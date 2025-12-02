import React from 'react';
import { Component } from '../types';

interface ViewConnectionLayerProps {
  components: Component[];
  zoom: number;
  visible: boolean;
}

interface Connection {
  from: Component;
  to: Component;
  event: string;
}

export const ViewConnectionLayer: React.FC<ViewConnectionLayerProps> = ({
  components,
  zoom,
  visible
}) => {
  if (!visible) return null;

  const connections: Connection[] = [];
  const viewsByName = new Map<string, Component>();

  // 建立 name -> component 映射
  components.forEach(comp => {
    if (comp.type === 'hg_view' && comp.name) {
      viewsByName.set(comp.name, comp);
    }
  });

  // 收集所有连接关系
  components.forEach(comp => {
    if (comp.type === 'hg_view' && comp.view_switch) {
      comp.view_switch.forEach(sw => {
        const target = viewsByName.get(sw.target);
        if (target) {
          connections.push({
            from: comp,
            to: target,
            event: sw.event
          });
        }
      });
    }
  });

  // 计算两个矩形边缘的连接点
  const getEdgePoints = (from: Component, to: Component) => {
    const fromCenter = {
      x: from.position.x + from.position.width / 2,
      y: from.position.y + from.position.height / 2
    };
    const toCenter = {
      x: to.position.x + to.position.width / 2,
      y: to.position.y + to.position.height / 2
    };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const angle = Math.atan2(dy, dx);

    // 计算起点（from 的边缘）
    const fromEdge = {
      x: fromCenter.x + Math.cos(angle) * (from.position.width / 2),
      y: fromCenter.y + Math.sin(angle) * (from.position.height / 2)
    };

    // 计算终点（to 的边缘）
    const toEdge = {
      x: toCenter.x - Math.cos(angle) * (to.position.width / 2),
      y: toCenter.y - Math.sin(angle) * (to.position.height / 2)
    };

    // 边界修正
    fromEdge.x = Math.max(from.position.x, Math.min(from.position.x + from.position.width, fromEdge.x));
    fromEdge.y = Math.max(from.position.y, Math.min(from.position.y + from.position.height, fromEdge.y));
    toEdge.x = Math.max(to.position.x, Math.min(to.position.x + to.position.width, toEdge.x));
    toEdge.y = Math.max(to.position.y, Math.min(to.position.y + to.position.height, toEdge.y));

    return { from: fromEdge, to: toEdge, angle };
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
        zIndex: 1000
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="#4CAF50" />
        </marker>
      </defs>
      {connections.map((conn, idx) => {
        const { from, to, angle } = getEdgePoints(conn.from, conn.to);
        return (
          <g key={idx}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#4CAF50"
              strokeWidth={2 / zoom}
              markerEnd="url(#arrowhead)"
            />
            {/* 事件标签 */}
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2}
              fill="#4CAF50"
              fontSize={12 / zoom}
              textAnchor="middle"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {conn.event.replace('GUI_EVENT_TOUCH_MOVE_', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
