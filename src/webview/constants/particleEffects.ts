/**
 * 粒子效果配置驱动系统
 * 所有效果通过配置定义，通用引擎读取配置渲染
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 发射形状类型 */
export type EmissionShape = 
  | { type: 'line'; position: 'top' | 'bottom' | 'left' | 'right'; extend?: number }  // extend: 超出边界的比例
  | { type: 'point'; x: number; y: number }  // 0~1 相对坐标
  | { type: 'circle'; x: number; y: number; radius: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'ring'; x: number; y: number; innerRadius: number; outerRadius: number }
  | { type: 'full' }  // 全屏随机
  | { type: 'path'; paths: number[][][]; jitter?: number };  // 多条路径，每条为 [x,y][] 归一化坐标，burst 时随机选一条

/** 轨迹类型 */
export type TrajectoryType = 'linear' | 'gravity' | 'orbit' | 'spiral' | 'wave';

/** 边界行为 */
export type BoundaryBehavior = 'kill' | 'wrap' | 'reflect' | 'none';

/** 颜色模式 */
export type ColorMode = 
  | { type: 'solid'; color: string }
  | { type: 'gradient'; start: string; end: string }
  | { type: 'random'; colors: string[] }
  | { type: 'rainbow' };

/** 粒子效果完整配置 */
export interface ParticleEffectConfig {
  type: string;
  i18nKey: string;
  
  // 粒子数量
  particleCount: number;
  
  // 发射配置
  emission: {
    shape: EmissionShape;
    angleMin: number;      // 发射角度范围（弧度），0=右，PI/2=下
    angleMax: number;
    speedMin: number;      // 初始速度范围（像素/帧）
    speedMax: number;
  };
  
  // 轨迹配置
  trajectory: {
    type: TrajectoryType;
    gravity?: number;      // 重力加速度（像素/帧²）
    windX?: number;        // 水平风力
    windY?: number;        // 垂直风力
    damping?: number;      // 阻尼 0~1
    orbitSpeed?: number;   // 轨道角速度
    waveAmplitude?: number; // 波动幅度
    waveFrequency?: number; // 波动频率
  };
  
  // 生命周期
  lifecycle: {
    lifeMin: number;       // 最小生命值（帧数）
    lifeMax: number;       // 最大生命值
    loop: boolean;         // 是否循环（死亡后重生）
  };
  
  // 视觉配置
  visual: {
    color: ColorMode;
    sizeMin: number;       // 粒子大小范围
    sizeMax: number;
    alphaStart: number;    // 透明度 0~1
    alphaEnd: number;
    scaleStart?: number;   // 缩放变化
    scaleEnd?: number;
  };
  
  // 边界行为
  boundary: BoundaryBehavior;
  
  // 交互模式（可选，用于 trail/touch 等跟随鼠标的效果）
  interactive?: {
    mode: 'trail' | 'touch';  // trail: 按住拖动持续发射; touch: 按下/松开 burst + 拖动持续发射
    burstCount?: number;       // touch 模式按下/松开时的 burst 数量
  };
  
  // 特殊行为（可选）
  special?: {
    burst?: {              // 爆发模式
      interval: number;    // 爆发间隔（帧）
      count: number;       // 每次爆发数量
      uniform?: boolean;   // 均匀分布角度（如涟漪的正圆发射）
    };
    breathe?: {            // 呼吸效果
      frequency: number;   // 频率
      amplitude: number;   // 幅度
    };
    splash?: {             // 落地溅射
      count: number;       // 溅射粒子数
      speed: number;       // 溅射速度
    };
    spiralArms?: {         // 螺旋臂分布（用于 galaxy 等）
      count: number;       // 悬臂数量
      spread: number;      // 臂宽散布 (0~1)
      tightness: number;   // 螺旋紧密度（对数螺旋系数）
      pullSpeed: number;   // 向心收缩速度（像素/帧）
      coreRadius: number;  // 核心半径比例 (0~1)，到达后重生
    };
    lightBeam?: {          // 多光束反射模式（用于 light_beam）
      beamCount: number;   // 光束数量
      beamLength: number;  // 每条光束的轨迹粒子数
      speed: number;       // 光束移动速度（像素/帧）
      dirChangeInterval: number;  // 随机变向间隔（帧）
      dirChangeJitter: number;    // 变向间隔随机抖动（帧）
      flashCount: number;  // 碰撞闪光粒子数
      flashSpeed: number;  // 闪光粒子速度
      beams: Array<{       // 每条光束的颜色配置
        core: string;      // 头部颜色
        mid: string;       // 中间颜色
        tail: string;      // 尾部颜色
        startX: number;    // 初始位置 x (0~1)
        startY: number;    // 初始位置 y (0~1)
      }>;
    };
  };
  
