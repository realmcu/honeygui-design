/**
 * 字体度量分析器
 * 用于分析字体的 EM size 是否规范，并计算实际渲染缩放比例
 */

import * as opentype from 'opentype.js';
import * as path from 'path';

/**
 * 字体度量信息
 */
export interface FontMetrics {
    /** 字体文件路径 */
    fontPath: string;
    /** 字体名称 */
    fontName: string;
    /** unitsPerEm */
    unitsPerEm: number;
    /** ascender */
    ascender: number;
    /** descender */
    descender: number;
    /** 实际字符高度 */
    actualHeight: number;
    /** 实际高度占 EM 的比例 (%) */
    heightRatio: number;
    /** 缩放系数 (unitsPerEm / actualHeight) */
    scaleFactor: number;
    /** 是否需要提示 */
    needsWarning: boolean;
    /** 建议的字号倍数 */
    suggestedMultiplier: number;
}

/**
 * 字体度量分析器
 */
export class FontMetricsAnalyzer {
    /** 字体度量缓存 */
    private static metricsCache = new Map<string, FontMetrics>();

    /**
     * 分析字体度量信息
     * 
     * @param fontPath 字体文件的绝对路径
     * @returns 字体度量信息
     */
    public static async analyzeFontMetrics(fontPath: string): Promise<FontMetrics | null> {
        // 检查缓存
        if (this.metricsCache.has(fontPath)) {
            return this.metricsCache.get(fontPath)!;
        }

        try {
            // 加载字体
            const font = await opentype.load(fontPath);
            
            // 提取度量信息
            const unitsPerEm = font.unitsPerEm;
            const ascender = font.ascender;
            const descender = font.descender;
            const actualHeight = ascender - descender;
            
            // 计算比例
            const heightRatio = (actualHeight / unitsPerEm) * 100;
            const scaleFactor = unitsPerEm / actualHeight;
            
            // 判断是否需要警告
            // 如果 scaleFactor < 0.9，说明字体会被缩小超过 10%
            // 如果 scaleFactor > 1.1，说明字体会被放大超过 10%
            const needsWarning = scaleFactor < 0.9 || scaleFactor > 1.1;
            
            // 计算建议的字号倍数
            // 如果需要警告，建议使用 1/scaleFactor 倍的字号
            const suggestedMultiplier = needsWarning ? Math.round((1 / scaleFactor) * 10) / 10 : 1.0;
            
            const metrics: FontMetrics = {
                fontPath,
                fontName: font.names.fullName?.en || font.names.fontFamily?.en || path.basename(fontPath),
                unitsPerEm,
                ascender,
                descender,
                actualHeight,
                heightRatio: Math.round(heightRatio * 100) / 100,
                scaleFactor: Math.round(scaleFactor * 10000) / 10000,
                needsWarning,
                suggestedMultiplier
            };
            
            // 缓存结果
            this.metricsCache.set(fontPath, metrics);
            
            return metrics;
        } catch (error) {
            console.error(`分析字体度量失败: ${fontPath}`, error);
            return null;
        }
    }

    /**
     * 清除缓存
     */
    public static clearCache(): void {
        this.metricsCache.clear();
    }

    /**
     * 获取字体的缩放提示信息
     * 
     * @param metrics 字体度量信息
     * @returns 提示信息对象
     */
    public static getWarningInfo(metrics: FontMetrics): {
        needsWarning: boolean;
        message: string;
        example: string;
    } {
        if (!metrics.needsWarning) {
            return {
                needsWarning: false,
                message: '',
                example: ''
            };
        }

        if (metrics.scaleFactor < 0.9) {
            // EM size 过大，字体会被缩小
            const shrinkPercent = Math.round((1 - metrics.scaleFactor) * 100);
            
            return {
                needsWarning: true,
                message: `该字体的 EM size 较大，精确预览相比设计预览小约 ${shrinkPercent}%。建议将字号设置为目标大小的 ${metrics.suggestedMultiplier} 倍。`,
                example: `例如：想要 16px 效果，请设置为 ${Math.round(16 * metrics.suggestedMultiplier)}px`
            };
        } else {
            // EM size 过小，字体会被放大
            const enlargePercent = Math.round((metrics.scaleFactor - 1) * 100);
            
            return {
                needsWarning: true,
                message: `该字体的 EM size 较小，精确预览相比设计预览大约 ${enlargePercent}%。建议将字号设置为目标大小的 ${metrics.suggestedMultiplier} 倍。`,
                example: `例如：想要 16px 效果，请设置为 ${Math.round(16 * metrics.suggestedMultiplier)}px`
            };
        }
    }
}
