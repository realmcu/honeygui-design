/**
 * 仪表盘模板
 */

import * as path from 'path';
import { BaseTemplate } from './BaseTemplate';

export class DashboardTemplate extends BaseTemplate {
    id = 'dashboard';
    name = 'Dashboard';
    description = 'Data visualization with progress bars and status cards';
    category = 'Data Display';
    recommendedResolution = '800X480';
    
    protected getTemplateProjectPath(): string {
        return path.join(__dirname, '..', '..', '..', '..', 'template-projects', 'dashboard');
    }
}