  // 第二层粒子（可选，用于 rocket 等双层效果）
  secondaryLayer?: {
    particleCount: number;
    emission: ParticleEffectConfig['emission'];
    trajectory: ParticleEffectConfig['trajectory'];
    lifecycle: ParticleEffectConfig['lifecycle'];
    visual: ParticleEffectConfig['visual'];
    boundary: BoundaryBehavior;
  };
}

// ============================================================================
// 效果配置
// ============================================================================

export const PARTICLE_EFFECTS: ParticleEffectConfig[] = [
  // Snow - 雪花
  {
    type: 'snow',
    i18nKey: 'Snow',
    particleCount: 60,
    emission: {
      shape: { type: 'line', position: 'top' },
      angleMin: Math.PI * 0.45,   // 向下偏左
      angleMax: Math.PI * 0.55,   // 向下偏右
      speedMin: 0.3,
      speedMax: 0.6,
    },
    trajectory: {
      type: 'gravity',
      gravity: 0.008,
      windX: 0.003,   // 很轻微的风
      damping: 0,
    },
    lifecycle: {
      lifeMin: 200,
      lifeMax: 400,
      loop: true,
    },
    visual: {
      color: { type: 'solid', color: '#ffffff' },
      sizeMin: 1.5,
      sizeMax: 4,
      alphaStart: 0.9,
      alphaEnd: 0.3,
    },
    boundary: 'kill',
  },
  
  // Rain - 雨滴
  {
    type: 'rain',
    i18nKey: 'Rain',
    particleCount: 100,
    emission: {
      shape: { type: 'line', position: 'top', extend: 0.8 },  // 向右扩展 80%
      angleMin: Math.PI * 0.58,  // 105° 向下偏左
      angleMax: Math.PI * 0.58,
      speedMin: 5,
      speedMax: 7,
    },
    trajectory: {
      type: 'gravity',
      gravity: 0.05,
      windX: 0,
      damping: 0,
    },
    lifecycle: {
      lifeMin: 120,
      lifeMax: 180,
      loop: true,
    },
    visual: {
      color: { type: 'solid', color: '#aaddff' },
      sizeMin: 2,
      sizeMax: 3.5,
      alphaStart: 0.9,
      alphaEnd: 0.7,
    },
    boundary: 'kill',
    special: {
      splash: { count: 5, speed: 2 },  // 落地溅射（对齐 C 端 SPLASH_PARTICLES=5, SPLASH_SPEED=80px/s）
    },
  },
  
  // Firework - 烟花
  {
    type: 'firework',
    i18nKey: 'Firework',
    particleCount: 50,
    emission: {
      shape: { type: 'point', x: 0.5, y: 0.5 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 1,
      speedMax: 3,
    },
    trajectory: {
      type: 'gravity',
      gravity: 0.03,
      damping: 0.02,
    },
    lifecycle: {
      lifeMin: 60,
      lifeMax: 100,
      loop: true,
    },
    visual: {
      color: { type: 'random', colors: ['#ff4444', '#ffaa00', '#44ff44', '#4444ff', '#ff44ff', '#44ffff', '#ffffff', '#ffff44'] },
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1,
      alphaEnd: 0,
    },
    boundary: 'none',
    special: {
      burst: { interval: 90, count: 40 },
    },
  },
  
  // Bubble - 气泡
  {
    type: 'bubble',
    i18nKey: 'Bubble',
    particleCount: 30,
    emission: {
      shape: { type: 'line', position: 'bottom' },
      angleMin: -Math.PI * 0.6,  // 向上偏左
      angleMax: -Math.PI * 0.4,  // 向上偏右
      speedMin: 0.2,
      speedMax: 0.5,
    },
    trajectory: {
      type: 'gravity',
      gravity: -0.008,  // 负重力，向上（C端 -50，换算）
      windX: 0,         // 几乎无水平风力
      damping: 0,
    },
    lifecycle: {
      lifeMin: 200,
      lifeMax: 350,
      loop: true,
    },
    visual: {
      color: { type: 'solid', color: '#ddeeff' },
      sizeMin: 2,
      sizeMax: 5,       // 缩小最大值
      alphaStart: 0.7,
      alphaEnd: 0.4,
      scaleStart: 1,
      scaleEnd: 1.2,
    },
    boundary: 'reflect',
  },
  
  // Fireflies - 萤火虫
  {
    type: 'fireflies',
    i18nKey: 'Fireflies',
    particleCount: 25,
    emission: {
      shape: { type: 'full' },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0.083,   // C端 5px/s ÷ 60fps
      speedMax: 0.25,    // C端 15px/s ÷ 60fps
    },
    trajectory: {
      type: 'wave',
      damping: 0,
      waveAmplitude: 0.2,
      waveFrequency: 0.012,
    },
    lifecycle: {
      lifeMin: 480,
      lifeMax: 900,
      loop: true,
    },
    visual: {
      color: { type: 'solid', color: '#ddff66' },
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 0.8,
      alphaEnd: 0.8,
    },
    boundary: 'wrap',
    special: {
      breathe: { frequency: 0.025, amplitude: 0.6 },
    },
  },
  
  // Galaxy - 螺旋星系
  {
    type: 'galaxy',
    i18nKey: 'Galaxy',
    particleCount: 180,
    emission: {
      shape: { type: 'ring', x: 0.5, y: 0.5, innerRadius: 0.2, outerRadius: 0.45 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0,
      speedMax: 0,
    },
    trajectory: {
      type: 'spiral',
      orbitSpeed: 0.015,
      damping: 0,
    },
    lifecycle: {
      lifeMin: 300,
      lifeMax: 500,
      loop: true,
    },
    visual: {
      color: { type: 'gradient', start: '#4488ff', end: '#ffaaff' },
      sizeMin: 1,
      sizeMax: 3,
      alphaStart: 0.9,
      alphaEnd: 0.3,
      scaleStart: 0.8,
      scaleEnd: 1.3,
    },
    boundary: 'none',
    special: {
      spiralArms: { count: 3, spread: 0.15, tightness: 1.2, pullSpeed: 0.15, coreRadius: 0.15 },
    },
  },
  
  // Vortex - 漩涡
  {
    type: 'vortex',
    i18nKey: 'Vortex',
    particleCount: 60,
    emission: {
      shape: { type: 'ring', x: 0.5, y: 0.5, innerRadius: 0.35, outerRadius: 0.45 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0,
      speedMax: 0,
    },
    trajectory: {
      type: 'orbit',
      orbitSpeed: 0.04,
      damping: 0,
    },
    lifecycle: {
      lifeMin: 150,
      lifeMax: 250,
      loop: true,
    },
    visual: {
      color: { type: 'rainbow' },
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1,
      alphaEnd: 0.2,
      scaleStart: 1.5,
      scaleEnd: 0.3,
    },
    boundary: 'none',
  },
  
  // Tunnel - 隧道
  {
    type: 'tunnel',
    i18nKey: 'Tunnel',
    particleCount: 50,
    emission: {
      shape: { type: 'ring', x: 0.5, y: 0.5, innerRadius: 0.02, outerRadius: 0.05 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 2,
      speedMax: 4,
    },
    trajectory: {
      type: 'linear',
      damping: 0,
    },
    lifecycle: {
      lifeMin: 60,
      lifeMax: 90,
      loop: true,
    },
    visual: {
      color: { type: 'solid', color: '#ffffff' },
      sizeMin: 1,
      sizeMax: 2,
      alphaStart: 1,
      alphaEnd: 0.3,
      scaleStart: 0.5,
      scaleEnd: 2.5,
    },
    boundary: 'none',
  },
  
  // Lightning - 闪电（预设路径 + burst，粒子沿路径密集分布）
  {
    type: 'lightning',
    i18nKey: 'Lightning',
    particleCount: 200,
    emission: {
      shape: { 
        type: 'path',
        jitter: 0.01,  // 粒子沿路径的微小随机偏移
        paths: [
          // 路径1：主干 + 2条分支（向右偏的闪电）
          [
            // 主干：从顶部中心到底部偏右
            [0.50, 0.08], [0.48, 0.15], [0.53, 0.22], [0.47, 0.30], [0.52, 0.38],
            [0.46, 0.46], [0.51, 0.54], [0.48, 0.62], [0.54, 0.70], [0.49, 0.78],
            [0.53, 0.85], [0.50, 0.92],
            // 分支A：从主干 30% 处向右延伸
            [0.47, 0.30], [0.55, 0.35], [0.60, 0.42], [0.65, 0.48],
            // 分支B：从主干 55% 处向左延伸
            [0.51, 0.54], [0.43, 0.60], [0.38, 0.66], [0.35, 0.72],
          ],
          // 路径2：主干 + 3条分支（向左偏的闪电）
          [
            // 主干
            [0.50, 0.08], [0.53, 0.14], [0.47, 0.21], [0.52, 0.28], [0.45, 0.36],
            [0.50, 0.43], [0.44, 0.51], [0.49, 0.58], [0.43, 0.66], [0.48, 0.74],
            [0.44, 0.82], [0.47, 0.92],
            // 分支A：从 28% 处向右
            [0.52, 0.28], [0.58, 0.33], [0.63, 0.39],
            // 分支B：从 43% 处向左
            [0.50, 0.43], [0.40, 0.48], [0.35, 0.54], [0.32, 0.60],
            // 分支C：从 66% 处向右
            [0.43, 0.66], [0.50, 0.71], [0.56, 0.76],
          ],
          // 路径3：锯齿更大的闪电
          [
            // 主干
            [0.50, 0.08], [0.44, 0.16], [0.56, 0.24], [0.43, 0.32], [0.55, 0.40],
            [0.42, 0.48], [0.54, 0.56], [0.45, 0.64], [0.53, 0.72], [0.46, 0.80],
            [0.52, 0.88], [0.48, 0.92],
            // 分支A：从 32% 处向左
            [0.43, 0.32], [0.36, 0.38], [0.30, 0.44], [0.27, 0.50],
            // 分支B：从 56% 处向右
            [0.54, 0.56], [0.62, 0.61], [0.67, 0.67],
          ],
          // 路径4：偏右的闪电
          [
            // 主干
            [0.52, 0.08], [0.55, 0.15], [0.50, 0.23], [0.56, 0.30], [0.51, 0.38],
            [0.57, 0.45], [0.52, 0.53], [0.58, 0.60], [0.53, 0.68], [0.57, 0.76],
            [0.54, 0.84], [0.56, 0.92],
            // 分支A：从 30% 处向左
            [0.56, 0.30], [0.48, 0.36], [0.42, 0.42],
            // 分支B：从 53% 处向右
            [0.52, 0.53], [0.60, 0.58], [0.66, 0.63], [0.70, 0.68],
          ],
        ],
      },
      angleMin: 0,
      angleMax: 0,
      speedMin: 0,
      speedMax: 0,
    },
    trajectory: {
      type: 'linear',
      damping: 0,
    },
    lifecycle: {
      lifeMin: 8,
      lifeMax: 18,
      loop: false,
    },
    visual: {
      color: { type: 'random', colors: ['#ffffff', '#ffffff', '#ffffff', '#ddeeff', '#bbddff', '#ffeecc'] },
      sizeMin: 1.5,
      sizeMax: 3,
      alphaStart: 1,
      alphaEnd: 0,
    },
    boundary: 'none',
    special: {
      burst: { interval: 72, count: 200 },
    },
  },
  
  // Light Beam - 光束（多光束反射激光，对齐 C 端 effect_light_beam.c）
  {
    type: 'light_beam',
    i18nKey: 'Light Beam',
    particleCount: 100,  // 闪光粒子池
    emission: {
      shape: { type: 'point', x: 0.5, y: 0.5 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 1,
      speedMax: 2,
    },
    trajectory: {
      type: 'linear',
      damping: 0.05,
    },
    lifecycle: {
      lifeMin: 10,
      lifeMax: 20,
      loop: false,
    },
    visual: {
      color: { type: 'solid', color: '#ffffff' },
      sizeMin: 1.5,
      sizeMax: 3.5,
      alphaStart: 1,
      alphaEnd: 0,
      scaleStart: 1.5,
      scaleEnd: 0,
    },
    boundary: 'none',
    special: {
      lightBeam: {
        beamCount: 3,
        beamLength: 25,
        speed: 4.7,           // C端 280px/s ÷ 60fps ≈ 4.7px/帧
        dirChangeInterval: 150, // C端 2500ms ÷ 16.7ms ≈ 150帧
        dirChangeJitter: 72,    // C端 1200ms ÷ 16.7ms ≈ 72帧
        flashCount: 12,
        flashSpeed: 2,          // C端 120px/s ÷ 60fps = 2px/帧
        beams: [
          { core: '#ff4444', mid: '#dd0000', tail: '#bb0000', startX: 0.45, startY: 0.5 },
          { core: '#44ff44', mid: '#00dd00', tail: '#00bb00', startX: 0.5, startY: 0.45 },
          { core: '#4444ff', mid: '#0020ff', tail: '#0010dd', startX: 0.55, startY: 0.5 },
        ],
      },
    },
  },
  
  // Magic Circle - 魔法阵
  {
    type: 'magic_circle',
    i18nKey: 'Magic Circle',
    particleCount: 50,
    emission: {
      shape: { type: 'ring', x: 0.5, y: 0.5, innerRadius: 0.25, outerRadius: 0.4 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0.2,
      speedMax: 0.5,
    },
    trajectory: {
      type: 'gravity',
      gravity: -0.02,
      damping: 0,
    },
    lifecycle: {
      lifeMin: 80,
      lifeMax: 150,
      loop: true,
    },
    visual: {
      color: { type: 'gradient', start: '#ffaa33', end: '#ffdd88' },
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1,
      alphaEnd: 0,
    },
    boundary: 'none',
  },
  
  // Rocket - 火箭尾焰（双层：火焰 + 烟雾，对齐 C 端 effect_rocket）
  {
    type: 'rocket',
    i18nKey: 'Rocket',
    particleCount: 60,
    emission: {
      shape: { type: 'point', x: 0.9, y: 0.1 },   // C端 nozzle 90%w, 10%h
      angleMin: Math.PI * 0.6,    // 135° - 25° ≈ 110°
      angleMax: Math.PI * 0.89,   // 135° + 25° ≈ 160°
      speedMin: 3,                // C端 180px/s ÷ 60fps
      speedMax: 5.3,              // C端 320px/s ÷ 60fps
    },
    trajectory: {
      type: 'gravity',
      gravity: 0.014,             // C端 50px/s² ÷ 60² ≈ 0.014
      damping: 0.02,
    },
    lifecycle: {
      lifeMin: 18,                // C端 300ms ÷ 16.7ms
      lifeMax: 30,                // C端 500ms ÷ 16.7ms
      loop: true,
    },
    visual: {
      color: { type: 'gradient', start: '#ffff00', end: '#ff4400' },  // C端 yellow→orange-red
      sizeMin: 2,
      sizeMax: 3,
      alphaStart: 1,
      alphaEnd: 0,
      scaleStart: 1.5,            // C端 scale 1.5→0.4
      scaleEnd: 0.4,
    },
    boundary: 'kill',
    // 烟雾层
    secondaryLayer: {
      particleCount: 30,
      emission: {
        shape: { type: 'point', x: 0.9, y: 0.1 },   // C端 nozzle 同火焰，仅微小偏移
        angleMin: Math.PI * 0.49,   // 135° - 37.5° ≈ 97.5°
        angleMax: Math.PI * 0.99,   // 135° + 37.5° ≈ 172.5°
        speedMin: 0.67,             // C端 40px/s ÷ 60fps
        speedMax: 1.33,             // C端 80px/s ÷ 60fps
      },
      trajectory: {
        type: 'gravity',
        gravity: -0.008,            // C端 -30px/s² ÷ 60²（向上飘）
        damping: 0.03,              // 降低阻尼让烟雾飘得更远
      },
      lifecycle: {
        lifeMin: 40,                // 稍长生命让烟雾扩散更充分
        lifeMax: 70,
        loop: true,
      },
      visual: {
        color: { type: 'gradient', start: '#888888', end: '#444444' },
        sizeMin: 2.5,
        sizeMax: 4,
        alphaStart: 0.55,
        alphaEnd: 0,
        scaleStart: 1.0,
        scaleEnd: 3.0,             // 增大终态缩放，烟雾扩散更大
      },
      boundary: 'kill',
    },
  },
  
  // Ripple - 涟漪（均匀正圆爆发，对齐 C 端 emit_ripple_ring）
  {
    type: 'ripple',
    i18nKey: 'Ripple',
    particleCount: 36,
    emission: {
      shape: { type: 'point', x: 0.5, y: 0.5 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 2,           // C端 RIPPLE_EXPAND_SPEED=120px/s ÷ 60fps = 2px/帧
      speedMax: 2,
    },
    trajectory: {
      type: 'linear',
      damping: 0.01,         // 降低阻尼让粒子跑得更远
    },
    lifecycle: {
      lifeMin: 120,          // 延长生命让粒子扩散到足够大半径
      lifeMax: 120,
      loop: false,
    },
    visual: {
      color: { type: 'solid', color: '#44ddff' },
      sizeMin: 2,
      sizeMax: 2,
      alphaStart: 1,
      alphaEnd: 0,
      scaleStart: 0.8,
      scaleEnd: 1.3,
    },
    boundary: 'none',
    interactive: {
      mode: 'touch',
      burstCount: 36,
    },
    special: {
      burst: { interval: 180, count: 36, uniform: true },
    },
  },
  
  // Trail - 拖尾（鼠标跟随，按住拖动持续发射，松开停止）
  {
    type: 'trail',
    i18nKey: 'Trail',
    particleCount: 80,
    emission: {
      shape: { type: 'point', x: 0.5, y: 0.5 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0.33,    // C端 20px/s ÷ 60fps
      speedMax: 0.83,    // C端 50px/s ÷ 60fps
    },
    trajectory: {
      type: 'linear',
      damping: 0.05,     // C端 0.95 damping → 1-0.95=0.05 每帧速度衰减
    },
    lifecycle: {
      lifeMin: 18,       // C端 300ms ÷ 16.7ms
      lifeMax: 36,       // C端 600ms ÷ 16.7ms
      loop: false,       // 不自动重生，由交互控制
    },
    visual: {
      color: { type: 'gradient', start: '#00ffff', end: '#0088ff' },  // C端 cyan→blue
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 0.78,  // C端 opacity 200/255
      alphaEnd: 0,
      scaleStart: 1,
      scaleEnd: 0.1,     // C端 scale 1→0.1
    },
    boundary: 'kill',
    interactive: {
      mode: 'trail',
    },
  },
  
  // Touch - 触摸反馈（按下 burst + 拖动持续发射 + 松开 burst）
  {
    type: 'touch',
    i18nKey: 'Touch',
    particleCount: 60,
    emission: {
      shape: { type: 'point', x: 0.5, y: 0.5 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0.83,    // C端 50px/s ÷ 60fps
      speedMax: 1.67,    // C端 100px/s ÷ 60fps
    },
    trajectory: {
      type: 'linear',
      damping: 0.1,      // C端 damping 0.1
    },
    lifecycle: {
      lifeMin: 24,       // C端 400ms ÷ 16.7ms
      lifeMax: 48,       // C端 800ms ÷ 16.7ms
      loop: false,       // 不自动重生，由交互控制
    },
    visual: {
      color: { type: 'gradient', start: '#ff00ff', end: '#ff88ff' },  // C端 magenta→pink
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1,
      alphaEnd: 0,
      scaleStart: 0.8,   // C端 scale 0.5→0（前端稍大一点好看）
      scaleEnd: 0,
    },
    boundary: 'kill',
    interactive: {
      mode: 'touch',
      burstCount: 15,    // C端 burst_count=15
    },
  },
  
  // Custom - 自定义
  {
    type: 'custom',
    i18nKey: 'Custom',
    particleCount: 40,
    emission: {
      shape: { type: 'circle', x: 0.5, y: 0.5, radius: 0.15 },
      angleMin: 0,
      angleMax: Math.PI * 2,
      speedMin: 0.3,
      speedMax: 0.8,
    },
    trajectory: {
      type: 'wave',
      gravity: -0.01,
      windX: 0.05,
      waveAmplitude: 1,
      waveFrequency: 0.03,
    },
    lifecycle: {
      lifeMin: 100,
      lifeMax: 200,
      loop: true,
    },
    visual: {
      color: { type: 'rainbow' },
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1,
      alphaEnd: 0.5,
    },
    boundary: 'wrap',
  },
];

// ============================================================================
// 工具函数
// ============================================================================

/** 所有预设特效类型名称数组 */
export const PARTICLE_EFFECT_TYPES = PARTICLE_EFFECTS.map(e => e.type);

/** type → config 快速查找 */
export const PARTICLE_EFFECT_MAP = new Map(PARTICLE_EFFECTS.map(e => [e.type, e]));

/** 获取效果配置 */
export function getEffectConfig(type: string): ParticleEffectConfig | undefined {
  return PARTICLE_EFFECT_MAP.get(type);
}
