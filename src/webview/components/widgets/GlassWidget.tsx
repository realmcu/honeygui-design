import React, { useState, useEffect, useRef } from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';
import { useDesignerStore } from '../../store';
import { getAbsolutePosition } from '../../utils/componentUtils';
import { Component } from '../../types';

/**
 * 解析 SVG 路径数据（支持 path、polygon、polyline、circle、ellipse）
 */
function parseSvgPaths(svgContent: string): string[] {
  const paths: string[] = [];
  
  const pathPattern = /<path[^>]*\sd="([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(svgContent)) !== null) {
    const pathData = match[1].trim();
    if (pathData) paths.push(pathData);
  }
  
  const polygonPattern = /<polygon[^>]*\spoints="([^"]*)"[^>]*>/gi;
  while ((match = polygonPattern.exec(svgContent)) !== null) {
    const pointsData = match[1].trim();
    if (pointsData) {
      const pathD = polygonPointsToPathD(pointsData, true);
      if (pathD) paths.push(pathD);
    }
  }
  
  // 解析 <polyline> 元素（不闭合）
  const polylinePattern = /<polyline[^>]*\spoints="([^"]*)"[^>]*>/gi;
  while ((match = polylinePattern.exec(svgContent)) !== null) {
    const pointsData = match[1].trim();
    if (pointsData) {
      const pathD = polygonPointsToPathD(pointsData, false);
      if (pathD) paths.push(pathD);
    }
  }
  
  // 解析 <circle> 元素
  const circlePattern = /<circle[^>]*>/gi;
  while ((match = circlePattern.exec(svgContent)) !== null) {
    const pathD = circleToPathD(match[0]);
    if (pathD) paths.push(pathD);
  }
  
  // 解析 <ellipse> 元素
  const ellipsePattern = /<ellipse[^>]*>/gi;
  while ((match = ellipsePattern.exec(svgContent)) !== null) {
    const pathD = ellipseToPathD(match[0]);
    if (pathD) paths.push(pathD);
  }
  
  return paths;
}

/**
 * 将 polygon/polyline 的 points 转换为 path d 格式
 * @param close 是否闭合路径（polygon=true, polyline=false）
 */
function polygonPointsToPathD(pointsData: string, close: boolean = true): string | null {
  const numbers = pointsData.match(/-?\d+\.?\d*/g)?.map(Number);
  if (!numbers || numbers.length < 4) return null;
  
  const points: Array<{x: number, y: number}> = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  
  if (points.length < 2) return null;
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  if (close) {
    d += ' Z';
  }
  
  return d;
}

/**
 * 将 <circle> 元素转换为 path d 格式
 */
