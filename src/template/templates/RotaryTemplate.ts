import * as path from 'path';
import { BaseTemplate } from './BaseTemplate';

export class RotaryTemplate extends BaseTemplate {
    id = 'rotary';
    name = 'Rotary Screen';
    description = 'Circular UI for rotary knob devices';
    category = 'Wearable';
    recommendedResolution = '480X480';
    
    protected getTemplateProjectPath(): string {
        return path.join(__dirname, '..', '..', '..', '..', 'template-projects', 'rotary');
    }
}
