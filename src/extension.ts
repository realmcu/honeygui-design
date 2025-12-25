import * as vscode from 'vscode';
import { logger } from './utils/Logger';
import { ExtensionManager } from './core/ExtensionManager';

/**
 * HoneyGUI Visual Designer扩展入口
 * 这是一个离线版本的VS Code插件，用于HoneyGUI嵌入式GUI框架的可视化设计
 */

let extensionManager: ExtensionManager | undefined;

/**
 * 扩展激活函数
 * VS Code会在扩展首次加载时调用此函数
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        logger.info('HoneyGUI Visual Designer 正在激活...');
        
        // 创建扩展管理器
        extensionManager = new ExtensionManager(context);
        
        // 初始化扩展
        await extensionManager.initialize();
        
        // 检查是否有待激活的新建项目
        const pendingActivation = context.globalState.get<{
            projectPath: string;
            projectName: string;
            timestamp: number;
        }>('pendingProjectActivation');
        
        if (pendingActivation) {
            // 清除标记
            await context.globalState.update('pendingProjectActivation', undefined);
            
            // 检查时间戳，避免处理过期的激活请求（5分钟内有效）
            if (Date.now() - pendingActivation.timestamp < 5 * 60 * 1000) {
                // 延迟打开主 HML 文件，等待 VSCode 完全加载
                setTimeout(async () => {
                    try {
                        const { ProjectUtils } = await import('./utils/ProjectUtils');
                        const projectConfig = ProjectUtils.loadProjectConfig(pendingActivation.projectPath);
                        if (projectConfig.mainHmlFile) {
                            const mainHmlPath = vscode.Uri.file(
                                require('path').join(pendingActivation.projectPath, projectConfig.mainHmlFile)
                            );
                            await vscode.commands.executeCommand('honeygui.openInDesigner', mainHmlPath);
                        }
                    } catch (err) {
                        logger.error(`打开主设计文件失败: ${err}`);
                    }
                }, 1000);
            }
        }
        
        logger.info('HoneyGUI Visual Designer 激活成功');
        
    } catch (error) {
        logger.error(`扩展激活失败: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(
            `HoneyGUI扩展激活失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
        throw error;
    }
}

/**
 * 扩展停用函数
 * VS Code会在扩展被停用时调用此函数
 */
export function deactivate(): void {
    logger.info('HoneyGUI Visual Designer 正在停用...');
    
    if (extensionManager) {
        extensionManager.dispose();
        extensionManager = undefined;
    }
    
    logger.info('HoneyGUI Visual Designer 已停用');
}