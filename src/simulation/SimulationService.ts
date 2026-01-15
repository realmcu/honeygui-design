import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SimulationRunner } from './SimulationRunner';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * 编译仿真服务
 * 管理编译仿真的命令注册、状态管理和用户交互
 */
export class SimulationService {
    private context: vscode.ExtensionContext;
    private runner: SimulationRunner | null = null;
    private statusBarItem: vscode.StatusBarItem;
    private cleanStatusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // 创建状态栏
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBarItem.text = `$(rocket) ${vscode.l10n.t('Compile & Simulate: Not Running')}`;
        this.statusBarItem.command = 'honeygui.simulation';
        this.statusBarItem.show();

        // 创建 Clean 状态栏按钮
        this.cleanStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.cleanStatusBarItem.text = '$(trash) Clean';
        this.cleanStatusBarItem.command = 'honeygui.simulation.clean';
        this.cleanStatusBarItem.tooltip = vscode.l10n.t('Clean build artifacts');
        this.cleanStatusBarItem.show();

        // 创建输出通道
        this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Simulation');
    }

    /**
     * 注册命令
     */
    registerCommands(): void {
        // 启动编译仿真
        this.context.subscriptions.push(
            vscode.commands.registerCommand('honeygui.simulation', async () => {
                await this.startSimulation();
            })
        );

        // 停止编译仿真
        this.context.subscriptions.push(
            vscode.commands.registerCommand('honeygui.simulation.stop', async () => {
                await this.stopSimulation();
            })
        );

        // 清理编译产物
        this.context.subscriptions.push(
            vscode.commands.registerCommand('honeygui.simulation.clean', async () => {
                const choice = await vscode.window.showInformationMessage(
                    vscode.l10n.t('Select cleanup method'),
                    { modal: true },
                    vscode.l10n.t('Normal Clean'),
                    vscode.l10n.t('Deep Clean')
                );
                
                if (choice === vscode.l10n.t('Normal Clean')) {
                    await this.cleanSimulation(false);
                } else if (choice === vscode.l10n.t('Deep Clean')) {
                    await this.cleanSimulation(true);
                }
            })
        );
    }

    /**
     * 启动编译仿真
     */
    async startSimulation(): Promise<void> {
        try {
            // 获取项目根目录
            const projectRoot = await this.getProjectRoot();
            if (!projectRoot) {
                vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
                return;
            }

            // 获取插件内置的 lib/sim 路径
            const extensionPath = this.context.extensionPath;
            const libSimPath = path.join(extensionPath, 'lib', 'sim');

            // 停止现有的仿真
            if (this.runner) {
                await this.stopSimulation();
            }

            // 创建新的运行器（使用内置库路径）
            this.runner = new SimulationRunner(projectRoot, libSimPath, this.outputChannel);
            this.setupRunnerListeners();

            // 启动仿真
            this.updateStatusBar('$(sync~spin) Simulation: Starting...');
            await this.runner.start();

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(vscode.l10n.t('Compilation failed: {0}', message));
            this.updateStatusBar('$(rocket) Simulation: Not Running');
        }
    }

    /**
     * 停止编译仿真
     */
    async stopSimulation(): Promise<void> {
        if (this.runner) {
            await this.runner.stop();
            this.runner.dispose();
            this.runner = null;
            this.updateStatusBar('$(rocket) Simulation: Not Running');
            vscode.window.showInformationMessage(vscode.l10n.t('Simulation stopped'));
        }
    }

    /**
     * 清理编译产物
     * @param deep 是否深度清理
     */
    async cleanSimulation(deep: boolean = false): Promise<void> {
        // 查找项目根目录
        let projectRoot: string | undefined;

        // 优先使用当前打开的 HML 文件所在项目
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.hml')) {
            projectRoot = ProjectUtils.findProjectRoot(activeEditor.document.fileName);
        }

        // 如果没有，尝试从工作区查找
        if (!projectRoot) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                projectRoot = ProjectUtils.findProjectRoot(workspaceFolders[0].uri.fsPath);
            }
        }

        if (!projectRoot) {
            vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
            return;
        }

        this.outputChannel.show(true);
        const runner = new SimulationRunner(projectRoot, '', this.outputChannel);
        runner.setListener({
            onLog: (message: string) => {
                this.outputChannel.appendLine(message);
            }
        });
        await runner.clean(deep);
        vscode.window.showInformationMessage(deep ? vscode.l10n.t('Deep clean completed') : vscode.l10n.t('Clean completed'));
    }

    /**
     * 获取项目根目录
     */
    private async getProjectRoot(): Promise<string | undefined> {
        // 1. 优先使用当前编辑器所在项目
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const projectRoot = ProjectUtils.findProjectRoot(activeEditor.document.fileName);
            if (projectRoot) {
                return projectRoot;
            }
        }

        // 2. 尝试从工作区查找
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(vscode.l10n.t('No workspace opened'));
            return undefined;
        }

        // 单个工作区，直接使用
        if (workspaceFolders.length === 1) {
            return ProjectUtils.findProjectRoot(workspaceFolders[0].uri.fsPath);
        }

        // 多个工作区，让用户选择
        const items = workspaceFolders.map(folder => ({
            label: folder.name,
            description: folder.uri.fsPath,
            folder
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t('Select project to compile')
        });

        return selected ? ProjectUtils.findProjectRoot(selected.folder.uri.fsPath) : undefined;
    }

    /**
     * 设置运行器监听器
     */
    private setupRunnerListeners(): void {
        if (!this.runner) {
            return;
        }

        this.runner.setListener({
            onStart: () => {
                this.updateStatusBar('$(sync~spin) Simulation: Starting...');
                this.outputChannel.clear();
                this.outputChannel.show(true);
            },
            
            onSuccess: () => {
                this.updateStatusBar('$(rocket) Simulation: Running');
                vscode.window.showInformationMessage(vscode.l10n.t('Simulation started successfully'));
            },
            
            onError: (error) => {
                this.updateStatusBar('$(error) Simulation: Error');
                this.outputChannel.appendLine(`[Error] ${error.message}`);
            },
            
            onExit: (code) => {
                this.updateStatusBar('$(rocket) Simulation: Not Running');
                if (code !== null && code !== 0) {
                    vscode.window.showWarningMessage(vscode.l10n.t('Simulation exited abnormally, exit code: {0}', code));
                }
            },
            
            onLog: (message) => {
                this.outputChannel.appendLine(message);
            }
        });
    }

    /**
     * 更新状态栏
     */
    private updateStatusBar(text: string): void {
        this.statusBarItem.text = text;
        
        // 根据状态切换命令
        if (text.includes('Running')) {
            this.statusBarItem.command = 'honeygui.simulation.stop';
            this.statusBarItem.tooltip = vscode.l10n.t('Click to stop simulation');
        } else {
            this.statusBarItem.command = 'honeygui.simulation';
            this.statusBarItem.tooltip = vscode.l10n.t('Click to start simulation');
        }
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.stopSimulation();
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
    }
}
