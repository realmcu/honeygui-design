import * as vscode from 'vscode';

export class StatusBarManager {
    private static instance: StatusBarManager | null = null;
    private statusBarItem: vscode.StatusBarItem;

    private constructor(context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'honeygui.collaboration.stop';
        context.subscriptions.push(this.statusBarItem);
    }

    public static getInstance(context?: vscode.ExtensionContext): StatusBarManager {
        if (!StatusBarManager.instance) {
            if (!context) {
                throw new Error('StatusBarManager requires context on first initialization');
            }
            StatusBarManager.instance = new StatusBarManager(context);
        }
        return StatusBarManager.instance;
    }

    public updateCollaborationStatus(role: 'Host' | 'Guest' | 'None', info?: string) {
        if (role === 'None') {
            this.statusBarItem.hide();
            return;
        }

        const icon = role === 'Host' ? '$(broadcast)' : '$(plug)';
        this.statusBarItem.text = `${icon} HoneyGUI: ${role} (${info || 'Connected'})`;
        this.statusBarItem.tooltip = 'Click to stop collaboration session';
        this.statusBarItem.show();
    }
}
