import * as vscode from 'vscode';
import { logger } from './utils/Logger';
import { ExtensionManager } from './core/ExtensionManager';

/**
 * HoneyGUI Visual Designer Extension Entry
 * Offline VSCode extension for HoneyGUI embedded GUI framework visual design
 */

let extensionManager: ExtensionManager | undefined;

/**
 * Extension activation function
 * Called by VSCode when the extension is first loaded
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        logger.info(vscode.l10n.t('Extension activating'));
        
        // Create extension manager
        extensionManager = new ExtensionManager(context);
        
        // Initialize extension
        await extensionManager.initialize();
        
        // Check for pending new project activation
        const pendingActivation = context.globalState.get<{
            projectPath: string;
            projectName: string;
            timestamp: number;
        }>('pendingProjectActivation');
        
        if (pendingActivation) {
            // Clear the flag
            await context.globalState.update('pendingProjectActivation', undefined);
            
            // Check timestamp to avoid processing expired activation requests (valid within 5 minutes)
            if (Date.now() - pendingActivation.timestamp < 5 * 60 * 1000) {
                // Delay opening main HML file, wait for VSCode to fully load
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
                        logger.error(vscode.l10n.t('Failed to open main design file: {0}', String(err)));
                    }
                }, 1000);
            }
        }

        // Check for pending join session
        const pendingJoinSession = context.globalState.get<{
            workspacePath: string;
            address: string;
            timestamp: number;
        }>('pendingJoinSession');

        if (pendingJoinSession) {
            // Clear the flag
            await context.globalState.update('pendingJoinSession', undefined);

            // Check timestamp (valid within 5 minutes)
            if (Date.now() - pendingJoinSession.timestamp < 5 * 60 * 1000) {
                setTimeout(async () => {
                    try {
                        const workspacePath = pendingJoinSession.workspacePath;
                        const address = pendingJoinSession.address;
                        const fs = require('fs');
                        const path = require('path');
                        const { DesignerPanelFactory } = await import('./designer/DesignerPanelFactory');
                        const { CollaborationService } = await import('./core/CollaborationService');
                        const { StatusBarManager } = await import('./ui/StatusBarManager');

                        // 预先创建 project.json
                        const projectJsonPath = path.join(workspacePath, 'project.json');
                        if (!fs.existsSync(projectJsonPath)) {
                            fs.writeFileSync(projectJsonPath, JSON.stringify({
                                name: "Guest Project",
                                version: "1.0.0",
                                assetsDir: "assets"
                            }, null, 2));
                        }

                        // 打开设计器面板
                        const guestHmlPath = path.join(workspacePath, 'guest.hml');
                        const panel = DesignerPanelFactory.createOrShow(context, guestHmlPath);
                        
                        // 设置工作区路径
                        panel.setGuestWorkspacePath(workspacePath);

                        // 加入会话
                        const service = CollaborationService.getInstance();
                        await service.joinSession(address);
                        
                        vscode.window.showInformationMessage(vscode.l10n.t('Successfully joined collaboration: {0}', address));
                        
                        // 更新状态栏
                        // 注意：这里需要获取 StatusBarManager 实例，或者重新创建一个
                        // 由于 CommandManager 中初始化了 StatusBarManager，我们可以尝试通过命令或其他方式
                        // 但最简单的是直接在这里更新（如果能访问实例）
                        // 由于 extensionManager 已经在 activate 开头创建，我们可以假设它已经初始化了 CommandManager
                        // 但我们无法直接访问 CommandManager 实例。
                        // 变通方法：我们可以重新实例化一个 StatusBarManager 或者忽略状态栏更新（因为它主要在 CommandManager 中）
                        // 或者更好的方法是：复用 CommandManager 中的 joinSession 逻辑，但这需要重构
                        
                        // 简单起见，这里只做核心连接逻辑
                    } catch (err) {
                        logger.error(vscode.l10n.t('Failed to resume join session: {0}', String(err)));
                        vscode.window.showErrorMessage(vscode.l10n.t('Failed to resume join session: {0}', String(err)));
                    }
                }, 1000);
            }
        }
        
        logger.info(vscode.l10n.t('Extension activated'));
        
    } catch (error) {
        logger.error(vscode.l10n.t('Activation failed: {0}', error instanceof Error ? error.message : String(error)));
        vscode.window.showErrorMessage(
            vscode.l10n.t('Activation failed: {0}', error instanceof Error ? error.message : vscode.l10n.t('Unknown error'))
        );
        throw error;
    }
}

/**
 * Extension deactivation function
 * Called by VSCode when the extension is deactivated
 */
export function deactivate(): void {
    logger.info(vscode.l10n.t('Extension deactivating'));
    
    if (extensionManager) {
        extensionManager.dispose();
        extensionManager = undefined;
    }
    
    logger.info(vscode.l10n.t('Extension deactivated'));
}
