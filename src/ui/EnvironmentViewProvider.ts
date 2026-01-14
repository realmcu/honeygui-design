import * as vscode from 'vscode';
import { EnvironmentChecker, EnvironmentCheckResult } from '../simulation/EnvironmentChecker';

/**
 * 环境检查视图提供者
 */
export class EnvironmentViewProvider implements vscode.TreeDataProvider<EnvironmentItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<EnvironmentItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private checkResult: EnvironmentCheckResult | null = null;
    private checker = new EnvironmentChecker();

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.checker.checkAll().then(result => {
            this.checkResult = result;
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element: EnvironmentItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EnvironmentItem): Thenable<EnvironmentItem[]> {
        if (!this.checkResult) {
            return Promise.resolve([
                new EnvironmentItem('检查中...', vscode.TreeItemCollapsibleState.None, 'loading')
            ]);
        }

        const items: EnvironmentItem[] = [
            new EnvironmentItem(
                `Python: ${this.checkResult.pythonInstalled ? '✓ 已安装' : '✗ 未安装'}`,
                vscode.TreeItemCollapsibleState.None,
                this.checkResult.pythonInstalled ? 'pass' : 'error',
                this.checkResult.pythonVersion
            ),
            new EnvironmentItem(
                `SCons: ${this.checkResult.sconsInstalled ? '✓ 已安装' : '✗ 未安装'}`,
                vscode.TreeItemCollapsibleState.None,
                this.checkResult.sconsInstalled ? 'pass' : 'error',
                this.checkResult.sconsVersion
            ),
            new EnvironmentItem(
                `GCC: ${this.checkResult.compilerInstalled ? '✓ 已安装' : '✗ 未安装'}`,
                vscode.TreeItemCollapsibleState.None,
                this.checkResult.compilerInstalled ? 'pass' : 'error',
                this.checkResult.compilerVersion
            )
        ];

        // 仅在 Linux/WSL 下显示 SDL
        if (this.checkResult.sdlInstalled !== undefined) {
            items.push(new EnvironmentItem(
                `SDL2: ${this.checkResult.sdlInstalled ? '✓ 已安装' : '✗ 未安装'}`,
                vscode.TreeItemCollapsibleState.None,
                this.checkResult.sdlInstalled ? 'pass' : 'error',
                this.checkResult.sdlVersion
            ));
        }

        items.push(new EnvironmentItem(
            `FFmpeg: ${this.checkResult.ffmpegInstalled ? '✓ 已安装' : '✗ 未安装'}`,
            vscode.TreeItemCollapsibleState.None,
            this.checkResult.ffmpegInstalled ? 'pass' : 'warning',
            this.checkResult.ffmpegVersion
        ));

        return Promise.resolve(items);
    }
}

class EnvironmentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private status: 'pass' | 'error' | 'warning' | 'loading',
        version?: string
    ) {
        super(label, collapsibleState);

        if (version) {
            this.description = version;
        }

        switch (status) {
            case 'pass':
                this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
                break;
            case 'loading':
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                break;
        }
    }
}
