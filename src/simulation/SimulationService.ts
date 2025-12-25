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
        this.statusBarItem.text = '$(rocket) 编译仿真: 未运行';
        this.statusBarItem.command = 'honeygui.simulation';
        this.statusBarItem.show();

        // 创建 Clean 状态栏按钮
        this.cleanStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.cleanStatusBarItem.text = '$(trash) Clean';
        this.cleanStatusBarItem.command = 'honeygui.simulation.clean';
        this.cleanStatusBarItem.tooltip = '清理编译产物';
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
                    '选择清理方式',
                    { modal: true },
                    '普通清理',
                    '深度清理'
                );
                
                if (choice === '普通清理') {
                    await this.cleanSimulation(false);
                } else if (choice === '深度清理') {
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
                vscode.window.showErrorMessage('无法找到项目根目录（project.json）');
                return;
            }

            // 获取 SDK 路径
            let sdkPath = this.getSdkPath(projectRoot);
            if (!sdkPath) {
                sdkPath = await this.promptForSdkPath(projectRoot);
                if (!sdkPath) {
                    return;
                }
            }

            // 停止现有的仿真
            if (this.runner) {
                await this.stopSimulation();
            }

            // 创建新的运行器
            this.runner = new SimulationRunner(projectRoot, sdkPath, this.outputChannel);
            this.setupRunnerListeners();

            // 启动仿真
            this.updateStatusBar('$(sync~spin) 编译仿真: 启动中...');
            await this.runner.start();

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`编译仿真失败:\n${message}`);
            this.updateStatusBar('$(rocket) 编译仿真: 未运行');
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
            this.updateStatusBar('$(rocket) 编译仿真: 未运行');
            vscode.window.showInformationMessage('编译仿真已停止');
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
            vscode.window.showErrorMessage('未找到项目根目录（project.json）');
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
        vscode.window.showInformationMessage(deep ? '深度清理完成' : '清理完成');
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
            vscode.window.showErrorMessage('没有打开的工作区');
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
            placeHolder: '选择要编译的项目'
        });

        return selected ? ProjectUtils.findProjectRoot(selected.folder.uri.fsPath) : undefined;
    }

    /**
     * 获取 SDK 路径（仅从项目配置读取）
     */
    private getSdkPath(projectRoot: string): string | undefined {
        const projectConfig = ProjectUtils.loadProjectConfig(projectRoot);
        return projectConfig.honeyguiSdkPath;
    }

    /**
     * 提示用户选择 SDK 路径
     */
    private async promptForSdkPath(projectRoot: string): Promise<string | undefined> {
        const choice = await vscode.window.showErrorMessage(
            '未配置 HoneyGUI SDK 路径',
            '选择 SDK 目录',
            '取消'
        );

        if (choice !== '选择 SDK 目录') {
            return undefined;
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: '选择 HoneyGUI SDK 目录'
        });

        if (!uris || uris.length === 0) {
            return undefined;
        }

        const sdkPath = uris[0].fsPath;

        // 保存到 project.json
        const configPath = path.join(projectRoot, 'project.json');
        const config = ProjectUtils.loadProjectConfig(projectRoot);
        config.honeyguiSdkPath = sdkPath;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        vscode.window.showInformationMessage('SDK 路径已保存到项目配置');

        return sdkPath;
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
                this.updateStatusBar('$(sync~spin) 编译仿真: 启动中...');
                this.outputChannel.clear();
                this.outputChannel.show(true);
            },
            
            onSuccess: () => {
                this.updateStatusBar('$(rocket) 编译仿真: 运行中');
                vscode.window.showInformationMessage('编译仿真已成功启动');
            },
            
            onError: (error) => {
                this.updateStatusBar('$(error) 编译仿真: 错误');
                this.outputChannel.appendLine(`[错误] ${error.message}`);
            },
            
            onExit: (code) => {
                this.updateStatusBar('$(rocket) 编译仿真: 未运行');
                if (code !== null && code !== 0) {
                    vscode.window.showWarningMessage(`编译仿真异常退出，退出码: ${code}`);
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
        if (text.includes('运行中')) {
            this.statusBarItem.command = 'honeygui.simulation.stop';
            this.statusBarItem.tooltip = '点击停止仿真';
        } else {
            this.statusBarItem.command = 'honeygui.simulation';
            this.statusBarItem.tooltip = '点击启动编译仿真';
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
