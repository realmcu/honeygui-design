/**
 * LVGL 代码生成工具函数
 */
import * as path from 'path';

/**
 * 解析颜色字符串的 RGB 十六进制部分（不含 #）
 */
export function parseColorHex(color: string): string {
  const hex = color.replace(/^#/, '').toUpperCase();
  if (hex.length === 3) {
    return hex.split('').map(c => c + c).join('');
  }
  if (hex.length === 4) {
    return hex.slice(0, 3).split('').map(c => c + c).join('');
  }
  if (hex.length === 8) {
    return hex.slice(0, 6);
  }
  return hex.padStart(6, '0');
}

/**
 * 从颜色字符串中解析 alpha 值（0-255）
 * 支持格式：#RGB, #RGBA, #RRGGBB, #RRGGBBAA
 */
export function parseColorAlpha(color: string): number {
  const hex = color.replace(/^#/, '').toUpperCase();
  if (hex.length === 4) {
    const a = hex[3];
    return parseInt(a + a, 16);
  }
  if (hex.length === 8) {
    return parseInt(hex.slice(6, 8), 16);
  }
  return 255;
}

/**
 * 规范化十六进制颜色值
 */
export function normalizeHexColor(value: string, fallback: string): string {
  const raw = (value || '').trim();
  if (!raw.startsWith('#')) {
    return fallback;
  }
  const hex = raw.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.toUpperCase();
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
  }
  return fallback;
}


/**
 * 转义 C 字符串中的特殊字符
 */
export function escapeCString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * 根据字体大小选择最接近的 LVGL 内置字体
 */
export function getLvglFontBySize(fontSize: number): string {
  const sizes = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48];
  let closest = 14;
  let minDiff = Infinity;
  for (const size of sizes) {
    const diff = Math.abs(size - fontSize);
    if (diff < minDiff) {
      minDiff = diff;
      closest = size;
    }
  }
  return `lv_font_montserrat_${closest}`;
}

/**
 * 规范化 LVGL 图片源路径（添加 A: 虚拟驱动器前缀）
 */
export function normalizeLvglImageSource(source: string): string {
  const normalized = source.replace(/\\/g, '/').trim();
  if (!normalized) {
    return normalized;
  }
  if (/^[A-Z]:/i.test(normalized)) {
    return normalized;
  }
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  if (withoutLeadingSlash.startsWith('assets/')) {
    return `A:${withoutLeadingSlash}`;
  }
  return `A:assets/${withoutLeadingSlash}`;
}

/**
 * 规范化视频/Lottie 源路径（OS 原生路径，不走 LVGL 文件系统）
 */
export function normalizeVideoSource(source: string): string {
  const normalized = source.replace(/\\/g, '/').trim();
  if (!normalized) {
    return normalized;
  }
  if (/^[A-Z]:/i.test(normalized) && normalized.length > 2 && normalized[2] === '/') {
    return normalized;
  }
  const withoutDriveLetter = normalized.replace(/^[A-Z]:/i, '');
  const withoutLeadingSlash = withoutDriveLetter.replace(/^\/+/, '');
  if (withoutLeadingSlash.startsWith('assets/')) {
    return withoutLeadingSlash;
  }
  return `assets/${withoutLeadingSlash}`;
}

/**
 * 安全转换为有限数字
 */
export function toFiniteNumber(value: any, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * 解析渐变色停靠点
 */
export function resolveGradientStops(rawStops: any, fallbackHex: string): Array<{ colorHex: string; frac: number }> {
  if (!Array.isArray(rawStops)) {
    return [
      { colorHex: fallbackHex, frac: 0 },
      { colorHex: fallbackHex, frac: 255 },
    ];
  }

  const parsed = rawStops
    .map((item) => {
      const position = toFiniteNumber(item?.position, 0);
      const colorHex = normalizeHexColor(String(item?.color || `#${fallbackHex}`), fallbackHex);
      const frac = Math.max(0, Math.min(255, Math.round(position * 255)));
      return { colorHex, frac };
    })
    .sort((a, b) => a.frac - b.frac);

  if (parsed.length < 2) {
    return [
      { colorHex: fallbackHex, frac: 0 },
      { colorHex: fallbackHex, frac: 255 },
    ];
  }

  const limited = parsed.slice(0, 8);
  limited[0] = { ...limited[0], frac: 0 };
  limited[limited.length - 1] = { ...limited[limited.length - 1], frac: 255 };
  return limited;
}

/**
 * 根据背景色计算高对比度的文字颜色（黑或白）
 */
export function getContrastTextColor(bgColor: string): string {
  const hex = parseColorHex(bgColor);
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 128 ? '000000' : 'FFFFFF';
}

/**
 * 规范化图片源路径用于查找 Map
 */
export function normalizeImageKey(source: string): string {
  return source
    .replace(/\\/g, '/')
    .replace(/^A:/i, '')
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
}

/**
 * 规范化字体 key（fontFile + fontSize 组合）
 */
export function normalizeFontKey(fontFile: string, fontSize: number): string {
  const normalized = fontFile.replace(/\\/g, '/').toLowerCase().trim();
  return `${normalized}@${fontSize}`;
}

/**
 * 构建图片变量名
 */
export function buildImageVarName(source: string): string {
  let normalized = source.replace(/\\/g, '/').trim();
  normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');
  if (normalized.startsWith('assets/')) {
    normalized = normalized.substring('assets/'.length);
  }
  const base = normalized.replace(/\.[^.]+$/, '').replace(/[\/]+/g, '_');
  let varName = 'img_' + base.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  if (/^[0-9]/.test(varName)) {
    varName = 'img_' + varName;
  }
  return varName;
}

/**
 * 构建字体变量名
 */
export function buildFontVarName(fontFile: string, fontSize: number): string {
  const baseName = path.basename(fontFile, path.extname(fontFile))
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return `font_${baseName}_${fontSize}`;
}
