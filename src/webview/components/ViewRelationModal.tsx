import React, { useMemo, useRef, useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Component } from '../types';
import './ViewRelationModal.css';

interface ViewRelationModalProps {
  visible: boolean;
  onClose: () => void;
  components: Component[];
}

interface ViewNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewEdge {
  id: string;
  from: string;
  to: string;
  event: string;
  isValid: boolean;
}

// 简单的力导向布局
const layoutNodes = (views: Component[], edges: ViewEdge[]): ViewNode[] => {
  const nodeWidth = 120;
  const nodeHeight = 50;
  const padding = 60;
  
  if (views.length === 0) return [];
  
  // 初始位置：圆形布局
  const centerX = 300;
  const centerY = 200;
  const radius = Math.max(100, views.length * 30);
  
  const nodes: ViewNode[] = views.map((v, i) => {
    const angle = (2 * Math.PI * i) / views.length - Math.PI / 2;
    return {
      id: v.id,
      name: v.name,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      width: nodeWidth,
      height: nodeHeight,
    };
  });
  
  // 简单的力导向迭代
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.05;
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces: { [id: string]: { fx: number; fy: number } } = {};
    nodes.forEach(n => forces[n.id] = { fx: 0, fy: 0 });
    
    // 斥力
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[nodes[i].id].fx -= fx;
        forces[nodes[i].id].fy -= fy;
        forces[nodes[j].id].fx += fx;
        forces[nodes[j].id].fy += fy;
      }
    }
    
    // 引力（有连接的节点）
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const fx = dx * attraction;
        const fy = dy * attraction;
        forces[fromNode.id].fx += fx;
        forces[fromNode.id].fy += fy;
        forces[toNode.id].fx -= fx;
        forces[toNode.id].fy -= fy;
      }
    });
    
    // 应用力
    nodes.forEach(n => {
      n.x += forces[n.id].fx * 0.1;
      n.y += forces[n.id].fy * 0.1;
    });
  }
  
  // 归一化到可视区域
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });
  
  nodes.forEach(n => {
    n.x = n.x - minX + padding;
    n.y = n.y - minY + padding;
  });
  
  return nodes;
};

export const ViewRelationModal: React.FC<ViewRelationModalProps> = ({
  visible,
  onClose,
  components,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 提取视图和连接关系
  const { views, edges } = useMemo(() => {
    const views = components.filter(c => c.type === 'hg_view');
    const edges: ViewEdge[] = [];
    
    views.forEach(view => {
      if (view.view_switch) {
        view.view_switch.forEach((sw, idx) => {
          if (view.id !== sw.target) {
            edges.push({
              id: `${view.id}-${sw.target}-${idx}`,
              from: view.id,
              to: sw.target,
              event: sw.event.replace('GUI_EVENT_TOUCH_MOVE_', ''),
              isValid: views.some(v => v.id === sw.target),
            });
          }
        });
      }
    });
    
    return { views, edges };
  }, [components]);

  // 布局节点
  const nodes = useMemo(() => layoutNodes(views, edges), [views, edges]);

  // 计算SVG尺寸
  const svgSize = useMemo(() => {
    if (nodes.length === 0) return { width: 600, height: 400 };
    let maxX = 0, maxY = 0;
    nodes.forEach(n => {
      maxX = Math.max(maxX, n.x + n.width + 60);
      maxY = Math.max(maxY, n.y + n.height + 60);
    });
    return { width: Math.max(600, maxX), height: Math.max(400, maxY) };
  }, [nodes]);

  // 重置视图
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  };

  if (!visible) return null;

  // 计算贝塞尔曲线路径
  const getEdgePath = (fromNode: ViewNode, toNode: ViewNode) => {
    const fromX = fromNode.x + fromNode.width / 2;
    const fromY = fromNode.y + fromNode.height / 2;
    const toX = toNode.x + toNode.width / 2;
    const toY = toNode.y + toNode.height / 2;
    
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 计算边缘点
    const fromEdgeX = fromX + (dx / dist) * (fromNode.width / 2);
    const fromEdgeY = fromY + (dy / dist) * (fromNode.height / 2);
    const toEdgeX = toX - (dx / dist) * (toNode.width / 2 + 8);
    const toEdgeY = toY - (dy / dist) * (toNode.height / 2 + 8);
    
    // 贝塞尔控制点
    const midX = (fromEdgeX + toEdgeX) / 2;
    const midY = (fromEdgeY + toEdgeY) / 2;
    const offset = Math.min(50, dist * 0.2);
    const perpX = -dy / dist * offset;
    const perpY = dx / dist * offset;
    
    return {
      path: `M ${fromEdgeX} ${fromEdgeY} Q ${midX + perpX} ${midY + perpY} ${toEdgeX} ${toEdgeY}`,
      labelX: midX + perpX * 0.5,
      labelY: midY + perpY * 0.5,
    };
  };

  return (
    <div className="view-relation-modal-overlay" onClick={onClose}>
      <div className="view-relation-modal" onClick={e => e.stopPropagation()}>
        <div className="view-relation-modal-header">
          <h3>视图关系图</h3>
          <div className="view-relation-modal-controls">
            <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} title="放大">
              <ZoomIn size={16} />
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.3, z / 1.2))} title="缩小">
              <ZoomOut size={16} />
            </button>
            <button onClick={handleReset} title="重置视图">
              <Maximize2 size={16} />
            </button>
            <button className="close-btn" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div 
          className="view-relation-modal-content"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {views.length === 0 ? (
            <div className="no-views-message">暂无视图</div>
          ) : edges.length === 0 ? (
            <div className="no-edges-message">
              <div>共 {views.length} 个视图，暂无跳转关系</div>
              <div className="hint">在视图属性中设置 view_switch 可添加跳转</div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{
                cursor: isPanning ? 'grabbing' : 'grab',
              }}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                <defs>
                  <marker
                    id="arrow-valid"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#4CAF50" />
                  </marker>
                  <marker
                    id="arrow-invalid"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#f44336" />
                  </marker>
                </defs>
                
                {/* 连接线 */}
                {edges.map(edge => {
                  const fromNode = nodes.find(n => n.id === edge.from);
                  const toNode = nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  
                  const { path, labelX, labelY } = getEdgePath(fromNode, toNode);
                  const color = edge.isValid ? '#4CAF50' : '#f44336';
                  
                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        markerEnd={edge.isValid ? 'url(#arrow-valid)' : 'url(#arrow-invalid)'}
                      />
                      <rect
                        x={labelX - 20}
                        y={labelY - 10}
                        width={40}
                        height={20}
                        fill={color}
                        rx={3}
                        opacity={0.9}
                      />
                      <text
                        x={labelX}
                        y={labelY + 4}
                        fill="white"
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {edge.event}
                      </text>
                    </g>
                  );
                })}
                
                {/* 节点 */}
                {nodes.map(node => (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill="var(--vscode-editor-background)"
                      stroke="var(--vscode-focusBorder)"
                      strokeWidth={2}
                      rx={6}
                    />
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + node.height / 2 + 4}
                      fill="var(--vscode-editor-foreground)"
                      fontSize={12}
                      fontWeight="500"
                      textAnchor="middle"
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          )}
        </div>
        
        <div className="view-relation-modal-footer">
          <span>视图: {views.length}</span>
          <span>连接: {edges.length}</span>
          <span className="hint">拖拽平移 | 滚轮缩放</span>
        </div>
      </div>
    </div>
  );
};
