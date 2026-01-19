import * as vscode from 'vscode';

export class StatusBarManager {
    private static instance: StatusBarManager | null = null;

    private constructor(context: vscode.ExtensionContext) {
        // 协同状态不再显示在状态栏
        context.subscriptions.push();
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
        // 状态栏已移除，不再更新
    }
}
