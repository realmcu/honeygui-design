/**
 * 智能手表模板
 */

import * as path from 'path';
import { BaseTemplate } from '../../BaseTemplate';

export class SmartWatchTemplate extends BaseTemplate {
    id = 'smartwatch';
    name = 'Smart Watch UI';
    description = 'Watch face with time display and status icons';
    category = 'Wearable';
    recommendedResolution = '410X502';
    
    protected getTemplateProjectPath(): string {
        // 指向项目根目录的 template-projects/smartwatch
        return path.join(__dirname, '..', '..', '..', '..', '..', 'template-projects', 'smartwatch');
    }
}
