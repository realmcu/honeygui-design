import * as vscode from 'vscode';
import { EnvironmentChecker, EnvironmentCheckResult } from '../simulation/EnvironmentChecker';

// 安装指引
const INSTALL_GUIDES: Record<string, { windows: string; linux: string; url?: string }> = {
    python: {
        windows: '下载安装: https://www.python.org/downloads/',
        linux: 'sudo apt-get install python3',
        url: 'https://www.python.org/downloads/'
    },
    scons: {
        windows: 'pip install scons',
        linux: 'pip install scons'
    },
    gcc: {
        windows: '下载 MinGW: https://www.mingw-w64.org/',
        linux: 'sudo apt-get install build-essential',
        url: 'https://www.mingw-w64.org/'
    },
    sdl2: {
        windows: '下载 SDL2: https://www.libsdl.org/',
        linux: 'sudo apt-get install libsdl2-dev',
        url: 'https://www.libsdl.org/'
    },
    ffmpeg: {
        windows: '下载: https://ffmpeg.org/download.html',
        linux: 'sudo apt-get install ffmpeg',
        url: 'https://ffmpeg.org/download.html'
    }
};

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
                new EnvironmentItem('检查中...', 'loading', false)
            ]);
        }

        const items: EnvironmentItem[] = [
            new EnvironmentItem(
                'Python',
                this.checkResult.pythonInstalled ? 'pass' : 'error',
                this.checkResult.pythonInstalled,
                this.checkResult.pythonVersion,
                'python'
            ),
            new EnvironmentItem(
                'SCons',
                this.checkResult.sconsInstalled ? 'pass' : 'error',
                this.checkResult.sconsInstalled,
                this.checkResult.sconsVersion,
                'scons'
            ),
            new EnvironmentItem(
                'GCC',
                this.checkResult.compilerInstalled ? 'pass' : 'error',
                this.checkResult.compilerInstalled,
                this.checkResult.compilerVersion,
                'gcc'
            )
        ];

        // 仅在 Linux/WSL 下显示 SDL
        if (this.checkResult.sdlInstalled !== undefined) {
            items.push(new EnvironmentItem(
                'SDL2',
                this.checkResult.sdlInstalled ? 'pass' : 'error',
                this.checkResult.sdlInstalled,
                this.checkResult.sdlVersion,
                'sdl2'
            ));
        }

        items.push(new EnvironmentItem(
            'FFmpeg',
            this.checkResult.ffmpegInstalled ? 'pass' : 'warning',
            this.checkResult.ffmpegInstalled,
            this.checkResult.ffmpegVersion,
            'ffmpeg'
        ));

        return Promise.resolve(items);
    }

    /**
     * 显示安装指引
     */
    static showInstallGuide(toolId: string): void {
        const guide = INSTALL_GUIDES[toolId];
        if (!guide) return;

        const isWindows = process.platform === 'win32';
        const instruction = isWindows ? guide.windows : guide.linux;

        const actions: string[] = ['复制命令'];
        if (guide.url) {
            actions.push('打开下载页面');
        }

        vscode.window.showInformationMessage(
            `安装 ${toolId.toUpperCase()}: ${instruction}`,
            ...actions
        ).then(selection => {
            if (selection === '复制命令') {
                vscode.env.clipboard.writeText(instruction);
                vscode.window.showInformationMessage('已复制到剪贴板');
            } else if (selection === '打开下载页面' && guide.url) {
                vscode.env.openExternal(vscode.Uri.parse(guide.url));
            }
        });
    }
}

class EnvironmentItem extends vscode.TreeItem {
    constructor(
        name: string,
        private status: 'pass' | 'error' | 'warning' | 'loading',
        installed: boolean,
        version?: string,
        public readonly toolId?: string
    ) {
        super(
            `${name}: ${status === 'loading' ? '检查中...' : (installed ? '✓ 已安装' : '✗ 未安装')}`,
            vscode.TreeItemCollapsibleState.None
        );

        if (version) {
            this.description = version;
        }

        // 未安装时添加点击命令
        if (!installed && toolId) {
            this.command = {
                command: 'honeygui.environment.showGuide',
                title: '显示安装指引',
                arguments: [toolId]
            };
            this.tooltip = '点击查看安装方法';
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
