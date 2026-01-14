import React, { useState, useEffect, useRef } from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';
import { useDesignerStore } from '../../store';
import { getAbsolutePosition } from '../../utils/componentUtils';
import { Component } from '../../types';

/**
 * 解析 SVG 路径数据
 */
function parseSvgPaths(svgContent: string): string[] {
  const paths: string[] = [];
  
  const pathPattern = /<path[^>]*\sd="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = pathPattern.exec(svgContent)) !== null) {
    const pathData = match[1].trim();
    if (pathData) paths.push(pathData);
  }
  
  const polygonPattern = /<polygon[^>]*\spoints="([^"]*)"[^>]*>/gi;
  while ((match = polygonPattern.exec(svgContent)) !== null) {
    const pointsData = match[1].trim();
    if (pointsData) {
      const pathD = polygonPointsToPathD(pointsData);
      if (pathD) paths.push(pathD);
    }
  }
  
  return paths;
}

function polygonPointsToPathD(pointsData: string): string | null {
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
  d += ' Z';
  
  return d;
}

function svgPathToPoints(pathData: string): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  const commandPattern = /([MLHVCSQTAZ])\s*([^MLHVCSQTAZ]*)/gi;
  let currentX = 0, currentY = 0;
  let match;

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
        if (numbers.length >= 6) {
          currentX = numbers[4];
          currentY = numbers[5];
          points.push({ x: currentX, y: currentY });
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
 * 加载图片并返回 Promise
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map()); // 图片缓存
  const [renderTrigger, setRenderTrigger] = useState(0);

  // 玻璃效果参数（从百分比转换为实际值）
  // distortion: 100% 输入对应实际 0.2（除以 500）
  // region: 100% 输入对应实际 1.0（除以 100）
  const distortion = ((component.data?.distortion ?? 10) / 500);
  const region = ((component.data?.region ?? 50) / 100);

  const components = useDesignerStore(state => state.components);
  const canvasBackgroundColor = useDesignerStore(state => state.canvasBackgroundColor);

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
            setSvgPoints(points);
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [webviewUri]);

  // 找到需要渲染的下方组件（图片和有背景色的组件）
  const belowComponents = React.useMemo(() => {
    const glassAbsPos = getAbsolutePosition(component, components);
    const glassRect = {
      x: glassAbsPos.x,
      y: glassAbsPos.y,
      w: component.position.width,
      h: component.position.height
    };

    const result: Component[] = [];
    const currentZIndex = component.zIndex || 1;
    
    for (const c of components) {
      if (c.id === component.id) continue;
      if ((c.zIndex || 1) > currentZIndex) continue;
      
      const absPos = getAbsolutePosition(c, components);
      const compRect = {
        x: absPos.x,
        y: absPos.y,
        w: c.position.width,
        h: c.position.height
      };
      
      if (rectsOverlap(glassRect, compRect)) {
        // 包含图片组件和有背景色的组件
        if ((c.type === 'hg_image' && c.data?.src) || c.style?.backgroundColor) {
          result.push(c);
        }
      }
    }
    
    // 按 zIndex 排序，确保正确的绘制顺序
    return result.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
  }, [component, components]);

  // 只获取图片组件用于 URI 加载
  const belowImageComponents = React.useMemo(() => {
    return belowComponents.filter(c => c.type === 'hg_image' && c.data?.src);
  }, [belowComponents]);

  // 处理图片 URI 加载并预加载图片
  const handleImageUriLoad = React.useCallback((compId: string, uri: string) => {
    if (imageUrisRef.current.get(compId) !== uri) {
      imageUrisRef.current.set(compId, uri);
      
      // 预加载图片到缓存
      if (!imageCacheRef.current.has(uri)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCacheRef.current.set(uri, img);
          // 图片加载完成后触发渲染
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
        // 图片已在缓存中
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
    
    // 检查是否所有图片都已加载
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

    // 清除为透明背景
    ctx.clearRect(0, 0, width, height);

    // 创建临时 canvas 用于绘制背景
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 绘制背景色到临时 canvas
    // 优先使用父容器的背景色，否则使用画布背景色
    let bgColor = canvasBackgroundColor || '#3c3c3c';
    
    // 查找父容器的背景色
    if (component.parent) {
      const parentComp = components.find(c => c.id === component.parent);
      if (parentComp && parentComp.style?.backgroundColor) {
        bgColor = parentComp.style.backgroundColor;
      }
    }
    
    tempCtx.fillStyle = bgColor;
    tempCtx.fillRect(0, 0, width, height);

    // 绘制所有下方组件（同步，使用缓存的图片）
    for (const comp of belowComponents) {
      const compAbsPos = getAbsolutePosition(comp, components);
      const relX = compAbsPos.x - glassAbsPos.x;
      const relY = compAbsPos.y - glassAbsPos.y;
      
      // 绘制背景色
      if (comp.style?.backgroundColor) {
        tempCtx.fillStyle = comp.style.backgroundColor;
        tempCtx.fillRect(relX, relY, comp.position.width, comp.position.height);
      }
      
      // 绘制图片（从缓存获取）
      if (comp.type === 'hg_image' && comp.data?.src) {
        const uri = imageUrisRef.current.get(comp.id);
        if (uri) {
          const cachedImg = imageCacheRef.current.get(uri);
          if (cachedImg) {
            tempCtx.drawImage(cachedImg, relX, relY, comp.position.width, comp.position.height);
          }
        }
      }
    }

    const bgImageData = tempCtx.getImageData(0, 0, width, height);
    renderGlassEffect(ctx, bgImageData, svgPoints, width, height, distortion, region);
  }, [svgPoints, renderTrigger, component.position.x, component.position.y, component.position.width, component.position.height, distortion, region, belowComponents, belowImageComponents, components, canvasBackgroundColor]);

  if (error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }} {...handlers}>
        <span style={{ fontSize: 32 }}>🔮</span>
      </div>
    );
  }

  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }} {...handlers}>
      {/* 隐藏的图片 URI 加载器 */}
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
