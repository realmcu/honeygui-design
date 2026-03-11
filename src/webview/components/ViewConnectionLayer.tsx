import React, { useMemo, useState } from 'react';
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
  isBidirectional?: boolean; // 是否为双向连接
}

interface Rect { x: number; y: number; w: number; h: number; }

export const ViewConnectionLayer: React.FC<ViewConnectionLayerProps> = ({
  components, allViews, zoom, offset, visible
}) => {
  if (!visible) return null;

  const allHmlFiles = useDesignerStore(state => state.allHmlFiles || []);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const setHoveredComponent = useDesignerStore(state => state.setHoveredComponent);

  const viewRects = useMemo(() => {
    return components
      .filter(c => c.type === 'hg_view')
      .map(c => ({ x: c.position.x, y: c.position.y, w: c.position.width, h: c.position.height }));
  }, [components]);

  const connections = useMemo(() => {
    const result: Connection[] = [];
    const localViewsById = new Map<string, Component>();
    const allViewsById = new Map<string, ViewInfo>();
    const connectionMap = new Map<string, { from: string; to: string }[]>(); // 用于检测双向连接

    components.forEach(comp => {
      if (comp.type === 'hg_view') localViewsById.set(comp.id, comp);
    });
    allViews.forEach(v => allViewsById.set(v.id, v));

    // 收集所有连接
    components.forEach(comp => {
      if (comp.type === 'hg_view' && comp.eventConfigs) {
        comp.eventConfigs.forEach((eventConfig: EventConfig, eventIdx: number) => {
          eventConfig.actions.forEach((action: Action, actionIdx: number) => {
            if (action.type === 'switchView' && action.target && comp.id !== action.target) {
              const localTarget = localViewsById.get(action.target);
              const globalTarget = allViewsById.get(action.target);
              
              // 记录连接关系用于双向检测
              const key = [comp.id, action.target].sort().join('-');
              if (!connectionMap.has(key)) {
                connectionMap.set(key, []);
              }
              connectionMap.get(key)!.push({ from: comp.id, to: action.target });
              
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

    // 检测双向连接并标记
    connectionMap.forEach((connections, key) => {
      if (connections.length >= 2) {
        const hasForward = connections.some(c => c.from < c.to);
        const hasBackward = connections.some(c => c.from > c.to);
        if (hasForward && hasBackward) {
          // 标记为双向连接，只保留一个方向的连线
          result.forEach(conn => {
            const connKey = [conn.from.id, conn.targetId].sort().join('-');
            if (connKey === key && conn.from.id < conn.targetId) {
              conn.isBidirectional = true;
            }
          });
          // 移除反向连线
          for (let i = result.length - 1; i >= 0; i--) {
            const conn = result[i];
            const connKey = [conn.from.id, conn.targetId].sort().join('-');
            if (connKey === key && conn.from.id > conn.targetId) {
              result.splice(i, 1);
            }
          }
        }
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
    
    // 优先选择底部出线（对于并排的view，底部出线可以减少交叉）
    // 如果目标在view的上方，则从顶部出线
    // 如果目标在view的下方，则从底部出线
    // 如果目标在view的左侧或右侧，则从对应的侧边出线
    
    const angle = Math.atan2(dy, dx);
    const angleDeg = angle * 180 / Math.PI;
    
    // 根据角度选择出线边
    if (angleDeg >= -45 && angleDeg <= 45) {
      // 目标在右侧，从右边出线
      return { x: cx + hw, y: cy };
    } else if (angleDeg > 45 && angleDeg <= 135) {
      // 目标在下侧，从底部出线（优先选择）
      return { x: cx, y: cy + hh };
    } else if (angleDeg > 135 || angleDeg <= -135) {
      // 目标在左侧，从左边出线
      return { x: cx - hw, y: cy };
    } else {
      // 目标在上侧，从顶部出线
      return { x: cx, y: cy - hh };
    }
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

  // 生成折线路径，避开所有 view 区域
  const getPolylinePath = (
    fromCx: number, fromCy: number, fromHw: number, fromHh: number,
    toCx: number, toCy: number, toHw: number, toHh: number, isCircle: boolean,
    isBidirectional: boolean = false,
    fromViewId?: string,
    toViewId?: string
  ) => {
    const fromPt = getRectEdgeFromCenter(fromCx, fromCy, fromHw, fromHh, toCx, toCy);
    const toPt = isCircle
      ? getCircleEdge(toCx, toCy, toHw, fromCx, fromCy)
      : getRectEdgeFromCenter(toCx, toCy, toHw, toHh, fromCx, fromCy);
    
    const f = toCanvas(fromPt.x, fromPt.y);
    const t = toCanvas(toPt.x, toPt.y);
    
    // 判断起点在哪个边框上（左、右、上、下）
    const fromEdge = getEdgePosition(fromPt.x, fromPt.y, fromCx, fromCy, fromHw, fromHh);
    // 判断终点在哪个边框上
    const toEdge = isCircle ? 'circle' : getEdgePosition(toPt.x, toPt.y, toCx, toCy, toHw, toHh);
    
    // 使用原始矩形（未缩放）计算避障路径
    const path = calculateAvoidancePath(f, t, viewRects, fromViewId, toViewId, fromEdge, toEdge);
    
    // 计算箭头方向
    const pathPoints = parsePathPoints(path);
    
    // 终点箭头方向（路径最后两个点）
    const lastSegment = pathPoints.slice(-2);
    let endArrowAngle = 0;
    if (lastSegment.length === 2) {
      const dx = lastSegment[1].x - lastSegment[0].x;
      const dy = lastSegment[1].y - lastSegment[0].y;
      endArrowAngle = Math.atan2(dy, dx);
    }
    
    // 起点箭头方向（路径前两个点）
    const firstSegment = pathPoints.slice(0, 2);
    let startArrowAngle = 0;
    if (firstSegment.length === 2) {
      const dx = firstSegment[1].x - firstSegment[0].x;
      const dy = firstSegment[1].y - firstSegment[0].y;
      startArrowAngle = Math.atan2(dy, dx);
    }
    
    return {
      path,
      arrowTip: t,
      arrowAngle: endArrowAngle,
      startArrowAngle,
      pathStart: f,
      nodeCenter: toCanvas(toCx, toCy),
      isBidirectional,
      fromViewId,
      toViewId
    };
  };

  // 判断点在矩形的哪个边上（基于角度判断，与getRectEdgeFromCenter保持一致）
  const getEdgePosition = (
    px: number, py: number,
    cx: number, cy: number,
    hw: number, hh: number
  ): 'left' | 'right' | 'top' | 'bottom' => {
    const dx = px - cx;
    const dy = py - cy;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // 根据角度判断在哪条边上
    if (angle >= -45 && angle <= 45) {
      return 'right'; // 右侧
    } else if (angle > 45 && angle <= 135) {
      return 'bottom'; // 底部（优先选择底部）
    } else if (angle > 135 || angle <= -135) {
      return 'left'; // 左侧
    } else {
      return 'top'; // 顶部
    }
  };

  // 计算避开障碍物的路径
  const calculateAvoidancePath = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    originalRects: Rect[],
    fromViewId?: string,
    toViewId?: string,
    fromEdge?: 'left' | 'right' | 'top' | 'bottom',
    toEdge?: 'left' | 'right' | 'top' | 'bottom' | 'circle'
  ): string => {
    const cornerRadius = 8;
    const margin = 30; // 与障碍物的最小距离
    const exitDistance = 40; // 出线距离
    
    // 将原始矩形转换为画布坐标，并添加对应的组件ID
    const obstacles = originalRects.map((rect, index) => {
      // 找到对应的组件
      const component = components.find(c => 
        c.type === 'hg_view' && 
        c.position.x === rect.x && 
        c.position.y === rect.y &&
        c.position.width === rect.w &&
        c.position.height === rect.h
      );
      
      return {
        x: rect.x * zoom + offset.x,
        y: rect.y * zoom + offset.y,
        w: rect.w * zoom,
        h: rect.h * zoom,
        id: component?.id,
        originalIndex: index
      };
    });
    
    // 过滤掉起点和终点所在的 view
    const relevantObstacles = obstacles.filter(obs => {
      // 通过 ID 排除起点和终点的 view
      if (fromViewId && obs.id === fromViewId) return false;
      if (toViewId && obs.id === toViewId) return false;
      
      // 额外检查：排除起点和终点在其内部的 view（容错机制）
      const startInside = isPointInsideRect(start, obs, 5);
      const endInside = isPointInsideRect(end, obs, 5);
      return !startInside && !endInside;
    });
    
    // 根据边框位置计算出线点和入线点，避免重叠和过近
    let startExit = { ...start };
    let endEntry = { ...end };
    
    // 起点出线方向
    if (fromEdge === 'left') {
      startExit = { x: start.x - exitDistance, y: start.y };
    } else if (fromEdge === 'right') {
      startExit = { x: start.x + exitDistance, y: start.y };
    } else if (fromEdge === 'top') {
      startExit = { x: start.x, y: start.y - exitDistance };
    } else if (fromEdge === 'bottom') {
      startExit = { x: start.x, y: start.y + exitDistance };
    }
    
    // 终点入线方向（避免与起点出线点过近）
    if (toEdge === 'left') {
      endEntry = { x: end.x - exitDistance, y: end.y };
    } else if (toEdge === 'right') {
      endEntry = { x: end.x + exitDistance, y: end.y };
    } else if (toEdge === 'top') {
      endEntry = { x: end.x, y: end.y - exitDistance };
    } else if (toEdge === 'bottom') {
      endEntry = { x: end.x, y: end.y + exitDistance };
    } else if (toEdge === 'circle') {
      // 圆形目标，保持原有逻辑
      endEntry = { ...end };
    }
    
    // 检查起点出线点和终点入线点是否过近（避免重叠）
    const distance = Math.sqrt((endEntry.x - startExit.x) ** 2 + (endEntry.y - startExit.y) ** 2);
    if (distance < exitDistance * 0.5) {
      // 如果过近，调整终点入线点位置
      if (toEdge === 'bottom') {
        endEntry = { x: end.x, y: end.y + exitDistance * 1.5 };
      } else if (toEdge === 'top') {
        endEntry = { x: end.x, y: end.y - exitDistance * 1.5 };
      } else if (toEdge === 'right') {
        endEntry = { x: end.x + exitDistance * 1.5, y: end.y };
      } else if (toEdge === 'left') {
        endEntry = { x: end.x - exitDistance * 1.5, y: end.y };
      }
    }
    
    // 检查完整路径的所有线段是否与其他 view 相交
    const simplePath = [start, startExit, endEntry, end];
    let hasCollision = false;
    
    for (let i = 1; i < simplePath.length; i++) {
      const segStart = simplePath[i - 1];
      const segEnd = simplePath[i];
      
      if (relevantObstacles.some(obs => lineIntersectsRect(segStart, segEnd, obs, margin))) {
        hasCollision = true;
        break;
      }
    }
    
    if (!hasCollision) {
      // 简单路径：起点 -> 出线点 -> 入线点 -> 终点
      return createRoundedPath(simplePath, cornerRadius);
    }
    
    // 需要绕行，计算所有障碍物的包围盒
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    relevantObstacles.forEach(obs => {
      minX = Math.min(minX, obs.x);
      maxX = Math.max(maxX, obs.x + obs.w);
      minY = Math.min(minY, obs.y);
      maxY = Math.max(maxY, obs.y + obs.h);
    });
    
    // 生成多种绕行路径，确保完全避开所有障碍物
    const pathOptions: { x: number; y: number }[][] = [];
    
    // 计算更大的安全边距，确保绕行路径不会太接近障碍物
    const safeMargin = margin + 20;
    
    // 对于并排的view，优先使用底部出线，然后水平绕行
    // 这样可以减少连线交叉
    if (fromEdge === 'bottom' || toEdge === 'bottom') {
      // 如果起点或终点从底部出线，优先使用水平绕行
      pathOptions.push(
        // 底部出线，然后水平绕行
        [start, startExit, { x: startExit.x, y: maxY + safeMargin }, { x: endEntry.x, y: maxY + safeMargin }, endEntry, end],
        // 底部出线，然后向上绕行
        [start, startExit, { x: startExit.x, y: minY - safeMargin }, { x: endEntry.x, y: minY - safeMargin }, endEntry, end],
        // 左侧绕行
        [start, startExit, { x: minX - safeMargin, y: startExit.y }, { x: minX - safeMargin, y: endEntry.y }, endEntry, end],
        // 右侧绕行
        [start, startExit, { x: maxX + safeMargin, y: startExit.y }, { x: maxX + safeMargin, y: endEntry.y }, endEntry, end]
      );
    } else if (fromEdge === 'left') {
      // 从左边出线，优先向左绕行
      pathOptions.push(
        [start, startExit, { x: minX - safeMargin, y: startExit.y }, { x: minX - safeMargin, y: endEntry.y }, endEntry, end],
        [start, startExit, { x: startExit.x, y: minY - safeMargin }, { x: endEntry.x, y: minY - safeMargin }, endEntry, end],
        [start, startExit, { x: startExit.x, y: maxY + safeMargin }, { x: endEntry.x, y: maxY + safeMargin }, endEntry, end]
      );
    } else if (fromEdge === 'right') {
      // 从右边出线，优先向右绕行
      pathOptions.push(
        [start, startExit, { x: maxX + safeMargin, y: startExit.y }, { x: maxX + safeMargin, y: endEntry.y }, endEntry, end],
        [start, startExit, { x: startExit.x, y: minY - safeMargin }, { x: endEntry.x, y: minY - safeMargin }, endEntry, end],
        [start, startExit, { x: startExit.x, y: maxY + safeMargin }, { x: endEntry.x, y: maxY + safeMargin }, endEntry, end]
      );
    } else if (fromEdge === 'top') {
      // 从上边出线，优先向上绕行
      pathOptions.push(
        [start, startExit, { x: startExit.x, y: minY - safeMargin }, { x: endEntry.x, y: minY - safeMargin }, endEntry, end],
        [start, startExit, { x: minX - safeMargin, y: startExit.y }, { x: minX - safeMargin, y: endEntry.y }, endEntry, end],
        [start, startExit, { x: maxX + safeMargin, y: startExit.y }, { x: maxX + safeMargin, y: endEntry.y }, endEntry, end]
      );
    } else {
      // 默认路径（兼容旧逻辑）
      pathOptions.push(
        [start, { x: maxX + safeMargin, y: start.y }, { x: maxX + safeMargin, y: end.y }, end],
        [start, { x: minX - safeMargin, y: start.y }, { x: minX - safeMargin, y: end.y }, end],
        [start, { x: start.x, y: minY - safeMargin }, { x: end.x, y: minY - safeMargin }, end],
        [start, { x: start.x, y: maxY + safeMargin }, { x: end.x, y: maxY + safeMargin }, end]
      );
    }
    
    // 选择没有碰撞且路径最短的选项
    let bestPath: { x: number; y: number }[] | null = null;
    let bestLength = Infinity;
    
    for (const path of pathOptions) {
      let hasPathCollision = false;
      
      // 检查路径的每个线段
      for (let i = 1; i < path.length; i++) {
        const segStart = path[i - 1];
        const segEnd = path[i];
        
        // 检查是否与任何障碍物相交
        for (const obs of relevantObstacles) {
          if (lineIntersectsRect(segStart, segEnd, obs, margin)) {
            hasPathCollision = true;
            break;
          }
        }
        
        if (hasPathCollision) break;
      }
      
      if (!hasPathCollision) {
        const length = calculatePathLength(path);
        if (length < bestLength) {
          bestLength = length;
          bestPath = path;
        }
      }
    }
    
    // 如果所有预设路径都有碰撞，使用更保守的绕行策略
    if (!bestPath) {
      // 计算一个足够远的绕行距离，确保不会与任何障碍物相交
      const extraMargin = safeMargin + 50;
      
      // 尝试更保守的绕行路径
      const conservativePaths = [
        // 远距离左侧绕行
        [start, startExit, { x: minX - extraMargin, y: startExit.y }, { x: minX - extraMargin, y: endEntry.y }, endEntry, end],
        // 远距离右侧绕行
        [start, startExit, { x: maxX + extraMargin, y: startExit.y }, { x: maxX + extraMargin, y: endEntry.y }, endEntry, end],
        // 远距离上方绕行
        [start, startExit, { x: startExit.x, y: minY - extraMargin }, { x: endEntry.x, y: minY - extraMargin }, endEntry, end],
        // 远距离下方绕行
        [start, startExit, { x: startExit.x, y: maxY + extraMargin }, { x: endEntry.x, y: maxY + extraMargin }, endEntry, end]
      ];
      
      // 选择第一个无碰撞的保守路径
      for (const path of conservativePaths) {
        let hasPathCollision = false;
        
        for (let i = 1; i < path.length; i++) {
          const segStart = path[i - 1];
          const segEnd = path[i];
          
          if (relevantObstacles.some(obs => lineIntersectsRect(segStart, segEnd, obs, margin))) {
            hasPathCollision = true;
            break;
          }
        }
        
        if (!hasPathCollision) {
          bestPath = path;
          break;
        }
      }
      
      // 如果还是没有找到合适的路径，使用最简单的直线路径（作为最后的兜底）
      if (!bestPath) {
        bestPath = [start, startExit, endEntry, end];
      }
    }
    
    return createRoundedPath(bestPath, cornerRadius);
  };

  // 检查点是否在矩形内部或边缘上
  const isPointInsideRect = (
    point: { x: number; y: number },
    rect: { x: number; y: number; w: number; h: number },
    tolerance: number = 0
  ): boolean => {
    return point.x >= rect.x - tolerance &&
           point.x <= rect.x + rect.w + tolerance &&
           point.y >= rect.y - tolerance &&
           point.y <= rect.y + rect.h + tolerance;
  };

  // 检查线段是否与矩形相交
  const lineIntersectsRect = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rect: { x: number; y: number; w: number; h: number },
    margin: number = 0
  ): boolean => {
    const expandedRect = {
      x: rect.x - margin,
      y: rect.y - margin,
      w: rect.w + margin * 2,
      h: rect.h + margin * 2
    };
    
    // 检查线段端点是否在矩形内
    const p1Inside = p1.x >= expandedRect.x && p1.x <= expandedRect.x + expandedRect.w &&
                     p1.y >= expandedRect.y && p1.y <= expandedRect.y + expandedRect.h;
    const p2Inside = p2.x >= expandedRect.x && p2.x <= expandedRect.x + expandedRect.w &&
                     p2.y >= expandedRect.y && p2.y <= expandedRect.y + expandedRect.h;
    
    if (p1Inside || p2Inside) return true;
    
    // 使用 Liang-Barsky 算法检查线段与矩形相交
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    if (dx === 0 && dy === 0) return p1Inside;
    
    const p = [-dx, dx, -dy, dy];
    const q = [
      p1.x - expandedRect.x,
      expandedRect.x + expandedRect.w - p1.x,
      p1.y - expandedRect.y,
      expandedRect.y + expandedRect.h - p1.y
    ];
    
    let u1 = 0, u2 = 1;
    
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u2) return false;
          if (t > u1) u1 = t;
        } else {
          if (t < u1) return false;
          if (t < u2) u2 = t;
        }
      }
    }
    
    return u1 <= u2;
  };

  // 计算路径长度
  const calculatePathLength = (points: { x: number; y: number }[]): number => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  // 创建带圆角的路径
  const createRoundedPath = (
    points: { x: number; y: number }[],
    radius: number
  ): string => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // 计算到转折点的距离
      const d1 = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      const d2 = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
      const r = Math.min(radius, d1 / 2, d2 / 2);
      
      if (r > 0) {
        // 计算圆角的起点和终点
        const ratio1 = r / d1;
        const ratio2 = r / d2;
        
        const startX = curr.x - (curr.x - prev.x) * ratio1;
        const startY = curr.y - (curr.y - prev.y) * ratio1;
        const endX = curr.x + (next.x - curr.x) * ratio2;
        const endY = curr.y + (next.y - curr.y) * ratio2;
        
        path += ` L ${startX} ${startY}`;
        path += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
      } else {
        path += ` L ${curr.x} ${curr.y}`;
      }
    }
    
    // 连接到最后一点，但留出箭头空间
    const lastPoint = points[points.length - 1];
    const secondLastPoint = points[points.length - 2];
    const dx = lastPoint.x - secondLastPoint.x;
    const dy = lastPoint.y - secondLastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 8) {
      const arrowStartX = lastPoint.x - (dx / dist) * 8;
      const arrowStartY = lastPoint.y - (dy / dist) * 8;
      path += ` L ${arrowStartX} ${arrowStartY}`;
    } else {
      path += ` L ${lastPoint.x} ${lastPoint.y}`;
    }
    
    return path;
  };

  // 解析路径中的点
  const parsePathPoints = (pathStr: string): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    const commands = pathStr.match(/[MLQ]\s*[\d.-]+\s*[\d.-]+/g) || [];
    
    commands.forEach(cmd => {
      const coords = cmd.match(/[\d.-]+/g);
      if (coords && coords.length >= 2) {
        points.push({ x: parseFloat(coords[0]), y: parseFloat(coords[1]) });
      }
    });
    
    return points;
  };

  // 创建箭头路径（双向箭头在两端都有箭头）
  const createArrowPath = (
    tip: { x: number; y: number },
    angle: number,
    size: number = 8,
    isBidirectional: boolean = false
  ): string => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // 终点箭头
    const p1x = tip.x - size * cos + (size / 2) * sin;
    const p1y = tip.y - size * sin - (size / 2) * cos;
    const p2x = tip.x - size * cos - (size / 2) * sin;
    const p2y = tip.y - size * sin + (size / 2) * cos;
    
    if (!isBidirectional) {
      return `${p1x},${p1y} ${tip.x},${tip.y} ${p2x},${p2y}`;
    }
    
    // 双向箭头：只返回终点箭头，起点箭头单独绘制
    return `${p1x},${p1y} ${tip.x},${tip.y} ${p2x},${p2y}`;
  };

  // 创建起点箭头（用于双向连接）
  const createStartArrowPath = (
    start: { x: number; y: number },
    angle: number,
    size: number = 8
  ): string => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // 起点箭头（方向相反）
    const p1x = start.x + size * cos + (size / 2) * sin;
    const p1y = start.y + size * sin - (size / 2) * cos;
    const p2x = start.x + size * cos - (size / 2) * sin;
    const p2y = start.y + size * sin + (size / 2) * cos;
    
    return `${p1x},${p1y} ${start.x},${start.y} ${p2x},${p2y}`;
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
          const { path, arrowTip, arrowAngle, startArrowAngle, pathStart, isBidirectional, fromViewId, toViewId } = getPolylinePath(
            fromCx, fromCy, conn.from.position.width / 2, conn.from.position.height / 2,
            toCx, toCy, conn.to.position.width / 2, conn.to.position.height / 2, false,
            conn.isBidirectional,
            conn.from.id,
            conn.to.id
          );
          
          const isHovered = hoveredConnection === conn.id;
          const endArrowPoints = createArrowPath(arrowTip, arrowAngle, 8, false);
          
          // 起点箭头（双向连接）
          const startArrowPoints = isBidirectional 
            ? createStartArrowPath(pathStart, startArrowAngle, 8)
            : null;
          
          // 计算双向图标位置（在路径中点，避开 view 区域）
          const pathPoints = parsePathPoints(path);
          const midIndex = Math.floor(pathPoints.length / 2);
          const iconPos = pathPoints[midIndex] || arrowTip;
          
          return (
            <g key={conn.id}>
              {/* 透明的宽路径用于鼠标悬停检测 */}
              <path
                d={path}
                stroke="transparent"
                strokeWidth={12}
                fill="none"
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredConnection(conn.id);
                  // 高亮起始和终点 view
                  setHoveredComponent(conn.from.id);
                }}
                onMouseLeave={() => {
                  setHoveredConnection(null);
                  setHoveredComponent(null);
                }}
              />
              {/* 实际显示的路径 */}
              <path
                d={path}
                stroke={isHovered ? "#66BB6A" : "#4CAF50"}
                strokeWidth={isHovered ? 3 : 2}
                strokeDasharray="6,3"
                fill="none"
                opacity={isHovered ? 1 : 0.85}
                style={{ pointerEvents: 'none' }}
              />
              {/* 终点箭头 */}
              <polygon
                points={endArrowPoints}
                fill={isHovered ? "#66BB6A" : "#4CAF50"}
                opacity={isHovered ? 1 : 0.85}
                style={{ pointerEvents: 'none' }}
              />
              {/* 起点箭头（双向连接） */}
              {startArrowPoints && (
                <polygon
                  points={startArrowPoints}
                  fill={isHovered ? "#66BB6A" : "#4CAF50"}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* 双向连接标识（在路径中点） */}
              {isBidirectional && (
                <text
                  x={iconPos.x}
                  y={iconPos.y - 10}
                  fill={isHovered ? "#66BB6A" : "#4CAF50"}
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  ⇄
                </text>
              )}
              {/* 高亮起始 view */}
              {isHovered && (
                <rect
                  x={conn.from.position.x * zoom + offset.x}
                  y={conn.from.position.y * zoom + offset.y}
                  width={conn.from.position.width * zoom}
                  height={conn.from.position.height * zoom}
                  fill="none"
                  stroke="#66BB6A"
                  strokeWidth={3}
                  opacity={0.6}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* 高亮终点 view */}
              {isHovered && (
                <rect
                  x={conn.to.position.x * zoom + offset.x}
                  y={conn.to.position.y * zoom + offset.y}
                  width={conn.to.position.width * zoom}
                  height={conn.to.position.height * zoom}
                  fill="none"
                  stroke="#66BB6A"
                  strokeWidth={3}
                  opacity={0.6}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
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
        const { path, arrowTip, arrowAngle, startArrowAngle, pathStart, nodeCenter, isBidirectional } = getPolylinePath(
          fromCx, fromCy, conn.from.position.width / 2, conn.from.position.height / 2,
          extPos.x, extPos.y, r, r, true, conn.isBidirectional,
          conn.from.id,
          undefined
        );
        const color = conn.isValid ? '#2196F3' : '#f44336';
        const hoverColor = conn.isValid ? '#42A5F5' : '#EF5350';
        const label1 = conn.targetFile || '?';
        const label2 = conn.targetName.length > 8 ? conn.targetName.slice(0, 8) + '..' : conn.targetName;
        const canClick = conn.isValid && conn.targetFile;
        const isHovered = hoveredConnection === conn.id;
        const endArrowPoints = createArrowPath(arrowTip, arrowAngle, 8, false);
        
        // 起点箭头（双向连接）
        const startArrowPoints = isBidirectional 
          ? createStartArrowPath(pathStart, startArrowAngle, 8)
          : null;

        return (
          <g key={conn.id}>
            {/* 透明的宽路径用于鼠标悬停检测 */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={12}
              fill="none"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredConnection(conn.id);
                setHoveredComponent(conn.from.id);
              }}
              onMouseLeave={() => {
                setHoveredConnection(null);
                setHoveredComponent(null);
              }}
            />
            {/* 实际显示的路径 */}
            <path
              d={path}
              stroke={isHovered ? hoverColor : color}
              strokeWidth={isHovered ? 3 : 2}
              strokeDasharray="6,3"
              fill="none"
              opacity={isHovered ? 1 : 0.85}
              style={{ pointerEvents: 'none' }}
            />
            {/* 终点箭头 */}
            <polygon
              points={endArrowPoints}
              fill={isHovered ? hoverColor : color}
              opacity={isHovered ? 1 : 0.85}
              style={{ pointerEvents: 'none' }}
            />
            {/* 起点箭头（双向连接） */}
            {startArrowPoints && (
              <polygon
                points={startArrowPoints}
                fill={isHovered ? hoverColor : color}
                opacity={isHovered ? 1 : 0.85}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* 高亮起始 view */}
            {isHovered && (
              <rect
                x={conn.from.position.x * zoom + offset.x}
                y={conn.from.position.y * zoom + offset.y}
                width={conn.from.position.width * zoom}
                height={conn.from.position.height * zoom}
                fill="none"
                stroke={hoverColor}
                strokeWidth={3}
                opacity={0.6}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <g 
              style={{ pointerEvents: canClick ? 'auto' : 'none', cursor: canClick ? 'pointer' : 'default' }}
              onClick={(e) => canClick && e.altKey && handleExternalClick(conn.targetFile)}
            >
              <circle cx={nodeCenter.x} cy={nodeCenter.y} r={r * zoom}
                fill={conn.isValid ? 'rgba(33,150,243,0.12)' : 'rgba(244,67,54,0.12)'}
                stroke={isHovered ? hoverColor : color} strokeWidth={isHovered ? 2 : 1.5} strokeDasharray="4,2" />
              <text x={nodeCenter.x} y={nodeCenter.y - 5} fill={isHovered ? hoverColor : color} fontSize={10} textAnchor="middle">{label1}</text>
              <text x={nodeCenter.x} y={nodeCenter.y + 10} fill={isHovered ? hoverColor : color} fontSize={11} fontWeight="600" textAnchor="middle">{label2}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
