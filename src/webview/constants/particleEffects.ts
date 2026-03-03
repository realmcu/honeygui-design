/**
 * 粒子效果集中配置
 * 所有预设特效的配置常量，其他模块统一引用此文件。
 * 新增特效只需在 PARTICLE_EFFECTS 数组中添加一项。
 */

export interface ParticleEffectConfig {
  type: string;
  i18nKey: string;
  previewColor: string;
  previewMotion: 'fall' | 'rise' | 'burst' | 'spiral' | 'wave' | 'bounce' | 'ring' | 'expand';
}

export const PARTICLE_EFFECTS: ParticleEffectConfig[] = [
  { type: 'snow', i18nKey: 'Snow', previewColor: '#ffffff', previewMotion: 'fall' },
  { type: 'rain', i18nKey: 'Rain', previewColor: '#4a90d9', previewMotion: 'fall' },
  { type: 'firework', i18nKey: 'Firework', previewColor: '#ff4444', previewMotion: 'burst' },
  { type: 'bubble', i18nKey: 'Bubble', previewColor: '#87ceeb', previewMotion: 'rise' },
  { type: 'fireflies', i18nKey: 'Fireflies', previewColor: '#adff2f', previewMotion: 'wave' },
  { type: 'galaxy', i18nKey: 'Galaxy', previewColor: '#6699ff', previewMotion: 'spiral' },
  { type: 'vortex', i18nKey: 'Vortex', previewColor: '#9933ff', previewMotion: 'spiral' },
  { type: 'tunnel', i18nKey: 'Tunnel', previewColor: '#ffffff', previewMotion: 'expand' },
  { type: 'lightning', i18nKey: 'Lightning', previewColor: '#ffff00', previewMotion: 'burst' },
  { type: 'light_beam', i18nKey: 'Light Beam', previewColor: '#ff66cc', previewMotion: 'bounce' },
  { type: 'magic_circle', i18nKey: 'Magic Circle', previewColor: '#ffaa33', previewMotion: 'ring' },
  { type: 'rocket', i18nKey: 'Rocket', previewColor: '#ff6633', previewMotion: 'fall' },
  { type: 'ripple', i18nKey: 'Ripple', previewColor: '#4a90d9', previewMotion: 'expand' },
  { type: 'trail', i18nKey: 'Trail', previewColor: '#ffffff', previewMotion: 'wave' },
  { type: 'touch', i18nKey: 'Touch', previewColor: '#ff44ff', previewMotion: 'burst' },
  { type: 'custom', i18nKey: 'Custom', previewColor: '#33cc33', previewMotion: 'wave' },
];

/** 所有预设特效类型名称数组 */
export const PARTICLE_EFFECT_TYPES = PARTICLE_EFFECTS.map(e => e.type);

/** type → config 快速查找 */
export const PARTICLE_EFFECT_MAP = new Map(PARTICLE_EFFECTS.map(e => [e.type, e]));
