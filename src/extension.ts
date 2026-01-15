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
