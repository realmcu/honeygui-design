import React, { useRef, useEffect, useCallback } from 'react';
import { WidgetProps } from './types';
import { PARTICLE_EFFECT_MAP, ParticleEffectConfig } from '../../constants/particleEffects';
import './ParticleWidget.css';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  angle: number;       // 用于螺旋/环形运动
  angularSpeed: number;
  life: number;        // 0~1，用于 burst 类型的生命周期
}

const PARTICLE_COUNT = 40;

/** 根据运动类型初始化单个粒子 */
function createParticle(w: number, h: number, motion: string): Particle {
  const base: Particle = {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    size: 2 + Math.random() * 3,
    alpha: 0.4 + Math.random() * 0.6,
    angle: Math.random() * Math.PI * 2,
    angularSpeed: 0.005 + Math.random() * 0.015,
    life: 1,
  };

  switch (motion) {
    case 'fall':
      base.y = Math.random() * h;
      base.vy = 0.3 + Math.random() * 0.7;
      base.vx = (Math.random() - 0.5) * 0.3;
      break;
    case 'rise':
      base.y = h * 0.5 + Math.random() * h * 0.5;
      base.vy = -(0.3 + Math.random() * 0.5);
      base.vx = (Math.random() - 0.5) * 0.3;
      break;
    case 'burst':
      base.x = w / 2;
      base.y = h / 2;
      const burstAngle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      base.vx = Math.cos(burstAngle) * speed;
      base.vy = Math.sin(burstAngle) * speed;
      base.life = Math.random();
      break;
    case 'spiral':
      base.angle = Math.random() * Math.PI * 2;
      base.angularSpeed = 0.01 + Math.random() * 0.02;
      break;
    case 'wave':
      base.vy = (Math.random() - 0.5) * 0.4;
      base.vx = (Math.random() - 0.5) * 0.4;
      break;
    case 'bounce':
      base.vx = (Math.random() - 0.5) * 2;
      base.vy = (Math.random() - 0.5) * 2;
      break;
    case 'ring':
      base.angle = Math.random() * Math.PI * 2;
      base.angularSpeed = 0.015 + Math.random() * 0.01;
      break;
    case 'expand':
      base.x = w / 2;
      base.y = h / 2;
      const expandAngle = Math.random() * Math.PI * 2;
      const expandSpeed = 0.3 + Math.random() * 0.8;
      base.vx = Math.cos(expandAngle) * expandSpeed;
      base.vy = Math.sin(expandAngle) * expandSpeed;
      base.life = Math.random();
      break;
  }
  return base;
}

/** 更新粒子位置 */
function updateParticle(p: Particle, w: number, h: number, motion: string): void {
  switch (motion) {
    case 'fall':
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > h) { p.y = -p.size; p.x = Math.random() * w; }
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      break;
    case 'rise':
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -p.size) { p.y = h + p.size; p.x = Math.random() * w; }
      break;
    case 'burst':
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.008;
      p.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        p.x = w / 2; p.y = h / 2;
        const a = Math.random() * Math.PI * 2;
        const s = 0.5 + Math.random() * 1.5;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = 1; p.alpha = 1;
      }
      break;
    case 'spiral': {
      p.angle += p.angularSpeed;
      const radius = 20 + (p.angle % (Math.PI * 4)) * 8;
      p.x = w / 2 + Math.cos(p.angle) * radius;
      p.y = h / 2 + Math.sin(p.angle) * radius;
      if (radius > Math.min(w, h) / 2) p.angle = Math.random() * Math.PI * 2;
      break;
    }
    case 'wave':
      p.x += p.vx;
      p.y += Math.sin(p.x * 0.05) * 0.5 + p.vy;
      if (p.x < 0 || p.x > w) p.vx = -p.vx;
      if (p.y < 0 || p.y > h) p.vy = -p.vy;
      break;
    case 'bounce':
      p.x += p.vx;
      p.y += p.vy;
      if (p.x <= 0 || p.x >= w) p.vx = -p.vx;
      if (p.y <= 0 || p.y >= h) p.vy = -p.vy;
      break;
    case 'ring': {
      p.angle += p.angularSpeed;
      const r = Math.min(w, h) * 0.35;
      p.x = w / 2 + Math.cos(p.angle) * r;
      p.y = h / 2 + Math.sin(p.angle) * r;
      break;
    }
    case 'expand':
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.006;
      p.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        p.x = w / 2; p.y = h / 2;
        const ea = Math.random() * Math.PI * 2;
        const es = 0.3 + Math.random() * 0.8;
        p.vx = Math.cos(ea) * es; p.vy = Math.sin(ea) * es;
        p.life = 1; p.alpha = 1;
      }
      break;
  }
}

export const ParticleWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const width = component.position?.width ?? 200;
  const height = component.position?.height ?? 200;
  const effectType = (component.data?.particleEffect as string) || 'snow';
  const config: ParticleEffectConfig | undefined = PARTICLE_EFFECT_MAP.get(effectType);

  const initParticles = useCallback((w: number, h: number, motion: string) => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h, motion));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    initParticles(width, height, config.previewMotion);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        updateParticle(p, width, height, config.previewMotion);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = config.previewColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [width, height, effectType, config, initParticles]);

  // 未知特效类型 → 通用占位符
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

  return (
    <div className="particle-widget" style={style} {...handlers}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};
