/**
 * 模板配置
 */
export interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    repo: string;
    size?: string;
}

/**
 * 可用模板列表
 */
export const AVAILABLE_TEMPLATES: TemplateInfo[] = [
    {
        id: 'smartwatch',
        name: 'Smart Watch',
        description: '智能手表界面，包含完整资源（字体、图片、3D模型、视频）',
        repo: 'https://gitee.com/realmcu/honeygui-template-smartwatch.git',
        size: '19 MB'
    },
    {
        id: 'dashboard',
        name: 'Car Dashboard',
        description: '汽车仪表盘界面，包含仪表盘UI资源',
        repo: 'https://gitee.com/realmcu/honeygui-template-dashboard.git',
        size: '2 MB'
    },
    {
        id: 'chatbot',
        name: 'Chat Bot',
        description: '聊天机器人界面（轻量级）',
        repo: 'https://gitee.com/realmcu/honeygui-template-chatbot.git',
        size: '< 100 KB'
    },
    {
        id: 'rotary',
        name: 'Rotary Knob',
        description: '旋钮控制界面（轻量级）',
        repo: 'https://gitee.com/realmcu/honeygui-template-rotary.git',
        size: '< 100 KB'
    },
    {
        id: 'settings',
        name: 'Settings',
        description: '设置界面（轻量级）',
        repo: 'https://gitee.com/realmcu/honeygui-template-settings.git',
        size: '< 100 KB'
    }
];

/**
 * 模板缓存目录
 */
export const TEMPLATE_CACHE_DIR = '.honeygui/templates';
