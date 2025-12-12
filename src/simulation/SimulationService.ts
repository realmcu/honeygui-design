import * as vscode from 'vscode';
import * as path from 'path';
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
                await this.cleanSimulation();
            })
        );
    }

    /**
     * 启动编译仿真
     */
    async startSimulation(): Promise<void> {
        try {
            // 选择 HML 文件
            const hmlFile = await this.selectHmlFile();
            if (!hmlFile) {
                return;
            }

            // 获取项目根目录
            const projectRoot = ProjectUtils.findProjectRoot(hmlFile);
            if (!projectRoot) {
                vscode.window.showErrorMessage('无法找到项目根目录（project.json）');
                return;
            }

            // 获取 SDK 路径
            const sdkPath = this.getSdkPath(projectRoot);
            if (!sdkPath) {
                vscode.window.showErrorMessage(
                    '未配置 HoneyGUI SDK 路径\n\n' +
                    '请在以下位置之一配置：\n' +
                    '1. 项目配置 (project.json)\n' +
                    '2. VSCode 设置 (honeygui.sdk.path)'
                );
                return;
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
            await this.runner.start(hmlFile);

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
     */
    async cleanSimulation(): Promise<void> {
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
        await runner.clean();
        vscode.window.showInformationMessage('清理完成');
    }

    /**
     * 选择 HML 文件
     */
    private async selectHmlFile(): Promise<string | undefined> {
        // 如果当前编辑器是 HML 文件，直接使用
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.hml')) {
            return activeEditor.document.fileName;
        }

        // 否则让用户选择
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('没有打开的工作区');
            return undefined;
        }

        const hmlFiles = await vscode.workspace.findFiles('**/ui/**/*.hml', '**/node_modules/**', 100);
        
        if (hmlFiles.length === 0) {
            vscode.window.showErrorMessage('工作区中未找到 HML 文件');
            return undefined;
        }

        if (hmlFiles.length === 1) {
            return hmlFiles[0].fsPath;
        }

        // 显示选择列表
        const items = hmlFiles.map(uri => ({
            label: path.basename(uri.fsPath),
            description: path.dirname(uri.fsPath),
            uri
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要编译仿真的 HML 文件'
        });

        return selected?.uri.fsPath;
    }

    /**
     * 获取 SDK 路径（优先级）
     */
    private getSdkPath(projectRoot: string): string | undefined {
        // 1. 项目配置
        const projectConfig = ProjectUtils.loadProjectConfig(projectRoot);
        if (projectConfig.honeyguiSdkPath) {
            return projectConfig.honeyguiSdkPath;
        }

        // 2. VSCode 设置
        const config = vscode.workspace.getConfiguration('honeygui');
        const settingSdkPath = config.get<string>('sdk.path');
        if (settingSdkPath && fs.existsSync(settingSdkPath)) {
            return settingSdkPath;
        }

        // 3. 默认路径
        const defaultPath = path.join(require('os').homedir(), '.HoneyGUI-SDK');
        if (fs.existsSync(defaultPath)) {
            return defaultPath;
        }

        return undefined;
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
