import * as vscode from 'vscode';
import { DesignerPanel } from './DesignerPanel';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * Factory class for creating and managing DesignerPanel instances.
 */
export class DesignerPanelFactory {
    /**
     * Creates or shows the DesignerPanel.
     * @param context The extension context.
     * @param filePath The path to the HML file to load (optional).
     * @returns The DesignerPanel instance.
     */
    public static createOrShow(context: vscode.ExtensionContext, filePath?: string): DesignerPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If a panel already exists, show it
        if (DesignerPanel.currentPanel) {
            DesignerPanel.currentPanel.reveal(column);

            // If a file path is provided, load it
            if (filePath) {
                DesignerPanel.currentPanel.loadFile(filePath);
            }

            return DesignerPanel.currentPanel;
        }

        // Create a new panel
        // Calculate local resource roots to allow webview to access extension resources and project assets
        const localRoots: vscode.Uri[] = [
            vscode.Uri.joinPath(context.extensionUri, 'src', 'designer', 'webview'),
            vscode.Uri.joinPath(context.extensionUri, 'out', 'designer', 'webview')
        ];
        
        logger.info(`[DesignerPanelFactory] Creating panel, filePath: ${filePath}`);
        
        // Infer project root: find the directory containing project.json from the HML file path
        let projectRoot: string | undefined;
        if (filePath) {
            projectRoot = ProjectUtils.findProjectRoot(filePath);
            if (projectRoot) {
                logger.info(`[DesignerPanelFactory] Found project root: ${projectRoot}`);
                localRoots.push(vscode.Uri.file(projectRoot));
            } else {
                logger.warn(`[DesignerPanelFactory] Could not find project root from file path: ${filePath}`);
            }
        }
        
        // If project.json is not found, try to use workspace
        if (!projectRoot) {
            projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (projectRoot) {
                logger.info(`[DesignerPanelFactory] Using workspace as project root: ${projectRoot}`);
                localRoots.push(vscode.Uri.file(projectRoot));
            } else {
                logger.warn(`[DesignerPanelFactory] Workspace not found`);
            }
        }
        
        logger.info(`[DesignerPanelFactory] localResourceRoots: ${localRoots.map(r => r.fsPath).join(', ')}`);

        const panel = vscode.window.createWebviewPanel(
            DesignerPanel.viewType,
            'HoneyGUI 设计器',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: localRoots
            }
        );

        const designerPanel = new DesignerPanel(panel, context);
        DesignerPanel.currentPanel = designerPanel;

        // If a file path is provided, load it; otherwise, create a new document
        if (filePath) {
            designerPanel.loadFile(filePath);
        } else {
            designerPanel.createNewDocument();
        }

        return designerPanel;
    }
}
