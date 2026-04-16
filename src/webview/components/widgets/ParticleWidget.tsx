/**
 * 粒子效果组件 - 配置驱动的通用渲染引擎
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { WidgetProps } from './types';
import { 
  ParticleEffectConfig, 
  getEffectConfig,
  EmissionShape,
  ColorMode,
} from '../../constants/particleEffects';
import './ParticleWidget.css';

// ============================================================================
// 粒子数据结构
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;        // 当前生命值
  maxLife: number;     // 最大生命值
  scale: number;       // 当前缩放
  angle: number;       // 轨道角度（用于 orbit/spiral）
  phase: number;       // 相位（用于 wave/breathe）
  color: string;       // 粒子颜色
  // 缓存的初始值
  alphaStart: number;
  alphaEnd: number;
  scaleStart: number;
  scaleEnd: number;
  colorStart: string;
  colorEnd: string;
}

// ============================================================================
// 光束状态（用于 light_beam 效果）
// ============================================================================

interface BeamState {
  headX: number;
  headY: number;
  vx: number;
  vy: number;
  nextChangeFrame: number;  // 下次变向的帧号
  colorCore: string;
  colorMid: string;
  colorTail: string;
  histX: number[];  // 环形历史缓冲
  histY: number[];
  histHead: number;
  histCount: number;
}

function beamHistoryPush(b: BeamState, x: number, y: number) {
  const cap = b.histX.length;
  b.histX[b.histHead] = x;
  b.histY[b.histHead] = y;
  b.histHead = (b.histHead + 1) % cap;
  if (b.histCount < cap) b.histCount++;
}

function beamHistoryGet(b: BeamState, age: number): { x: number; y: number } | null {
  if (age >= b.histCount) return null;
  const idx = (b.histHead - 1 - age + b.histX.length) % b.histX.length;
  return { x: b.histX[idx], y: b.histY[idx] };
}

// ============================================================================
// 工具函数
// ============================================================================

/** 随机范围 */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 解析颜色为 RGB */
function parseColor(color: string): { r: number; g: number; b: number } {
  const hex = color.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/** RGB 转颜色字符串 */
function rgbToColor(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** 颜色插值 */
function lerpColor(start: string, end: string, t: number): string {
  const s = parseColor(start);
  const e = parseColor(end);
  return rgbToColor(
    s.r + (e.r - s.r) * t,
    s.g + (e.g - s.g) * t,
    s.b + (e.b - s.b) * t
  );
}

/** HSL 转 RGB */
function hslToRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToColor((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// ============================================================================
// 粒子创建
// ============================================================================

/** 根据发射形状计算初始位置 */
function getEmissionPosition(shape: EmissionShape, w: number, h: number, pathIndex?: number): { x: number; y: number } {
  switch (shape.type) {
    case 'line': {
      const extend = shape.extend ?? 0;
      switch (shape.position) {
        case 'top': return { x: rand(-w * extend, w * (1 + extend)), y: -5 };
        case 'bottom': return { x: rand(-w * extend, w * (1 + extend)), y: h + 5 };
        case 'left': return { x: -5, y: rand(-h * extend, h * (1 + extend)) };
        case 'right': return { x: w + 5, y: rand(-h * extend, h * (1 + extend)) };
      }
      break;
    }
    case 'point':
      return { x: shape.x * w, y: shape.y * h };
    case 'circle': {
      const angle = rand(0, Math.PI * 2);
      const r = rand(0, shape.radius * Math.min(w, h));
      return { x: shape.x * w + Math.cos(angle) * r, y: shape.y * h + Math.sin(angle) * r };
    }
    case 'rect':
      return { 
        x: shape.x * w + rand(0, shape.w * w), 
        y: shape.y * h + rand(0, shape.h * h) 
      };
    case 'ring': {
      const angle = rand(0, Math.PI * 2);
      const r = rand(shape.innerRadius, shape.outerRadius) * Math.min(w, h);
      return { x: shape.x * w + Math.cos(angle) * r, y: shape.y * h + Math.sin(angle) * r };
    }
    case 'full':
      return { x: rand(0, w), y: rand(0, h) };
    case 'path': {
      // burst 时通过 pathIndex 指定路径，否则随机选
      const idx = pathIndex ?? Math.floor(Math.random() * shape.paths.length);
      const pts = shape.paths[idx % shape.paths.length];
      if (pts.length < 2) return { x: w / 2, y: h / 2 };
      const segIdx = Math.floor(Math.random() * (pts.length - 1));
      const t = Math.random();
      const x = (pts[segIdx][0] + (pts[segIdx + 1][0] - pts[segIdx][0]) * t) * w;
      const y = (pts[segIdx][1] + (pts[segIdx + 1][1] - pts[segIdx][1]) * t) * h;
      const jitter = shape.jitter ?? 0;
      return { x: x + rand(-jitter * w, jitter * w), y: y + rand(-jitter * h, jitter * h) };
    }
  }
  return { x: w / 2, y: h / 2 };
}

/** 根据颜色模式获取初始颜色 */
function getInitialColor(colorMode: ColorMode): { color: string; colorStart: string; colorEnd: string } {
  switch (colorMode.type) {
    case 'solid':
      return { color: colorMode.color, colorStart: colorMode.color, colorEnd: colorMode.color };
    case 'gradient':
      return { color: colorMode.start, colorStart: colorMode.start, colorEnd: colorMode.end };
    case 'random': {
      const c = colorMode.colors[Math.floor(Math.random() * colorMode.colors.length)];
      return { color: c, colorStart: c, colorEnd: c };
    }
    case 'rainbow': {
      const hue = rand(0, 360);
      const c = hslToRgb(hue, 0.8, 0.6);
      return { color: c, colorStart: c, colorEnd: c };
    }
  }
}

/** 创建单个粒子 */
function createParticle(config: ParticleEffectConfig, w: number, h: number, initialSpread = false, pathIndex?: number): Particle {
  const { emission, trajectory, lifecycle, visual } = config;
  
  // 位置
  let pos = getEmissionPosition(emission.shape, w, h, pathIndex);
  
  // 螺旋臂分布：按悬臂数量均匀分配，用对数螺旋计算位置
  if (config.special?.spiralArms && (emission.shape.type === 'ring' || emission.shape.type === 'circle')) {
    const arms = config.special.spiralArms;
    const cx = w / 2, cy = h / 2;
    const minDim = Math.min(w, h);
    const arm = Math.floor(Math.random() * arms.count);
    const armAngle = arm * Math.PI * 2 / arms.count;
    const innerR = emission.shape.type === 'ring' ? emission.shape.innerRadius * minDim : 0;
    const outerR = emission.shape.type === 'ring' ? emission.shape.outerRadius * minDim : (emission.shape.radius ?? 0.4) * minDim;
    const dist = innerR + Math.random() * (outerR - innerR);
    const coreR = arms.coreRadius * minDim;
    const spiralAngle = armAngle + Math.log(Math.max(dist, 1) / Math.max(coreR, 1)) * arms.tightness;
    const spread = (Math.random() - 0.5) * arms.spread;
    pos = { x: cx + Math.cos(spiralAngle + spread) * dist, y: cy + Math.sin(spiralAngle + spread) * dist };
  }
  
  // 初始分布：让粒子分散在整个区域（用于初始化时避免空白）
  if (initialSpread && config.boundary === 'kill') {
    if (emission.shape.type === 'line') {
      if (emission.shape.position === 'top') {
        pos.y = rand(-5, h);
      } else if (emission.shape.position === 'bottom') {
        pos.y = rand(0, h + 5);
      }
    }
  }
  
  // 速度
  const angle = rand(emission.angleMin, emission.angleMax);
  const speed = rand(emission.speedMin, emission.speedMax);
  
  // 生命周期
  const maxLife = rand(lifecycle.lifeMin, lifecycle.lifeMax);
  const life = initialSpread ? rand(0, maxLife) : maxLife;
  
  // 颜色
  const { color, colorStart, colorEnd } = getInitialColor(visual.color);
  
  // 轨道角度（用于 orbit/spiral）
  const orbitAngle = trajectory.type === 'orbit' || trajectory.type === 'spiral'
    ? Math.atan2(pos.y - h / 2, pos.x - w / 2)
    : 0;
  
  return {
    x: pos.x,
    y: pos.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: rand(visual.sizeMin, visual.sizeMax),
    alpha: visual.alphaStart,
    life,
    maxLife,
    scale: visual.scaleStart ?? 1,
    angle: orbitAngle,
    phase: rand(0, Math.PI * 2),
    color,
    alphaStart: visual.alphaStart,
    alphaEnd: visual.alphaEnd,
    scaleStart: visual.scaleStart ?? 1,
    scaleEnd: visual.scaleEnd ?? 1,
    colorStart,
    colorEnd,
  };
}

// ============================================================================
// 溅射粒子
// ============================================================================

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

/** 创建溅射粒子 */
function createSplashParticles(x: number, y: number, config: ParticleEffectConfig): SplashParticle[] {
  const splash = config.special?.splash;
  if (!splash) return [];
  
  const particles: SplashParticle[] = [];
  for (let i = 0; i < splash.count; i++) {
    // 参考 C 端：角度 0.3π~0.7π（向上弧线），随机左右
    const angle = Math.PI * (0.3 + Math.random() * 0.4);
    const speed = splash.speed * (0.5 + Math.random() * 0.5);
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    particles.push({
      x: x + rand(-3, 3),
      y: y,
      vx: Math.cos(angle) * speed * direction,
      vy: -Math.sin(angle) * speed,  // 向上
      size: rand(0.8, 1.5),
      alpha: 0.6 + Math.random() * 0.3,
      life: 18 + Math.floor(Math.random() * 12),  // 300~500ms @ 60fps ≈ 18~30帧
      maxLife: 30,
    });
  }
  return particles;
}

/** 更新溅射粒子 */
function updateSplashParticle(p: SplashParticle, groundY: number): boolean {
  p.life -= 1;
  p.vy += 0.4;  // 重力 (C端 ay=400，换算到帧 ≈ 0.4)
  p.x += p.vx;
  p.y += p.vy;
  
  // 透明度衰减
  const lifeRatio = p.life / p.maxLife;
  p.alpha = 0.8 * lifeRatio;
  
  // 超出地面或生命结束
  return p.life > 0 && p.y < groundY + 20;
}

// ============================================================================
// 粒子更新
// ============================================================================

interface UpdateResult {
  alive: boolean;
  splashPos: { x: number; y: number } | null;
}

/** 更新单个粒子 */
function updateParticle(
  p: Particle, 
  config: ParticleEffectConfig, 
  w: number, 
  h: number,
  frameCount: number
): UpdateResult {
  const { trajectory, lifecycle, visual, boundary, special } = config;
  
  // 生命周期
  p.life -= 1;
  const lifeRatio = 1 - (p.life / p.maxLife); // 0 → 1
  
  // 透明度渐变
  p.alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * lifeRatio;
  
  // 缩放渐变
  p.scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * lifeRatio;
  
  // 颜色渐变
  if (visual.color.type === 'gradient') {
    p.color = lerpColor(p.colorStart, p.colorEnd, lifeRatio);
  } else if (visual.color.type === 'rainbow') {
    const hue = (frameCount * 2 + p.phase * 180 / Math.PI) % 360;
    p.color = hslToRgb(hue, 0.8, 0.6);
  }
  
  // 呼吸效果
  if (special?.breathe) {
    const breathe = Math.sin(frameCount * special.breathe.frequency + p.phase);
    p.alpha *= (1 - special.breathe.amplitude / 2) + breathe * special.breathe.amplitude / 2;
  }
  
  // 轨迹更新
  switch (trajectory.type) {
    case 'linear':
      p.vx *= (1 - (trajectory.damping ?? 0));
      p.vy *= (1 - (trajectory.damping ?? 0));
      p.x += p.vx;
      p.y += p.vy;
      break;
      
    case 'gravity':
      p.vy += trajectory.gravity ?? 0;
      p.vx += trajectory.windX ?? 0;
      p.vy += trajectory.windY ?? 0;
      p.vx *= (1 - (trajectory.damping ?? 0));
      p.vy *= (1 - (trajectory.damping ?? 0));
      p.x += p.vx;
      p.y += p.vy;
      break;
      
    case 'orbit': {
      const cx = w / 2, cy = h / 2;
      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      p.angle += (trajectory.orbitSpeed ?? 0.02);
      // 保持在固定半径上做圆周运动，轻微向心收缩
      const pullSpeed = 0.05;
      const newDist = Math.max(5, dist - pullSpeed);
      p.x = cx + Math.cos(p.angle) * newDist;
      p.y = cy + Math.sin(p.angle) * newDist;
      break;
    }
      
    case 'spiral': {
      const cx = w / 2, cy = h / 2;
      const arms = special?.spiralArms;
      if (arms) {
        // 螺旋臂模式：切向旋转 + 径向内收
        const dx = p.x - cx, dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDim = Math.min(w, h);
        const coreR = arms.coreRadius * minDim;
        if (dist < coreR) {
          // 到达核心，标记死亡（会被 loop 重生）
          p.life = 0;
        } else {
          // 内圈转得更快
          const spinFactor = 1 + (minDim * 0.45 - dist) / (minDim * 0.45) * 3;
          p.angle += (trajectory.orbitSpeed ?? 0.015) * spinFactor;
          const newDist = dist - arms.pullSpeed;
          p.x = cx + Math.cos(p.angle) * newDist;
          p.y = cy + Math.sin(p.angle) * newDist;
        }
      } else {
        // 默认螺旋：向外扩展
        p.angle += (trajectory.orbitSpeed ?? 0.02);
        const radius = 20 + (p.angle % (Math.PI * 4)) * Math.min(w, h) * 0.08;
        p.x = cx + Math.cos(p.angle) * radius;
        p.y = cy + Math.sin(p.angle) * radius;
        if (radius > Math.min(w, h) * 0.45) {
          p.angle = rand(0, Math.PI * 2);
        }
      }
      break;
    }
      
    case 'wave':
      p.x += p.vx;
      p.y += p.vy;
      p.x += Math.sin(frameCount * (trajectory.waveFrequency ?? 0.05) + p.phase) * (trajectory.waveAmplitude ?? 0.5);
      p.y += Math.cos(frameCount * (trajectory.waveFrequency ?? 0.05) + p.phase) * (trajectory.waveAmplitude ?? 0.5) * 0.5;
      p.vx += (trajectory.windX ?? 0);
      p.vy += (trajectory.gravity ?? 0);
      break;
  }
  
  // 边界处理
  let dead = p.life <= 0;
  let splashPos: { x: number; y: number } | null = null;
  
  switch (boundary) {
    case 'kill': {
      // 计算发射线扩展的边界余量
      const ext = config.emission.shape.type === 'line' ? (config.emission.shape.extend ?? 0) : 0;
      const xMargin = (config.emission.shape.type === 'line' && 
        (config.emission.shape.position === 'top' || config.emission.shape.position === 'bottom'))
        ? w * ext + 10 : 10;
      const yMargin = (config.emission.shape.type === 'line' && 
        (config.emission.shape.position === 'left' || config.emission.shape.position === 'right'))
        ? h * ext + 10 : 10;
      if (p.x < -xMargin || p.x > w + xMargin || p.y < -yMargin) {
        dead = true;
      }
      // 落地检测（用于溅射）
      if (p.y > h - 10) {
        if (special?.splash) {
          splashPos = { x: p.x, y: h - 5 };
        }
        dead = true;
      }
      break;
    }
    case 'wrap':
      if (p.x < -5) p.x = w + 5;
      if (p.x > w + 5) p.x = -5;
      if (p.y < -5) p.y = h + 5;
      if (p.y > h + 5) p.y = -5;
      break;
    case 'reflect':
      if (p.x < 0 || p.x > w) { p.vx = -p.vx * 0.8; p.x = Math.max(0, Math.min(w, p.x)); }
      if (p.y < 0 || p.y > h) { p.vy = -p.vy * 0.8; p.y = Math.max(0, Math.min(h, p.y)); }
      break;
  }
  
  // 循环重生（burst 模式下不自动重生，等待下次爆发）
  if (dead && lifecycle.loop && !special?.burst) {
    const newP = createParticle(config, w, h, false);
    Object.assign(p, newP);
    return { alive: true, splashPos };
  }
  
  return { alive: !dead, splashPos };
}

// ============================================================================
// React 组件
// ============================================================================

const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;  // 约 16.67ms

/** 在指定像素位置创建粒子（用于交互模式） */
function createParticleAt(config: ParticleEffectConfig, w: number, h: number, px: number, py: number): Particle {
  const { emission, trajectory, lifecycle, visual } = config;
  const angle = rand(emission.angleMin, emission.angleMax);
  const speed = rand(emission.speedMin, emission.speedMax);
  const maxLife = rand(lifecycle.lifeMin, lifecycle.lifeMax);
  const { color, colorStart, colorEnd } = getInitialColor(visual.color);
  return {
    x: px, y: py,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: rand(visual.sizeMin, visual.sizeMax),
    alpha: visual.alphaStart,
    life: maxLife,
    maxLife,
    scale: visual.scaleStart ?? 1,
    angle: trajectory.type === 'orbit' || trajectory.type === 'spiral'
      ? Math.atan2(py - h / 2, px - w / 2) : 0,
    phase: rand(0, Math.PI * 2),
    color,
    alphaStart: visual.alphaStart,
    alphaEnd: visual.alphaEnd,
    scaleStart: visual.scaleStart ?? 1,
    scaleEnd: visual.scaleEnd ?? 1,
    colorStart, colorEnd,
  };
}

/** 在指定位置生成一圈均匀分布的 burst 粒子（用于涟漪等） */
function createUniformBurstAt(config: ParticleEffectConfig, w: number, h: number, px: number, py: number, count: number): Particle[] {
  const { emission, lifecycle, visual, trajectory } = config;
  const speed = emission.speedMin;  // 统一速度
  const result: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const maxLife = lifecycle.lifeMin;  // 统一生命
    const { color, colorStart, colorEnd } = getInitialColor(visual.color);
    result.push({
      x: px, y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: visual.sizeMin,  // 统一大小
      alpha: visual.alphaStart,
      life: maxLife,
      maxLife,
      scale: visual.scaleStart ?? 1,
      angle: trajectory.type === 'orbit' || trajectory.type === 'spiral'
        ? Math.atan2(py - h / 2, px - w / 2) : 0,
      phase: 0,
      color,
      alphaStart: visual.alphaStart,
      alphaEnd: visual.alphaEnd,
      scaleStart: visual.scaleStart ?? 1,
      scaleEnd: visual.scaleEnd ?? 1,
      colorStart, colorEnd,
    });
  }
  return result;
}

export const ParticleWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const secondaryParticlesRef = useRef<Particle[]>([]);  // 第二层粒子（如 rocket 烟雾）
  const splashParticlesRef = useRef<SplashParticle[]>([]);
  const beamsRef = useRef<BeamState[]>([]);  // 光束状态（light_beam 专用）
  const animFrameRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const burstTimerRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  // 交互模式状态
  const mouseDownRef = useRef<boolean>(false);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const emitAccumRef = useRef<number>(0);
  const restartFlagRef = useRef<number>(0);  // 递增触发 restart
  const isPlayingRef = useRef<boolean>(true);  // 预览播放状态

  const width = component.position?.width ?? 200;
  const height = component.position?.height ?? 200;
  const effectType = (component.data?.particleEffect as string) || 'snow';
  const config = getEffectConfig(effectType);
  const isInteractive = !!config?.interactive;
  const interactivePreview = !!(component.data as any)?.interactivePreview;

  const initParticles = useCallback((cfg: ParticleEffectConfig, w: number, h: number) => {
    if (cfg.interactive) {
      particlesRef.current = [];
    } else {
      particlesRef.current = Array.from(
        { length: cfg.particleCount }, 
        () => createParticle(cfg, w, h, true)
      );
    }
    // 初始化第二层粒子
    if (cfg.secondaryLayer) {
      const layer = cfg.secondaryLayer;
      // 构造一个临时 config 用于 createParticle
      const secConfig: ParticleEffectConfig = {
        ...cfg,
        particleCount: layer.particleCount,
        emission: layer.emission,
        trajectory: layer.trajectory,
        lifecycle: layer.lifecycle,
        visual: layer.visual,
        boundary: layer.boundary,
        special: undefined,
        secondaryLayer: undefined,
      };
      secondaryParticlesRef.current = Array.from(
        { length: layer.particleCount },
        () => createParticle(secConfig, w, h, true)
      );
    } else {
      secondaryParticlesRef.current = [];
    }
    splashParticlesRef.current = [];
    // 初始化光束状态
    const lb = cfg.special?.lightBeam;
    if (lb) {
      const histCap = 64;
      beamsRef.current = lb.beams.map(bc => {
        const angle = Math.random() * Math.PI * 2;
        const b: BeamState = {
          headX: bc.startX * w, headY: bc.startY * h,
          vx: Math.cos(angle) * lb.speed,
          vy: Math.sin(angle) * lb.speed,
          nextChangeFrame: lb.dirChangeInterval + Math.floor(Math.random() * lb.dirChangeJitter),
          colorCore: bc.core, colorMid: bc.mid, colorTail: bc.tail,
          histX: new Array(histCap).fill(bc.startX * w),
          histY: new Array(histCap).fill(bc.startY * h),
          histHead: 0, histCount: histCap,
        };
        return b;
      });
      // light_beam 模式下主粒子池仅用于闪光粒子，初始为空
      particlesRef.current = [];
    } else {
      beamsRef.current = [];
    }
  }, []);

  // 监听属性面板的粒子控制事件
  useEffect(() => {
    const handleControl = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.componentId !== component.id) return;
      if (detail.action === 'restart') {
        restartFlagRef.current++;
      } else if (detail.action === 'pause') {
        isPlayingRef.current = false;
      } else if (detail.action === 'play') {
        isPlayingRef.current = true;
      }
    };
    window.addEventListener('particleControl', handleControl);
    return () => window.removeEventListener('particleControl', handleControl);
  }, [component.id]);

  // restart 响应：重新初始化粒子
  const lastRestartRef = useRef<number>(0);
  useEffect(() => {
    // 每帧检查 restart flag（在 draw 循环中处理更好，但这里用 ref 对比也行）
  }, []);

  // 鼠标事件处理（交互模式，仅在 interactivePreview 开启时绑定）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config?.interactive || !interactivePreview) return;

    const interactive = config.interactive;
    const rect = () => canvas.getBoundingClientRect();

    const getPos = (e: MouseEvent) => {
      const r = rect();
      return {
        x: (e.clientX - r.left) / r.width * width,
        y: (e.clientY - r.top) / r.height * height,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      mouseDownRef.current = true;
      mousePosRef.current = getPos(e);
      emitAccumRef.current = 0;

      if (interactive.mode === 'touch') {
        const pos = mousePosRef.current;
        const count = interactive.burstCount ?? 15;
        const isUniform = config.special?.burst?.uniform;
        if (isUniform) {
          particlesRef.current.push(...createUniformBurstAt(config, width, height, pos.x, pos.y, count));
          burstTimerRef.current = 0;  // 重置自动触发计时器
        } else {
          for (let i = 0; i < count; i++) {
            particlesRef.current.push(createParticleAt(config, width, height, pos.x, pos.y));
          }
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      mousePosRef.current = getPos(e);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (interactive.mode === 'touch' && !config.special?.burst?.uniform) {
        const pos = getPos(e);
        const count = interactive.burstCount ?? 15;
        for (let i = 0; i < count; i++) {
          particlesRef.current.push(createParticleAt(config, width, height, pos.x, pos.y));
        }
      }
      mouseDownRef.current = false;
    };

    const onMouseLeave = () => {
      mouseDownRef.current = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      mouseDownRef.current = false;
    };
  }, [config, width, height, isInteractive, interactivePreview]);

  // Alt+左键快捷方式（不需要开启 interactivePreview 也能用）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config?.interactive || interactivePreview) return;
    // interactivePreview 开启时由上面的 effect 处理，这里只处理关闭时的 Alt+Click

    const interactive = config.interactive;
    const rect = () => canvas.getBoundingClientRect();
    const getPos = (e: MouseEvent) => {
      const r = rect();
      return {
        x: (e.clientX - r.left) / r.width * width,
        y: (e.clientY - r.top) / r.height * height,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      mouseDownRef.current = true;
      mousePosRef.current = getPos(e);
      emitAccumRef.current = 0;

      if (interactive.mode === 'touch') {
        const pos = mousePosRef.current;
        const count = interactive.burstCount ?? 15;
        const isUniform = config.special?.burst?.uniform;
        if (isUniform) {
          particlesRef.current.push(...createUniformBurstAt(config, width, height, pos.x, pos.y, count));
          burstTimerRef.current = 0;
        } else {
          for (let i = 0; i < count; i++) {
            particlesRef.current.push(createParticleAt(config, width, height, pos.x, pos.y));
          }
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      mousePosRef.current = getPos(e);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;

      if (interactive.mode === 'touch' && !config.special?.burst?.uniform) {
        const pos = getPos(e);
        const count = interactive.burstCount ?? 15;
        for (let i = 0; i < count; i++) {
          particlesRef.current.push(createParticleAt(config, width, height, pos.x, pos.y));
        }
      }
      mouseDownRef.current = false;
    };

    const onMouseLeave = () => {
      mouseDownRef.current = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      mouseDownRef.current = false;
    };
  }, [config, width, height, isInteractive, interactivePreview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    frameCountRef.current = 0;
    burstTimerRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastRestartRef.current = restartFlagRef.current;
    initParticles(config, width, height);

    const emitRate = isInteractive ? 2 : 0;

    const draw = (timestamp: number) => {
      let forceRender = false;

      // 检查 restart
      if (restartFlagRef.current !== lastRestartRef.current) {
        lastRestartRef.current = restartFlagRef.current;
        frameCountRef.current = 0;
        burstTimerRef.current = 0;
        initParticles(config, width, height);
        forceRender = true;
      }

      // 暂停时仅维持 rAF 循环，不更新粒子（restart 后强制渲染一帧）
      if (!isPlayingRef.current && !forceRender) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < FRAME_INTERVAL) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);
      
      frameCountRef.current++;
      burstTimerRef.current++;
      
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      const splashParticles = splashParticlesRef.current;

      // 交互模式：按住时持续发射粒子（uniform burst 模式不需要持续发射）
      if (isInteractive && mouseDownRef.current && !config.special?.burst?.uniform) {
        emitAccumRef.current += emitRate;
        while (emitAccumRef.current >= 1) {
          emitAccumRef.current -= 1;
          if (particles.length < config.particleCount) {
            const pos = mousePosRef.current;
            particles.push(createParticleAt(config, width, height, pos.x, pos.y));
          }
        }
      }
      
      // 爆发模式处理
      if (config.special?.burst) {
        const { interval, count, uniform } = config.special.burst;
        // interactive 模式下只在无触摸时自动 burst（如涟漪 3 秒无触摸自动触发）
        const shouldAutoBurst = isInteractive ? !mouseDownRef.current : true;
        if (shouldAutoBurst && burstTimerRef.current >= interval) {
          burstTimerRef.current = 0;
          if (isInteractive && uniform) {
            // interactive + uniform：在中心位置生成一圈均匀粒子
            const cx = config.emission.shape.type === 'point' ? (config.emission.shape as any).x * width : width / 2;
            const cy = config.emission.shape.type === 'point' ? (config.emission.shape as any).y * height : height / 2;
            particles.push(...createUniformBurstAt(config, width, height, cx, cy, count));
          } else {
            const pathIdx = config.emission.shape.type === 'path'
              ? Math.floor(Math.random() * config.emission.shape.paths.length)
              : undefined;
            for (let i = 0; i < Math.min(count, particles.length); i++) {
              const newP = createParticle(config, width, height, false, pathIdx);
              if (uniform) {
                const angle = (i / count) * Math.PI * 2;
                const speed = config.emission.speedMin;
                newP.vx = Math.cos(angle) * speed;
                newP.vy = Math.sin(angle) * speed;
              }
              Object.assign(particles[i], newP);
            }
          }
        }
      }
      
      // ====== 光束模式：更新光束状态 + 绘制轨迹 ======
      const beams = beamsRef.current;
      const lbCfg = config.special?.lightBeam;
      if (beams.length > 0 && lbCfg) {
        const frame = frameCountRef.current;
        for (const b of beams) {
          // 随机变向
          if (frame >= b.nextChangeFrame) {
            const angle = Math.atan2(b.vy, b.vx);
            const delta = (Math.random() - 0.5) * Math.PI;  // ±90°
            b.vx = Math.cos(angle + delta) * lbCfg.speed;
            b.vy = Math.sin(angle + delta) * lbCfg.speed;
            b.nextChangeFrame = frame + lbCfg.dirChangeInterval +
              Math.floor(Math.random() * lbCfg.dirChangeJitter);
          }
          // 移动
          b.headX += b.vx;
          b.headY += b.vy;
          // 边界反射
          let bounced = false;
          if (b.headX <= 0) { b.headX = 0; b.vx = -b.vx; bounced = true; }
          else if (b.headX >= width) { b.headX = width; b.vx = -b.vx; bounced = true; }
          if (b.headY <= 0) { b.headY = 0; b.vy = -b.vy; bounced = true; }
          else if (b.headY >= height) { b.headY = height; b.vy = -b.vy; bounced = true; }
          // 碰撞闪光
          if (bounced) {
            for (let fi = 0; fi < lbCfg.flashCount; fi++) {
              const fa = Math.random() * Math.PI * 2;
              const fs = lbCfg.flashSpeed * (0.3 + Math.random() * 0.7);
              const maxLife = 10 + Math.floor(Math.random() * 10);
              particles.push({
                x: b.headX, y: b.headY,
                vx: Math.cos(fa) * fs, vy: Math.sin(fa) * fs,
                size: 1.5 + Math.random() * 2, alpha: 1,
                life: maxLife, maxLife, scale: 1.5,
                angle: 0, phase: 0, color: '#ffffff',
                alphaStart: 1, alphaEnd: 0,
                scaleStart: 1.5, scaleEnd: 0,
                colorStart: '#ffffff', colorEnd: '#ffffff',
              });
            }
          }
          // 记录历史
          beamHistoryPush(b, b.headX, b.headY);
          // 绘制轨迹粒子
          for (let i = 0; i < lbCfg.beamLength; i++) {
            const pos = beamHistoryGet(b, i * 2);
            if (!pos) break;
            const t = i / (lbCfg.beamLength - 1);  // 0=头 1=尾
            // 三段颜色插值
            let c: string;
            if (t < 0.5) {
              c = lerpColor(b.colorCore, b.colorMid, t * 2);
            } else {
              c = lerpColor(b.colorMid, b.colorTail, (t - 0.5) * 2);
            }
            const sc = 1.5 * (1 - t * 0.2);
            const op = 1 - t * 0.2;
            ctx.globalAlpha = op;
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2 * sc, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // 更新闪光粒子（复用主粒子池，linear + 衰减）
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= 1;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          const lr = 1 - p.life / p.maxLife;
          p.alpha = 1 - lr;
          p.scale = p.scaleStart * (1 - lr);
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx;
          p.y += p.vy;
          if (p.alpha > 0.01) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        animFrameRef.current = requestAnimationFrame(draw);
        return;  // light_beam 模式跳过后续通用渲染
      }
      
      // 更新和渲染第二层粒子（如 rocket 烟雾，先渲染在主粒子下方）
      const secParticles = secondaryParticlesRef.current;
      if (secParticles.length > 0 && config.secondaryLayer) {
        const layer = config.secondaryLayer;
        const secConfig: ParticleEffectConfig = {
          ...config,
          particleCount: layer.particleCount,
          emission: layer.emission,
          trajectory: layer.trajectory,
          lifecycle: layer.lifecycle,
          visual: layer.visual,
          boundary: layer.boundary,
          special: undefined,
          secondaryLayer: undefined,
        };
        for (let i = secParticles.length - 1; i >= 0; i--) {
          const sp2 = secParticles[i];
          const result = updateParticle(sp2, secConfig, width, height, frameCountRef.current);
          if (!result.alive) continue;
          if (sp2.alpha > 0.01) {
            ctx.globalAlpha = Math.max(0, Math.min(1, sp2.alpha));
            ctx.fillStyle = sp2.color;
            ctx.beginPath();
            ctx.arc(sp2.x, sp2.y, sp2.size * sp2.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      // 更新和渲染主粒子
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const result = updateParticle(p, config, width, height, frameCountRef.current);
        
        if (result.splashPos) {
          const newSplash = createSplashParticles(result.splashPos.x, result.splashPos.y, config);
          splashParticles.push(...newSplash);
        }

        if (isInteractive && !result.alive) {
          particles.splice(i, 1);
          continue;
        }
        
        if (p.alpha > 0.01) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // 更新和渲染溅射粒子
      for (let i = splashParticles.length - 1; i >= 0; i--) {
        const sp = splashParticles[i];
        const alive = updateSplashParticle(sp, height);
        
        if (!alive) {
          splashParticles.splice(i, 1);
          continue;
        }
        
        if (sp.alpha > 0.01) {
          ctx.globalAlpha = Math.max(0, Math.min(1, sp.alpha));
          ctx.fillStyle = '#aaddff';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [width, height, effectType, config, initParticles, isInteractive]);

  if (!config) {
    return (
      <div
        className="particle-widget particle-widget-placeholder"
        style={style}
        {...handlers}
      >
        <span className="particle-widget-icon">✨</span>
        <span className="particle-widget-label">{effectType}</span>
      </div>
    );
  }

  const showCrosshair = isInteractive && interactivePreview;

  return (
    <div className="particle-widget" style={style} {...handlers}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: showCrosshair ? 'crosshair' : undefined }}
      />
    </div>
  );
};
