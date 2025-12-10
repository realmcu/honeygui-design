/**
 * 设置菜单模板
 */

import * as path from 'path';
import { BaseTemplate } from './BaseTemplate';

export class SettingsTemplate extends BaseTemplate {
    id = 'settings';
    name = 'Settings Menu';
    description = 'Multi-level settings menu with switches and options';
    category = 'Navigation';
    recommendedResolution = '480X272';
    
    protected getTemplateProjectPath(): string {
        return path.join(__dirname, '..', '..', '..', 'template-projects', 'settings');
    }
}
