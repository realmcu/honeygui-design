import * as path from 'path';
import { BaseTemplate } from './BaseTemplate';

export class ChatBotTemplate extends BaseTemplate {
    id = 'chatbot';
    name = 'ChatBot';
    description = 'AI chat interface with message bubbles';
    category = 'Communication';
    recommendedResolution = '480X320';
    
    protected getTemplateProjectPath(): string {
        return path.join(__dirname, '..', '..', '..', 'template-projects', 'chatbot');
    }
}