function circleToPathD(circleTag: string): string | null {
  const cxMatch = circleTag.match(/\bcx\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  const cyMatch = circleTag.match(/\bcy\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  const rMatch = circleTag.match(/\br\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  
  const cx = cxMatch ? parseFloat(cxMatch[1]) : 0;
  const cy = cyMatch ? parseFloat(cyMatch[1]) : 0;
  const r = rMatch ? parseFloat(rMatch[1]) : 0;
  
  if (r <= 0) return null;
  
  return ellipseToPath(cx, cy, r, r);
}

/**
 * 将 <ellipse> 元素转换为 path d 格式
 */
function ellipseToPathD(ellipseTag: string): string | null {
  const cxMatch = ellipseTag.match(/\bcx\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  const cyMatch = ellipseTag.match(/\bcy\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  const rxMatch = ellipseTag.match(/\brx\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  const ryMatch = ellipseTag.match(/\bry\s*=\s*["']?(-?\d+\.?\d*)["']?/i);
  
  const cx = cxMatch ? parseFloat(cxMatch[1]) : 0;
  const cy = cyMatch ? parseFloat(cyMatch[1]) : 0;
  const rx = rxMatch ? parseFloat(rxMatch[1]) : 0;
  const ry = ryMatch ? parseFloat(ryMatch[1]) : 0;
  
  if (rx <= 0 || ry <= 0) return null;
  
  return ellipseToPath(cx, cy, rx, ry);
}

/**
 * 将椭圆/圆形转换为 path d 格式
 * 使用 4 段三次贝塞尔曲线近似
 */
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5522847498;
  const kx = k * rx;
  const ky = k * ry;
  
  return [
    `M ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}`,
    'Z'
  ].join(' ');
}

/**
 * 计算三次贝塞尔曲线上的点
 */
function cubicBezierPoint(
  t: number,
  p0: {x: number, y: number},
  p1: {x: number, y: number},
  p2: {x: number, y: number},
  p3: {x: number, y: number}
): {x: number, y: number} {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  };
}

function svgPathToPoints(pathData: string): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  const commandPattern = /([MLHVCSQTAZ])\s*([^MLHVCSQTAZ]*)/gi;
  let currentX = 0, currentY = 0;
  let match: RegExpExecArray | null;

  while ((match = commandPattern.exec(pathData)) !== null) {
    const cmd = match[1].toUpperCase();
    const params = match[2].trim();
    const numbers = params.match(/-?\d+\.?\d*/g)?.map(Number) || [];

    switch (cmd) {
      case 'M':
      case 'L':
        if (numbers.length >= 2) {
          currentX = numbers[0];
          currentY = numbers[1];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'H':
        if (numbers.length >= 1) {
          currentX = numbers[0];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'V':
        if (numbers.length >= 1) {
          currentY = numbers[0];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'C':
        // 三次贝塞尔曲线：采样多个点以获得平滑曲线
        if (numbers.length >= 6) {
          const p0 = { x: currentX, y: currentY };
          const p1 = { x: numbers[0], y: numbers[1] };
          const p2 = { x: numbers[2], y: numbers[3] };
          const p3 = { x: numbers[4], y: numbers[5] };
          
          // 采样 16 个点
          for (let i = 1; i <= 16; i++) {
            const t = i / 16;
            points.push(cubicBezierPoint(t, p0, p1, p2, p3));
          }
          
          currentX = numbers[4];
          currentY = numbers[5];
        }
        break;
      case 'Q':
        if (numbers.length >= 4) {
          currentX = numbers[2];
          currentY = numbers[3];
          points.push({ x: currentX, y: currentY });
        }
        break;
    }
  }

  return points;
}

function pointInPolygon(x: number, y: number, polygon: Array<{x: number, y: number}>): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function rayPolygonIntersectionDistance(
  centerX: number, centerY: number,
  dirX: number, dirY: number,
  polygon: Array<{x: number, y: number}>
): number {
  const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
  if (dirLength < 1e-10) return 1.0;

  const normDirX = dirX / dirLength;
  const normDirY = dirY / dirLength;
  let minDistance = Infinity;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = polygon[i].x, y1 = polygon[i].y;
    const x2 = polygon[j].x, y2 = polygon[j].y;

    const edgeX = x2 - x1;
    const edgeY = y2 - y1;
    const toEdgeX = x1 - centerX;
    const toEdgeY = y1 - centerY;

    const cross = normDirX * edgeY - normDirY * edgeX;
    if (Math.abs(cross) < 1e-10) continue;

    const t = (toEdgeX * edgeY - toEdgeY * edgeX) / cross;
    const s = (toEdgeX * normDirY - toEdgeY * normDirX) / cross;

    if (t > 1e-10 && s >= 0 && s <= 1) {
      minDistance = Math.min(minDistance, t);
    }
  }

  return minDistance === Infinity ? 1.0 : minDistance;
}

function renderGlassEffect(
  ctx: CanvasRenderingContext2D,
  bgImageData: ImageData,
  points: Array<{x: number, y: number}>,
  width: number,
  height: number,
  distortion: number = 0.1,
  region: number = 0.5
): void {
  if (points.length < 3) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  let centerX = 0, centerY = 0;
  for (const p of points) {
    centerX += p.x;
    centerY += p.y;
  }
  centerX /= points.length;
  centerY /= points.length;

  const outputData = ctx.createImageData(width, height);
  const bgData = bgImageData.data;
  const outData = outputData.data;

  // 初始化为完全透明
  for (let i = 0; i < outData.length; i += 4) {
    outData[i] = 0;
    outData[i + 1] = 0;
    outData[i + 2] = 0;
    outData[i + 3] = 0;
  }

  // 只在多边形区域内应用玻璃效果
  for (let y = Math.floor(minY); y <= Math.ceil(maxY) && y < height; y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX) && x < width; x++) {
      if (x < 0 || y < 0) continue;
      if (!pointInPolygon(x, y, points)) continue;

      const dx = x - centerX;
      const dy = y - centerY;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

      const boundaryDistance = rayPolygonIntersectionDistance(centerX, centerY, dx, dy, points);
      if (boundaryDistance <= 1e-10) continue;

      const threshold = boundaryDistance * (1 - region);
      
      let srcX = x;
      let srcY = y;
      
      if (distanceFromCenter > threshold) {
        const distanceRatio = Math.min((distanceFromCenter - threshold) / (boundaryDistance * region), 1.0);
        const t = distanceRatio;
        const ratio = distortion * (5.5 * t * t - 2 * t * t * t);

        const offsetX = Math.floor(-dx * ratio);
        const offsetY = Math.floor(-dy * ratio);

        srcX = Math.max(0, Math.min(width - 1, x + offsetX));
        srcY = Math.max(0, Math.min(height - 1, y + offsetY));
      }

      const dstIdx = (y * width + x) * 4;
      const srcIdx = (srcY * width + srcX) * 4;

      outData[dstIdx] = bgData[srcIdx];
      outData[dstIdx + 1] = bgData[srcIdx + 1];
      outData[dstIdx + 2] = bgData[srcIdx + 2];
      outData[dstIdx + 3] = 255; // 多边形内部完全不透明
    }
  }

  ctx.putImageData(outputData, 0, 0);
}

/**
 * 检查两个矩形是否重叠
 */
function rectsOverlap(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
): boolean {
  return !(r1.x + r1.w <= r2.x || r2.x + r2.w <= r1.x || 
           r1.y + r1.h <= r2.y || r2.y + r2.h <= r1.y);
}

/**
 * 递归收集所有可见组件（包括嵌套的子组件）
 */
function collectAllVisibleComponents(
  components: Component[],
  glassId: string,
  glassZIndex: number,
  glassRect: { x: number; y: number; w: number; h: number },
  allComponents: Component[]
): Component[] {
  const result: Component[] = [];
  
  for (const c of components) {
    if (c.id === glassId) continue;
    if ((c.zIndex || 1) > glassZIndex) continue;
    
    const absPos = getAbsolutePosition(c, allComponents);
    const compRect = {
      x: absPos.x,
      y: absPos.y,
      w: c.position.width,
      h: c.position.height
    };
    
    if (rectsOverlap(glassRect, compRect)) {
      result.push(c);
    }
  }
  
  return result.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
}

/**
 * 内部组件：用于获取图片的 webview URI
 */
const ImageLoader: React.FC<{
  src: string;
  onLoad: (uri: string) => void;
}> = ({ src, onLoad }) => {
  const uri = useWebviewUri(src);
  
  useEffect(() => {
    if (uri) {
      onLoad(uri);
    }
  }, [uri, onLoad]);
  
  return null;
};

export const GlassWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const src = component.data?.src;
  const webviewUri = useWebviewUri(src);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [svgPoints, setSvgPoints] = useState<Array<{x: number, y: number}> | null>(null);
  const imageUrisRef = useRef<Map<string, string>>(new Map());
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [renderTrigger, setRenderTrigger] = useState(0);

  // 玻璃效果参数
  const distortion = ((component.data?.distortion ?? 10) / 500);
  const region = ((component.data?.region ?? 50) / 100);

  const components = useDesignerStore(state => state.components);

  // 加载并解析 .glass 文件
  useEffect(() => {
    if (!webviewUri) return;

    fetch(webviewUri)
      .then(r => r.text())
      .then(svgContent => {
        const paths = parseSvgPaths(svgContent);
        if (paths.length > 0) {
          const points = svgPathToPoints(paths[0]);
          if (points.length >= 3) {
            let minX = Infinity, minY = Infinity;
            for (const p of points) {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
            }
            const normalizedPoints = points.map(p => ({
              x: p.x - minX,
              y: p.y - minY
            }));
            setSvgPoints(normalizedPoints);
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [webviewUri]);

  // 找到所有需要渲染的下方组件
  const belowComponents = React.useMemo(() => {
    const glassAbsPos = getAbsolutePosition(component, components);
    const glassRect = {
      x: glassAbsPos.x,
      y: glassAbsPos.y,
      w: component.position.width,
      h: component.position.height
    };
    const currentZIndex = component.zIndex || 1;
    
    return collectAllVisibleComponents(components, component.id, currentZIndex, glassRect, components);
  }, [component, components]);

  // 只获取图片组件用于 URI 加载
  const belowImageComponents = React.useMemo(() => {
    return belowComponents.filter(c => c.type === 'hg_image' && c.data?.src);
  }, [belowComponents]);

  // 处理图片 URI 加载并预加载图片
  const handleImageUriLoad = React.useCallback((compId: string, uri: string) => {
    if (imageUrisRef.current.get(compId) !== uri) {
      imageUrisRef.current.set(compId, uri);
      
      if (!imageCacheRef.current.has(uri)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCacheRef.current.set(uri, img);
          const allLoaded = belowImageComponents.every(c => {
            const u = imageUrisRef.current.get(c.id);
            return u && imageCacheRef.current.has(u);
          });
          if (allLoaded) {
            setRenderTrigger(prev => prev + 1);
          }
        };
        img.src = uri;
      } else {
        const allLoaded = belowImageComponents.every(c => {
          const u = imageUrisRef.current.get(c.id);
          return u && imageCacheRef.current.has(u);
        });
        if (allLoaded) {
          setRenderTrigger(prev => prev + 1);
        }
      }
    }
  }, [belowImageComponents]);

  // 渲染玻璃效果
  useEffect(() => {
    if (!svgPoints || !canvasRef.current) return;
    
    const allLoaded = belowImageComponents.length === 0 || 
      belowImageComponents.every(c => imageUrisRef.current.has(c.id));
    if (!allLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = component.position.width;
    const height = component.position.height;
    canvas.width = width;
    canvas.height = height;

    const glassAbsPos = getAbsolutePosition(component, components);

    ctx.clearRect(0, 0, width, height);

    // 创建临时 canvas 用于绘制背景
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 先清空为完全透明
    tempCtx.clearRect(0, 0, width, height);
    
    // 查找 glass 覆盖区域内最底层的背景色
    // 优先从 belowComponents 中找（按 zIndex 排序，最小的在前）
    let foundBackground = false;
    for (const comp of belowComponents) {
      if (comp.type === 'hg_view' || comp.type === 'hg_window') {
        // 检查是否显示背景色
        // hg_window 需要检查 showBackground 属性
        // hg_view 直接使用 backgroundColor
        const shouldShowBg = comp.type === 'hg_window' 
          ? (comp.style?.showBackground === true)
          : true;
        
        if (shouldShowBg && comp.style?.backgroundColor) {
          const compAbsPos = getAbsolutePosition(comp, components);
          const relX = compAbsPos.x - glassAbsPos.x;
          const relY = compAbsPos.y - glassAbsPos.y;
          tempCtx.fillStyle = comp.style.backgroundColor;
          tempCtx.fillRect(relX, relY, comp.position.width, comp.position.height);
          foundBackground = true;
        }
      }
    }
    
    // 如果没有找到任何容器背景，尝试从父容器查找
    if (!foundBackground) {
      const findParentBackground = (comp: Component): string | null => {
        if (!comp.parent) return null;
        const parentComp = components.find(c => c.id === comp.parent);
        if (!parentComp) return null;
        
        // 检查是否显示背景色
        const shouldShowBg = parentComp.type === 'hg_window' 
          ? (parentComp.style?.showBackground === true)
          : true;
        
        if (shouldShowBg && parentComp.style?.backgroundColor) {
          return parentComp.style.backgroundColor;
        }
        return findParentBackground(parentComp);
      };
      
      const parentBg = findParentBackground(component);
      if (parentBg) {
        tempCtx.fillStyle = parentBg;
        tempCtx.fillRect(0, 0, width, height);
      }
    }

    // 绘制所有下方组件
    for (const comp of belowComponents) {
      const compAbsPos = getAbsolutePosition(comp, components);
      const relX = compAbsPos.x - glassAbsPos.x;
      const relY = compAbsPos.y - glassAbsPos.y;
      const compW = comp.position.width;
      const compH = comp.position.height;
      const s = comp.style || {};
      const d = comp.data || {};
      
      // 容器类型 (hg_view, hg_window) - 绘制背景色
      if (comp.type === 'hg_view' || comp.type === 'hg_window') {
        // hg_window 需要检查 showBackground 属性
        const shouldShowBg = comp.type === 'hg_window' 
          ? (s.showBackground === true)
          : true;
        
        if (shouldShowBg && s.backgroundColor) {
          tempCtx.fillStyle = s.backgroundColor;
          tempCtx.fillRect(relX, relY, compW, compH);
        }
      }
      
      // 图片
      else if (comp.type === 'hg_image' && d.src) {
        const uri = imageUrisRef.current.get(comp.id);
        if (uri) {
          const cachedImg = imageCacheRef.current.get(uri);
          if (cachedImg) {
            tempCtx.drawImage(cachedImg, relX, relY, compW, compH);
          }
        }
      }
      
      // 文本
      else if (comp.type === 'hg_label' && d.text) {
        const fontSize = d.fontSize || 14;
        const fontColor = d.fontColor || s.color || '#ffffff';
        tempCtx.font = `${fontSize}px sans-serif`;
        tempCtx.fillStyle = fontColor;
        tempCtx.textBaseline = 'top';
        tempCtx.fillText(d.text, relX, relY);
      }
      
      // 时间标签
      else if (comp.type === 'hg_time_label') {
        const fontSize = d.fontSize || 14;
        const fontColor = d.fontColor || s.color || '#ffffff';
        const format = d.format || 'HH:mm:ss';
        tempCtx.font = `${fontSize}px sans-serif`;
        tempCtx.fillStyle = fontColor;
        tempCtx.textBaseline = 'top';
        tempCtx.fillText(format, relX, relY);
      }
      
      // 按钮
      else if (comp.type === 'hg_button') {
        if (s.backgroundColor) {
          tempCtx.fillStyle = s.backgroundColor;
          tempCtx.fillRect(relX, relY, compW, compH);
        }
        if (d.text) {
          const fontSize = d.fontSize || 14;
          const fontColor = d.fontColor || s.color || '#ffffff';
          tempCtx.font = `${fontSize}px sans-serif`;
          tempCtx.fillStyle = fontColor;
          tempCtx.textAlign = 'center';
          tempCtx.textBaseline = 'middle';
          tempCtx.fillText(d.text, relX + compW / 2, relY + compH / 2);
          tempCtx.textAlign = 'left';
        }
      }
      
      // 矩形
      else if (comp.type === 'hg_rect') {
        const fillColor = s.fillColor || '#007acc';
        const opacity = (s.opacity ?? 255) / 255;
        const borderRadius = s.borderRadius ?? 0;
        
        tempCtx.globalAlpha = opacity;
        tempCtx.fillStyle = fillColor;
        
        if (borderRadius > 0) {
          // 圆角矩形
          tempCtx.beginPath();
          tempCtx.roundRect(relX, relY, compW, compH, borderRadius);
          tempCtx.fill();
        } else {
          tempCtx.fillRect(relX, relY, compW, compH);
        }
        tempCtx.globalAlpha = 1;
      }
      
      // 圆形
      else if (comp.type === 'hg_circle') {
        const radius = s.radius ?? 40;
        const fillColor = s.fillColor || '#007acc';
        const opacity = s.opacity !== undefined ? s.opacity / 255 : 1;
        const cx = relX + compW / 2;
        const cy = relY + compH / 2;
        
        tempCtx.globalAlpha = opacity;
        tempCtx.fillStyle = fillColor;
        tempCtx.beginPath();
        tempCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        tempCtx.fill();
        tempCtx.globalAlpha = 1;
      }
      
      // 弧形
      else if (comp.type === 'hg_arc') {
        const radius = s.radius ?? 40;
        const startAngle = (s.startAngle ?? 0) * Math.PI / 180;
        const endAngle = (s.endAngle ?? 270) * Math.PI / 180;
        const strokeWidth = s.strokeWidth ?? 8;
        const color = s.color || '#007acc';
        const opacity = s.opacity !== undefined ? s.opacity / 255 : 1;
        const cx = relX + compW / 2;
        const cy = relY + compH / 2;
        
        tempCtx.globalAlpha = opacity;
        tempCtx.strokeStyle = color;
        tempCtx.lineWidth = strokeWidth;
        tempCtx.lineCap = 'round';
        tempCtx.beginPath();
        tempCtx.arc(cx, cy, radius, startAngle, endAngle);
        tempCtx.stroke();
        tempCtx.globalAlpha = 1;
      }
      
      // 输入框
      else if (comp.type === 'hg_input' || comp.type === 'hg_textarea') {
        tempCtx.fillStyle = s.backgroundColor || '#ffffff';
        tempCtx.fillRect(relX, relY, compW, compH);
        tempCtx.strokeStyle = '#cccccc';
        tempCtx.lineWidth = 1;
        tempCtx.strokeRect(relX, relY, compW, compH);
        
        if (d.placeholder || d.value) {
          const fontSize = d.fontSize || 14;
          tempCtx.font = `${fontSize}px sans-serif`;
          tempCtx.fillStyle = d.value ? '#000000' : '#999999';
          tempCtx.textBaseline = 'middle';
          tempCtx.fillText(String(d.value || d.placeholder || ''), relX + 4, relY + compH / 2);
        }
      }
      
      // 复选框
      else if (comp.type === 'hg_checkbox') {
        const checked = d.checked ?? false;
        const boxSize = Math.min(compW, compH, 20);
        
        tempCtx.strokeStyle = '#666666';
        tempCtx.lineWidth = 2;
        tempCtx.strokeRect(relX, relY + (compH - boxSize) / 2, boxSize, boxSize);
        
        if (checked) {
          tempCtx.strokeStyle = '#007acc';
          tempCtx.beginPath();
          tempCtx.moveTo(relX + 4, relY + (compH - boxSize) / 2 + boxSize / 2);
          tempCtx.lineTo(relX + boxSize / 3, relY + (compH - boxSize) / 2 + boxSize - 4);
          tempCtx.lineTo(relX + boxSize - 4, relY + (compH - boxSize) / 2 + 4);
          tempCtx.stroke();
        }
      }
      
      // 单选框
      else if (comp.type === 'hg_radio') {
        const checked = d.checked ?? false;
        const radius = Math.min(compW, compH, 20) / 2;
        const cx = relX + radius;
        const cy = relY + compH / 2;
        
        tempCtx.strokeStyle = '#666666';
        tempCtx.lineWidth = 2;
        tempCtx.beginPath();
        tempCtx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
        tempCtx.stroke();
        
        if (checked) {
          tempCtx.fillStyle = '#007acc';
          tempCtx.beginPath();
          tempCtx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
          tempCtx.fill();
        }
      }
      
      // 开关
      else if (comp.type === 'hg_switch') {
        const checked = d.checked ?? false;
        const trackHeight = Math.min(compH, 24);
        const trackWidth = Math.min(compW, 44);
        const trackY = relY + (compH - trackHeight) / 2;
        const thumbRadius = trackHeight / 2 - 2;
        
        // 轨道
        tempCtx.fillStyle = checked ? '#007acc' : '#cccccc';
        tempCtx.beginPath();
        tempCtx.roundRect(relX, trackY, trackWidth, trackHeight, trackHeight / 2);
        tempCtx.fill();
        
        // 滑块
        const thumbX = checked ? relX + trackWidth - thumbRadius - 2 : relX + thumbRadius + 2;
        tempCtx.fillStyle = '#ffffff';
        tempCtx.beginPath();
        tempCtx.arc(thumbX, trackY + trackHeight / 2, thumbRadius, 0, Math.PI * 2);
        tempCtx.fill();
      }
      
      // 滑块
      else if (comp.type === 'hg_slider') {
        const value = Number(d.value ?? 50);
        const min = Number(d.min ?? 0);
        const max = Number(d.max ?? 100);
        const progress = (value - min) / (max - min);
        const trackHeight = 4;
        const trackY = relY + (compH - trackHeight) / 2;
        
        // 轨道背景
        tempCtx.fillStyle = '#cccccc';
        tempCtx.fillRect(relX, trackY, compW, trackHeight);
        
        // 进度
        tempCtx.fillStyle = '#007acc';
        tempCtx.fillRect(relX, trackY, compW * progress, trackHeight);
        
        // 滑块
        const thumbX = relX + compW * progress;
        tempCtx.fillStyle = '#007acc';
        tempCtx.beginPath();
        tempCtx.arc(thumbX, relY + compH / 2, 8, 0, Math.PI * 2);
        tempCtx.fill();
      }
      
      // 列表
      else if (comp.type === 'hg_list') {
        if (s.backgroundColor) {
          tempCtx.fillStyle = s.backgroundColor;
          tempCtx.fillRect(relX, relY, compW, compH);
        }
      }
      
      // 列表项
      else if (comp.type === 'hg_list_item') {
        if (s.backgroundColor) {
          tempCtx.fillStyle = s.backgroundColor;
          tempCtx.fillRect(relX, relY, compW, compH);
        }
      }
      
      // Canvas 画布
      else if (comp.type === 'hg_canvas') {
        tempCtx.fillStyle = s.backgroundColor || '#ffffff';
        tempCtx.fillRect(relX, relY, compW, compH);
      }
      
      // 视频占位符
      else if (comp.type === 'hg_video') {
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(relX, relY, compW, compH);
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = '24px sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText('▶', relX + compW / 2, relY + compH / 2);
        tempCtx.textAlign = 'left';
      }
      
      // 3D 模型占位符
      else if (comp.type === 'hg_3d') {
        tempCtx.fillStyle = s.backgroundColor || '#1a1a2e';
        tempCtx.fillRect(relX, relY, compW, compH);
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = '24px sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText('🎲', relX + compW / 2, relY + compH / 2);
        tempCtx.textAlign = 'left';
      }
      
      // SVG 占位符
      else if (comp.type === 'hg_svg') {
        tempCtx.fillStyle = '#f0f0f0';
        tempCtx.fillRect(relX, relY, compW, compH);
        tempCtx.fillStyle = '#666666';
        tempCtx.font = '24px sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText('🎨', relX + compW / 2, relY + compH / 2);
        tempCtx.textAlign = 'left';
      }
      
      // Lottie 占位符
      else if (comp.type === 'hg_lottie') {
        tempCtx.fillStyle = s.backgroundColor || '#f0f0f0';
        tempCtx.fillRect(relX, relY, compW, compH);
        tempCtx.fillStyle = '#666666';
        tempCtx.font = '24px sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText('🎬', relX + compW / 2, relY + compH / 2);
        tempCtx.textAlign = 'left';
      }
      
      // 其他有背景色的组件
      else if (s.backgroundColor) {
        tempCtx.fillStyle = s.backgroundColor;
        tempCtx.fillRect(relX, relY, compW, compH);
      }
    }

    const bgImageData = tempCtx.getImageData(0, 0, width, height);
    renderGlassEffect(ctx, bgImageData, svgPoints, width, height, distortion, region);
  }, [svgPoints, renderTrigger, component.position.x, component.position.y, 
      component.position.width, component.position.height, distortion, region, 
      belowComponents, belowImageComponents, components, component.parent, component]);

  if (error) {
    return (
      <div style={{ ...style, display: style?.display === 'none' ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }} {...handlers}>
        <span style={{ fontSize: 32 }}>🔮</span>
      </div>
    );
  }

  return (
    <div style={{ ...style, display: style?.display === 'none' ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }} {...handlers}>
      {belowImageComponents.map(c => (
        <ImageLoader
          key={c.id}
          src={c.data?.src || ''}
          onLoad={(uri) => handleImageUriLoad(c.id, uri)}
        />
      ))}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
};
