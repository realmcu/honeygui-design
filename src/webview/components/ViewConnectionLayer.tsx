import React, { useMemo } from 'react';
import { Component, ViewInfo } from '../types';
import type { EventConfig, Action } from '../../hml/eventTypes';
import { useDesignerStore } from '../store';

interface ViewConnectionLayerProps {
  components: Component[];
  allViews: ViewInfo[];
  zoom: number;
  offset: { x: number; y: number };
  visible: boolean;
}

interface Connection {
  id: string;
  from: Component;
  to: Component | null;
  targetId: string;
  targetName: string;
  targetFile: string;
  isLocal: boolean;
  isValid: boolean;
}

interface Rect { x: number; y: number; w: number; h: number; }

export const ViewConnectionLayer: React.FC<ViewConnectionLayerProps> = ({
  components, allViews, zoom, offset, visible
}) => {
  if (!visible) return null;

  const allHmlFiles = useDesignerStore(state => state.allHmlFiles || []);

  const viewRects = useMemo(() => {
    return components
      .filter(c => c.type === 'hg_view')
      .map(c => ({ x: c.position.x, y: c.position.y, w: c.position.width, h: c.position.height }));
  }, [components]);

  const connections = useMemo(() => {
    const result: Connection[] = [];
    const localViewsById = new Map<string, Component>();
    const allViewsById = new Map<string, ViewInfo>();

    components.forEach(comp => {
      if (comp.type === 'hg_view') localViewsById.set(comp.id, comp);
    });
    allViews.forEach(v => allViewsById.set(v.id, v));

    components.forEach(comp => {
      if (comp.type === 'hg_view' && comp.eventConfigs) {
        comp.eventConfigs.forEach((eventConfig: EventConfig, eventIdx: number) => {
          eventConfig.actions.forEach((action: Action, actionIdx: number) => {
            if (action.type === 'switchView' && action.target && comp.id !== action.target) {
              const localTarget = localViewsById.get(action.target);
              const globalTarget = allViewsById.get(action.target);
              result.push({
                id: `${comp.id}-${action.target}-${eventIdx}-${actionIdx}`,
                from: comp,
                to: localTarget || null,
                targetId: action.target,
                targetName: globalTarget?.name || action.target,
                targetFile: globalTarget?.file || '',
                isLocal: !!localTarget,
                isValid: !!globalTarget,
              });
            }
          });
        });
      }
    });
    return result;
  }, [components, allViews]);

  const toCanvas = (x: number, y: number) => ({ x: x * zoom + offset.x, y: y * zoom + offset.y });

  const isOverlapping = (cx: number, cy: number, r: number, rects: Rect[]) => {
    for (const rect of rects) {
      const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
      const dx = cx - closestX, dy = cy - closestY;
      if (dx * dx + dy * dy < (r + 10) * (r + 10)) return true;
    }
    return false;
  };

  const findExternalNodePos = (from: Component, index: number, rects: Rect[]) => {
    const { x, y, width, height } = from.position;
    const r = 40, gap = 20, offsetY = index * 90;
    const candidates = [
      { x: x + width + gap + r, y: y + height / 2 + offsetY },
      { x: x - gap - r, y: y + height / 2 + offsetY },
      { x: x + width / 2 + index * 90, y: y + height + gap + r },
      { x: x + width / 2 + index * 90, y: y - gap - r },
    ];
    for (const pos of candidates) {
      if (!isOverlapping(pos.x, pos.y, r, rects)) return pos;
    }
    return candidates[0];
  };

  const getRectEdgeFromCenter = (cx: number, cy: number, hw: number, hh: number, targetX: number, targetY: number) => {
    const dx = targetX - cx, dy = targetY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / dist, uy = dy / dist;
    let t = Infinity;
    if (ux > 0) t = Math.min(t, hw / ux);
    if (ux < 0) t = Math.min(t, -hw / ux);
    if (uy > 0) t = Math.min(t, hh / uy);
    if (uy < 0) t = Math.min(t, -hh / uy);
    return { x: cx + ux * t, y: cy + uy * t };
  };

  const getCircleEdge = (cx: number, cy: number, r: number, targetX: number, targetY: number) => {
    const dx = targetX - cx, dy = targetY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: cx, y: cy };
    return { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r };
  };

  const getLinePath = (
    fromCx: number, fromCy: number, fromHw: number, fromHh: number,
    toCx: number, toCy: number, toHw: number, toHh: number, isCircle: boolean
  ) => {
    const fromPt = getRectEdgeFromCenter(fromCx, fromCy, fromHw, fromHh, toCx, toCy);
    const toPt = isCircle
      ? getCircleEdge(toCx, toCy, toHw, fromCx, fromCy)
      : getRectEdgeFromCenter(toCx, toCy, toHw, toHh, fromCx, fromCy);
    
    const f = toCanvas(fromPt.x, fromPt.y);
    const dist = Math.sqrt((toPt.x-fromPt.x)**2+(toPt.y-fromPt.y)**2) || 1;
    const t = toCanvas(toPt.x - (toPt.x - fromPt.x) / dist * 6, toPt.y - (toPt.y - fromPt.y) / dist * 6);
    
    return { from: f, to: t, nodeCenter: toCanvas(toCx, toCy) };
  };

  // 点击外部圆圈，跳转到对应文件
  const handleExternalClick = (targetFile: string) => {
    // 根据目录名找到对应的 HML 文件
    const hmlFile = allHmlFiles.find(f => f.relativePath.includes(`/${targetFile}/`) || f.relativePath.includes(`\\${targetFile}\\`));
    if (hmlFile) {
      window.vscodeAPI?.postMessage({
        command: 'switchFile',
        filePath: hmlFile.path,
      });
    }
  };

  const externalCountByFrom = new Map<string, number>();

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'visible', zIndex: 1000
    }}>
      <defs>
        <marker id="arr-local" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#4CAF50" />
        </marker>
        <marker id="arr-ext" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#2196F3" />
        </marker>
        <marker id="arr-err" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#f44336" />
        </marker>
      </defs>
      
      {connections.map((conn) => {
        // 本地连接
        if (conn.isLocal && conn.to) {
          const fromCx = conn.from.position.x + conn.from.position.width / 2;
          const fromCy = conn.from.position.y + conn.from.position.height / 2;
          const toCx = conn.to.position.x + conn.to.position.width / 2;
          const toCy = conn.to.position.y + conn.to.position.height / 2;
          const { from, to } = getLinePath(
            fromCx, fromCy, conn.from.position.width / 2, conn.from.position.height / 2,
            toCx, toCy, conn.to.position.width / 2, conn.to.position.height / 2, false
          );
          return (
            <line key={conn.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#4CAF50" strokeWidth={2} strokeDasharray="6,3"
              markerEnd="url(#arr-local)" opacity={0.85} />
          );
        }

        // 外部连接
        const fromId = conn.from.id;
        const idx = externalCountByFrom.get(fromId) || 0;
        externalCountByFrom.set(fromId, idx + 1);
        
        const extPos = findExternalNodePos(conn.from, idx, viewRects);
        const r = 40;
        const fromCx = conn.from.position.x + conn.from.position.width / 2;
        const fromCy = conn.from.position.y + conn.from.position.height / 2;
        const { from, to, nodeCenter } = getLinePath(
          fromCx, fromCy, conn.from.position.width / 2, conn.from.position.height / 2,
          extPos.x, extPos.y, r, r, true
        );
        const color = conn.isValid ? '#2196F3' : '#f44336';
        const marker = conn.isValid ? 'url(#arr-ext)' : 'url(#arr-err)';
        const label1 = conn.targetFile || '?';
        const label2 = conn.targetName.length > 8 ? conn.targetName.slice(0, 8) + '..' : conn.targetName;
        const canClick = conn.isValid && conn.targetFile;

        return (
          <g key={conn.id}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth={2} strokeDasharray="6,3"
              markerEnd={marker} opacity={0.85} />
            <g 
              style={{ pointerEvents: canClick ? 'auto' : 'none', cursor: canClick ? 'pointer' : 'default' }}
              onClick={(e) => canClick && e.altKey && handleExternalClick(conn.targetFile)}
            >
              <circle cx={nodeCenter.x} cy={nodeCenter.y} r={r * zoom}
                fill={conn.isValid ? 'rgba(33,150,243,0.12)' : 'rgba(244,67,54,0.12)'}
                stroke={color} strokeWidth={1.5} strokeDasharray="4,2" />
              <text x={nodeCenter.x} y={nodeCenter.y - 5} fill={color} fontSize={10} textAnchor="middle">{label1}</text>
              <text x={nodeCenter.x} y={nodeCenter.y + 10} fill={color} fontSize={11} fontWeight="600" textAnchor="middle">{label2}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
