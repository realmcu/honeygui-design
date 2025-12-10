/**
 * 模板注册中心
 */

import { ITemplate, TemplateInfo } from './ITemplate';
import { SmartWatchTemplate } from './wearable/smartwatch/SmartWatchTemplate';
import { SettingsTemplate } from './utility/settings/SettingsTemplate';
import { DashboardTemplate } from './utility/dashboard/DashboardTemplate';

/**
 * 所有可用模板
 */
export const TEMPLATE_REGISTRY: ITemplate[] = [
    new SmartWatchTemplate(),
    new SettingsTemplate(),
    new DashboardTemplate(),
];

/**
 * 根据 ID 获取模板
 */
export function getTemplateById(id: string): ITemplate | undefined {
    return TEMPLATE_REGISTRY.find(t => t.id === id);
}

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(category: string): ITemplate[] {
    return TEMPLATE_REGISTRY.filter(t => t.category === category);
}

/**
 * 获取所有模板信息（用于列表显示）
 */
export function getAllTemplateInfo(): TemplateInfo[] {
    return TEMPLATE_REGISTRY.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        recommendedResolution: t.recommendedResolution,
        category: t.category,
        previewImage: t.getPreviewImage() || undefined
    }));
}

/**
 * 获取所有分类
 */
export function getAllCategories(): string[] {
    const categories = new Set(TEMPLATE_REGISTRY.map(t => t.category));
    return Array.from(categories);
}
